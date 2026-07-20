import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Scheduler } from '../src/data/scheduler'
import type { EventProvider, GeoEvent, ProviderResult } from '../src/data/types'

// M2-03：独立轮询与限流预算。期望值只从 doc/spec.md 推导：
// SPEC-5.0「每源独立轮询与限流预算」——不同数据源的调度按各自独立的轮询周期触发，
// 一源的轮询节奏或限流预算不与另一源共享或相互干扰。
// 具体退避公式（基础间隔×2^n、上限 30min）与持续故障隔离属 M2-04 场景职责，
// 本文件不重复断言该公式的精确取值，只验证「一源失败不改变另一源的既定节奏」。

function makeEvent(id: string): GeoEvent {
  return {
    id,
    category: 'disaster',
    severity: 1,
    title: 't',
    summary: 's',
    urls: ['https://example.com'],
    lat: 0,
    lon: 0,
    ts: 0,
    source: 'usgs',
  }
}

function okProvider(source: EventProvider['source'], intervalMs: number) {
  const calls: number[] = []
  let seq = 0
  const provider: EventProvider = {
    source,
    intervalMs,
    poll: vi.fn(async (ctx) => {
      calls.push(ctx.now)
      seq += 1
      const result: ProviderResult = { status: 'ok', events: [makeEvent(`${source}:${seq}`)] }
      return result
    }),
  }
  return { provider, calls }
}

function failingProvider(source: EventProvider['source'], intervalMs: number) {
  const calls: number[] = []
  const provider: EventProvider = {
    source,
    intervalMs,
    poll: vi.fn(async (ctx) => {
      calls.push(ctx.now)
      throw new Error('boom')
    }),
  }
  return { provider, calls }
}

describe('Scheduler —— 不同源按各自 intervalMs 独立触发（SPEC-5.0，M2-03）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0) // 令 clock()=Date.now() 从确定性的 t=0 起算
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('周期互不共享：短周期源密集触发时长周期源不受影响', async () => {
    const a = okProvider('usgs', 1_000)
    const b = okProvider('eonet', 3_000)
    const scheduler = new Scheduler([a.provider, b.provider], () => {})
    scheduler.start()

    await vi.advanceTimersByTimeAsync(0) // 首轮：各源立即各拉一次
    expect(a.calls.length).toBe(1)
    expect(b.calls.length).toBe(1)

    await vi.advanceTimersByTimeAsync(999) // t=999
    expect(a.calls.length).toBe(1)
    expect(b.calls.length).toBe(1)

    await vi.advanceTimersByTimeAsync(1) // t=1000：a 到期，b 未到期
    expect(a.calls.length).toBe(2)
    expect(b.calls.length).toBe(1)

    await vi.advanceTimersByTimeAsync(1_999) // t=2999
    expect(a.calls.length).toBe(3)
    expect(b.calls.length).toBe(1)

    await vi.advanceTimersByTimeAsync(1) // t=3000：a、b 同时到期
    expect(a.calls.length).toBe(4)
    expect(b.calls.length).toBe(2)

    scheduler.stop()
  })
})

describe('Scheduler —— 一源故障不干扰另一源节奏（SPEC-5.0，M2-03）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0) // 令 clock()=Date.now() 从确定性的 t=0 起算
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('a 持续失败进入退避期间，b 仍按自身 intervalMs 准时触发', async () => {
    const a = failingProvider('usgs', 1_000)
    const b = okProvider('eonet', 1_000)
    const scheduler = new Scheduler([a.provider, b.provider], () => {})
    scheduler.start()

    await vi.advanceTimersByTimeAsync(0)
    expect(b.calls.length).toBe(1)

    await vi.advanceTimersByTimeAsync(1_000) // t=1000
    expect(b.calls.length).toBe(2)

    await vi.advanceTimersByTimeAsync(1_000) // t=2000
    expect(b.calls.length).toBe(3)

    // b 三次触发严格落在 0/1000/2000，未因 a 的失败退避被拖慢或提前
    expect(b.calls).toEqual([0, 1_000, 2_000])

    scheduler.stop()
  })
})
