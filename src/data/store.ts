// 事件存储：以 id 为主键的去重合并、过期清扫与只读快照订阅（SPEC-6.3）。
// 对 UI/globe 的唯一读口；输出未过滤全量，过滤属消费侧职责（FM-10/M4，见 DP §3.7）。

import type { GeoEvent, StoredRecord } from './types'

/**
 * 默认过期窗：SPEC-6.3 规定落在 [48h, 72h]，取 72h（区间上界，
 * 令缓存事件尽量久地留屏，配合 SPEC-3.11 缓存优先启动）。可经构造参数配置。
 */
export const DEFAULT_EXPIRY_MS = 72 * 60 * 60 * 1000

type Listener = (events: readonly GeoEvent[]) => void

export class EventStore {
  /**
   * 主索引：id → {事件, lastSeen}；同 id 覆盖即天然去重（SPEC-6.3）。lastSeen 为最后一次
   * 被 upsert 的墙钟时刻，是过期判定的唯一基准（SPEC-6.3①），与事件时间 ts 相互独立。
   */
  private readonly records = new Map<string, StoredRecord>()
  private readonly listeners = new Set<Listener>()
  private readonly expiryMs: number

  constructor(expiryMs: number = DEFAULT_EXPIRY_MS) {
    this.expiryMs = expiryMs
  }

  /** 只读全量快照（未过滤）；FM-07 标记层与 FM-10 面板共同消费（DP §3.3） */
  snapshot(): readonly GeoEvent[] {
    return Object.freeze([...this.records.values()].map((r) => r.event))
  }

  /** 订阅变更，返回退订函数；变更粒度 = 整快照，diff 由消费侧算（DP §3.3） */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * 去重合并：同 id 覆盖 ts/severity/summary 等全部可变字段，不新增第二条（SPEC-6.3 首句）；
   * 同时以 now 刷新 lastSeen（续期，SPEC-6.3①）。now 缺省取 Date.now()（保持旧调用点兼容），
   * 装配层每轮应显式传入、与同轮 sweepExpired 共用同一时刻（DP §5.1）。scheduler 每轮调用。
   */
  upsertMany(events: GeoEvent[], now: number = Date.now()): void {
    if (events.length === 0) return
    for (const ev of events) this.records.set(ev.id, { event: ev, lastSeen: now })
    this.notify()
  }

  /**
   * 缓存回填：灌入且不触发清扫（SPEC-3.11 数据侧顺序，DP §2.5）；沿用记录携带的持久化
   * lastSeen（冷启动语义，SPEC-6.3①），离线时段一并计入无更新时长，不重置为当前时刻。
   */
  load(records: StoredRecord[]): void {
    if (records.length === 0) return
    for (const r of records) this.records.set(r.event.id, r)
    this.notify()
  }

  /** 过期清扫：移除超窗且无更新的事件（SPEC-6.3①）；每轮刷新后带 now 调用 */
  sweepExpired(now: number): void {
    let removed = false
    for (const [id, r] of this.records) {
      if (this.isExpired(r, now)) {
        this.records.delete(id)
        removed = true
      }
    }
    if (removed) this.notify()
  }

  /**
   * 供装配层持久化专用：带 lastSeen 的完整记录（DP §5.1，cache.persist 消费）。
   * 非 UI/globe 读口，snapshot() 才是对外快照契约（仍纯 GeoEvent[]）。
   */
  entriesForPersist(): StoredRecord[] {
    return [...this.records.values()]
  }

  /**
   * 过期判定的唯一入口，基准为 lastSeen（SPEC-6.3①），而非事件时间 ts：事件只要持续被
   * upsert 即续期，ts 陈旧不影响存活。此处即 SPEC-6.3 预留的 per-category TTL 与收藏保护集
   * 插入点（flight 60s 特例、收藏永久保留属后续里程碑，M2 不实现，DP §2.4）。
   */
  private isExpired(record: StoredRecord, now: number): boolean {
    return now - record.lastSeen > this.expiryMs
  }

  private notify(): void {
    if (this.listeners.size === 0) return
    const snap = this.snapshot()
    for (const listener of this.listeners) listener(snap)
  }
}
