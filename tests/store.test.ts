import { describe, expect, it } from 'vitest'
import { DEFAULT_EXPIRY_MS, EventStore } from '../src/data/store'
import type { GeoEvent } from '../src/data/types'

// M2-02：同 id 更新去重与默认过期窗。期望值只从 doc/spec.md 推导：
// SPEC-6.3「同 id 事件再次出现视为更新（覆盖 ts/severity/summary），不新增标记。
// 过期与保留：①默认过期窗 48–72h 无更新移除（具体值视本地存储预算定，可配）」。
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

describe('EventStore —— 过期窗后移除、窗内保留（SPEC-6.3①，M2-02）', () => {
  it('sweepExpired 在窗内保留事件，超窗后移除', () => {
    const expiryMs = 1_000
    const store = new EventStore(expiryMs)
    store.upsertMany([makeEvent({ ts: 0 })])

    store.sweepExpired(500) // 未超窗
    expect(store.snapshot().length).toBe(1)

    store.sweepExpired(1_500) // 超窗
    expect(store.snapshot().length).toBe(0)
  })

  it('过期窗临界前更新（覆盖 ts）令事件不被清扫，体现「更新即续期」（SPEC-6.3 覆盖 ts + ①过期窗组合语义）', () => {
    const expiryMs = 1_000
    const store = new EventStore(expiryMs)
    store.upsertMany([makeEvent({ ts: 0 })])

    // 若不更新，ts=0 的事件在 now=1500 时早已超窗；覆盖 ts 后应按新 ts 重新计窗
    store.upsertMany([makeEvent({ ts: 1_000, severity: 2, summary: '续期更新' })])
    store.sweepExpired(1_500) // 1500 - 1000 = 500 < 1000，未超窗
    expect(store.snapshot().length).toBe(1)
    expect(store.snapshot()[0].summary).toBe('续期更新')
  })
})
