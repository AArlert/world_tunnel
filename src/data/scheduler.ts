// 调度：每源独立定时 + 指数退避 + 故障隔离（SPEC-5.0）。
// 一源失败只影响该源的下次延迟，异常不冒泡至其他源或渲染（SPEC-5.0 故障隔离）。

import type { EventProvider, GeoEvent, PollContext } from './types'

/** 退避上限 30min（SPEC-5.0） */
const MAX_BACKOFF_MS = 30 * 60 * 1000

interface SourceRunner {
  readonly provider: EventProvider
  failures: number // 连续失败次数 n（成功/304 归零，SPEC-5.0）
  firstRun: boolean
  timer: ReturnType<typeof setTimeout> | null
}

export class Scheduler {
  private readonly providers: EventProvider[]
  private readonly onResult: (events: GeoEvent[]) => void
  private readonly clock: () => number

  private runners: SourceRunner[] = []
  private controller: AbortController | null = null
  private started = false

  constructor(
    providers: EventProvider[],
    onResult: (events: GeoEvent[]) => void, // 仅 ok 且非空时回调，交 store.upsertMany
    clock: () => number = Date.now,
  ) {
    this.providers = providers
    this.onResult = onResult
    this.clock = clock
  }

  /** 首轮 firstRun=true 各源立即各拉一次，此后按自身 intervalMs 独立排程（DP §3.5） */
  start(): void {
    if (this.started) return
    this.started = true
    this.controller = new AbortController()
    this.runners = this.providers.map((provider) => ({
      provider,
      failures: 0,
      firstRun: true,
      timer: null,
    }))
    for (const runner of this.runners) this.runOnce(runner)
  }

  /** abort 在途请求 + 清所有定时器（dispose 生命周期，DP §4.3） */
  stop(): void {
    if (!this.started) return
    this.started = false
    this.controller?.abort()
    this.controller = null
    for (const runner of this.runners) {
      if (runner.timer !== null) clearTimeout(runner.timer)
      runner.timer = null
    }
    this.runners = []
  }

  private runOnce(runner: SourceRunner): void {
    const controller = this.controller
    if (controller === null) return

    const ctx: PollContext = {
      firstRun: runner.firstRun,
      now: this.clock(),
      signal: controller.signal,
    }
    runner.firstRun = false

    runner.provider
      .poll(ctx)
      .then((result) => {
        // 异步完成时若已 stop/重启，丢弃结果不入 store（SPEC-5.0/§4.3 竞态）
        if (this.controller !== controller) return
        runner.failures = 0 // 成功/304 归零退避（SPEC-5.0）
        if (result.status === 'ok' && result.events.length > 0) {
          this.onResult(result.events)
        }
        // 304（notModified）：不回调、不退避（SPEC-5.0）
        this.scheduleNext(runner, runner.provider.intervalMs)
      })
      .catch(() => {
        // 故障隔离：本源网络/解析异常被就地捕获，不冒泡（SPEC-5.0）
        if (this.controller !== controller) return
        runner.failures += 1
        this.scheduleNext(runner, this.backoffDelay(runner))
      })
  }

  /** 指数退避 min(intervalMs × 2^n, 30min)，n 为连续失败次数（SPEC-5.0） */
  private backoffDelay(runner: SourceRunner): number {
    const raw = runner.provider.intervalMs * 2 ** runner.failures
    return Math.min(raw, MAX_BACKOFF_MS)
  }

  private scheduleNext(runner: SourceRunner, delayMs: number): void {
    if (this.controller === null) return
    runner.timer = setTimeout(() => {
      runner.timer = null
      this.runOnce(runner)
    }, delayMs)
  }
}
