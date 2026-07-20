// 事件存储：以 id 为主键的去重合并、过期清扫与只读快照订阅（SPEC-6.3）。
// 对 UI/globe 的唯一读口；输出未过滤全量，过滤属消费侧职责（FM-10/M4，见 DP §3.7）。

import type { GeoEvent } from './types'

/**
 * 默认过期窗：SPEC-6.3 规定落在 [48h, 72h]，取 72h（区间上界，
 * 令缓存事件尽量久地留屏，配合 SPEC-3.11 缓存优先启动）。可经构造参数配置。
 */
export const DEFAULT_EXPIRY_MS = 72 * 60 * 60 * 1000

type Listener = (events: readonly GeoEvent[]) => void

export class EventStore {
  /** 主索引：id → 事件；同 id 覆盖即天然去重（SPEC-6.3） */
  private readonly events = new Map<string, GeoEvent>()
  private readonly listeners = new Set<Listener>()
  private readonly expiryMs: number

  constructor(expiryMs: number = DEFAULT_EXPIRY_MS) {
    this.expiryMs = expiryMs
  }

  /** 只读全量快照（未过滤）；FM-07 标记层与 FM-10 面板共同消费（DP §3.3） */
  snapshot(): readonly GeoEvent[] {
    return Object.freeze([...this.events.values()])
  }

  /** 订阅变更，返回退订函数；变更粒度 = 整快照，diff 由消费侧算（DP §3.3） */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** 去重合并：同 id 覆盖 ts/severity/summary 等全部可变字段，不新增第二条（SPEC-6.3）；scheduler 每轮调用 */
  upsertMany(events: GeoEvent[]): void {
    if (events.length === 0) return
    for (const ev of events) this.events.set(ev.id, ev)
    this.notify()
  }

  /** 缓存回填：灌入且不触发清扫（SPEC-3.11 数据侧顺序，DP §2.5） */
  load(events: GeoEvent[]): void {
    if (events.length === 0) return
    for (const ev of events) this.events.set(ev.id, ev)
    this.notify()
  }

  /** 过期清扫：移除超窗且无更新的事件（SPEC-6.3）；每轮刷新后带 now 调用 */
  sweepExpired(now: number): void {
    let removed = false
    for (const [id, ev] of this.events) {
      if (this.isExpired(ev, now)) {
        this.events.delete(id)
        removed = true
      }
    }
    if (removed) this.notify()
  }

  /**
   * 过期判定的唯一入口。此处即 SPEC-6.3 预留的 per-category TTL 与收藏保护集插入点
   * （flight 60s 特例、收藏永久保留属后续里程碑，M2 不实现，DP §2.4）。
   */
  private isExpired(ev: GeoEvent, now: number): boolean {
    return now - ev.ts > this.expiryMs
  }

  private notify(): void {
    if (this.listeners.size === 0) return
    const snap = this.snapshot()
    for (const listener of this.listeners) listener(snap)
  }
}
