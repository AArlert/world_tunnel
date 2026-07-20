import { describe, expect, it } from 'vitest'
import { DEFAULT_EXPIRY_MS, EventStore } from '../src/data/store'
import type { GeoEvent, StoredRecord } from '../src/data/types'

// M2-02：同 id 更新去重与过期计时基准。期望值只从 doc/spec.md 推导：
// SPEC-6.3「同 id 事件再次出现视为更新（覆盖 ts/severity/summary），不新增标记。」
// SPEC-6.3①（v0.2.3，REV-009 §1 裁决一仲裁，BUG-018 定案，替换本场景过期半原判据）：
// 「默认过期窗 48–72h 无更新移除——「无更新」以事件最后一次被写入存储（upsert）的墙钟
// 时刻 lastSeen 为过期计时基准，而非事件时间 ts：事件只要出现在某轮源响应中被 upsert
// 即视为「见到」，其 lastSeen 刷新、过期计时重置（续期）；连续 48–72h（可配）未再被任何
// 源 upsert 才移除。lastSeen 与 ts 相互独立——ts（事件时间）仅供展示与排序、不参与过期
// 判定，故长寿命事件即便 ts 陈旧超窗，只要仍被源持续返回即续期留屏、不被误清。冷启动
// 从本地缓存回填的事件沿用其持久化的 lastSeen（关机前最后见到时刻），离线时段一并计入
// 「无更新」时长。」
// flight 60s 子句不在本场景（BUG-016，见 doc/testplan.md M2-02 行文）。
//
// DEFAULT_EXPIRY_MS 的具体取值属实现自选（spec 只约束落在 [48h,72h] 区间、且可配），
// 本文件不对其精确数值做等值断言，只断言落在 spec 给定区间内；过期清扫的时序行为
// 改用构造参数注入的可配窗口做确定性验证（SPEC-6.3① 明文允许「可配」，故注入自定义
// expiryMs 属沿 spec 授权的能力测试，不是照抄实现细节）。

function makeEvent(overrides: Partial<GeoEvent> = {}): GeoEvent {
  return {
    id: 'usgs:eq1',
    category: 'disaster',
    severity: 1,
    title: 'M4.5 test',
    summary: '初次描述',
    urls: ['https://example.com/a'],
    lat: 10,
    lon: 20,
    ts: 1_000,
    source: 'usgs',
    ...overrides,
  }
}

describe('EventStore —— 同 id 更新去重（SPEC-6.3 第一句，M2-02）', () => {
  it('同 id 再次出现覆盖 ts/severity/summary，不新增标记（snapshot 条数不增长）', () => {
    const store = new EventStore()
    store.upsertMany([makeEvent({ ts: 1_000, severity: 1, summary: '初次描述' })])
    store.upsertMany([makeEvent({ ts: 2_000, severity: 3, summary: '更新描述' })])

    const snap = store.snapshot()
    expect(snap.length).toBe(1)
    expect(snap[0].ts).toBe(2_000)
    expect(snap[0].severity).toBe(3)
    expect(snap[0].summary).toBe('更新描述')
  })

  it('不同 id 各自独立入库，snapshot 条数随不同 id 数量增长', () => {
    const store = new EventStore()
    store.upsertMany([makeEvent({ id: 'usgs:eq1' }), makeEvent({ id: 'usgs:eq2' })])
    expect(store.snapshot().length).toBe(2)
  })
})

describe('EventStore —— 默认过期窗落在 48–72h 区间（SPEC-6.3①，M2-02）', () => {
  it('DEFAULT_EXPIRY_MS ∈ [48h, 72h]', () => {
    const hour = 60 * 60 * 1000
    expect(DEFAULT_EXPIRY_MS).toBeGreaterThanOrEqual(48 * hour)
    expect(DEFAULT_EXPIRY_MS).toBeLessThanOrEqual(72 * hour)
  })
})

describe('EventStore —— 过期计时基准为 lastSeen，独立于事件时间 ts（SPEC-6.3①，M2-02，v0.2.3/REV-009）', () => {
  it('过期以 upsert 时注入的 now（即 lastSeen）计窗，而非事件 ts：ts 陈旧但 lastSeen 新鲜仍在窗内保留、超窗后移除', () => {
    const expiryMs = 1_000
    const store = new EventStore(expiryMs)
    // ts 故意设为很小的陈旧值：若过期基准误用 ts，now=10_500 时 now-ts 早已远超窗口，
    // 与「lastSeen 基准」的正确结果不同，本用例据此区分两种实现
    store.upsertMany([makeEvent({ ts: 0 })], 10_000) // upsert 墙钟时刻（lastSeen）= 10_000

    store.sweepExpired(10_500) // 距 lastSeen 500ms，未超窗
    expect(store.snapshot().length).toBe(1)

    store.sweepExpired(11_500) // 距 lastSeen 1_500ms，超窗，移除
    expect(store.snapshot().length).toBe(0)
  })

  it('陈旧 ts 但持续被 upsert 的事件不被 sweepExpired 清扫（「仍被源持续返回即续期留屏」，SPEC-6.3①）', () => {
    const expiryMs = 1_000
    const store = new EventStore(expiryMs)
    const staleTs = 0 // ts 全程不变，模拟长寿命事件的陈旧事件时间（如持续数月的干旱）
    store.upsertMany([makeEvent({ ts: staleTs })], 0) // 首次见到，lastSeen=0

    // 源仍在后续一轮返回该事件（ts 不变、依旧陈旧），upsert 刷新 lastSeen（续期）
    store.upsertMany([makeEvent({ ts: staleTs })], 2_000) // lastSeen 续期至 2_000
    store.sweepExpired(2_500) // 距最新 lastSeen 500ms，未超窗，即便 now-ts=2_500 远超 expiryMs
    expect(store.snapshot().length).toBe(1)

    // 此后不再被任何源 upsert，超过一个过期窗才真正移除
    store.sweepExpired(3_500) // 距最新 lastSeen(2_000) 1_500ms，超窗，移除
    expect(store.snapshot().length).toBe(0)
  })

  it('load 回填不触发清扫，且保留其携带的持久化 lastSeen、不重置为当前时刻（SPEC-6.3① 冷启动语义）', () => {
    const expiryMs = 1_000
    const store = new EventStore(expiryMs)
    // lastSeen=0，远早于任意真实运行时刻：若 load 会主动清扫或重置 lastSeen 为当前时刻，
    // 该事件本应「已超窗」，本行验证 load 本身不做任何过期判定
    const record: StoredRecord = { event: makeEvent(), lastSeen: 0 }
    store.load([record])
    expect(store.snapshot().length).toBe(1) // load 后立即可见，未被自动清扫

    const persistedLastSeen = 100
    const store2 = new EventStore(expiryMs)
    store2.load([{ event: makeEvent(), lastSeen: persistedLastSeen }])

    store2.sweepExpired(persistedLastSeen + 500) // 距持久化 lastSeen 500ms，未超窗
    expect(store2.snapshot().length).toBe(1)

    // 若 load 曾将 lastSeen 重置为某个远大于 persistedLastSeen 的时刻（如当前真实墙钟），
    // 此处 now-lastSeen 会仍然很小而被误判为未超窗；本断言据此证明 lastSeen 确实是原样保留
    store2.sweepExpired(persistedLastSeen + 1_500) // 距持久化 lastSeen 1_500ms，超窗，移除
    expect(store2.snapshot().length).toBe(0)
  })
})
