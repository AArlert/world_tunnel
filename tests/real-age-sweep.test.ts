import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeEonet } from '../src/data/providers/eonet'
import { EventStore } from '../src/data/store'

// M2-09：真龄清扫——真实 fixture 长寿命事件续期不被误清（承接 BUG-018）。
// 期望值只从 doc/spec.md 推导：SPEC-6.3①（v0.2.3，REV-009 §1 裁决一仲裁，BUG-018 定案）
// 「无更新」以事件最后一次被写入存储（upsert）的墙钟时刻 lastSeen 为过期计时基准，而非
// 事件时间 ts：事件只要出现在某轮源响应中被 upsert 即视为「见到」，其 lastSeen 刷新、
// 过期计时重置（续期）；ts 与 lastSeen 相互独立，长寿命事件即便 ts 陈旧超窗，只要仍被
// 源持续返回即续期留屏、不被误清。
//
// fixture 抓取时间/来源 URL 登记于 tests/fixtures/README.md（本文件不重复登记）；
// BUG-018 登记复现（doc/bugs.md）：该 fixture 26 条 open 事件中 24 条最新 geometry 日期
// 距抓取时刻已超 72h（野火最旧 171h）。旧 Design X（过期基准=ts）下首轮 sweepExpired
// 即误清 24 条；Design Y（过期基准=lastSeen，本场景所测现行实现）下应 0 条被清。

const FIXTURE_DIR = path.dirname(fileURLToPath(import.meta.url))
const eonetFixture = JSON.parse(
  readFileSync(path.join(FIXTURE_DIR, 'fixtures/eonet_events.json'), 'utf-8'),
)

// fixture 抓取时刻（UTC），与 tests/fixtures/README.md、doc/bugs.md BUG-018 登记一致
const FETCH_TIME = Date.parse('2026-07-20T14:18:49Z')

describe('真龄清扫 —— 真实 fixture 长寿命事件续期不被误清（SPEC-6.3①，M2-09，承接 BUG-018）', () => {
  it('该 fixture 确有事件 ts 距抓取时刻已超 72h（独立核验前提真实存在，非同义反复）', () => {
    // 独立于被测 store 逻辑，直接对归一化输出的 ts 与抓取时刻比较，验证「长寿命/陈旧 ts」
    // 前提真实存在——若此前提不成立，下一条测试就可能只是巧合地全部事件 ts 均在窗内，
    // 无法验证到「续期」这一行为语义（该数字与 doc/bugs.md BUG-018 登记的实证一致）。
    const events = normalizeEonet(eonetFixture, FETCH_TIME)
    const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000
    const staleCount = events.filter((e) => FETCH_TIME - e.ts > SEVENTY_TWO_HOURS_MS).length
    expect(staleCount).toBeGreaterThan(0)
  })

  it('全量真实 open 事件以统一 now upsert 后立即 sweepExpired，快照仍含全部事件、0 条被清（SPEC-6.3① 续期语义）', () => {
    const events = normalizeEonet(eonetFixture, FETCH_TIME)
    expect(events.length).toBeGreaterThan(0)

    const store = new EventStore() // 默认过期窗（72h，落在 SPEC-6.3① [48h,72h] 区间）
    store.upsertMany(events, FETCH_TIME)
    store.sweepExpired(FETCH_TIME)

    expect(store.snapshot().length).toBe(events.length) // 0 条被清
  })
})
