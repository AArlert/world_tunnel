// M2-08：Launch Library 2 provider 字段映射、坐标数值化与 severity 时序档（SPEC-5.5）+ 结构不变量
// （SPEC-6.1）。
//
// 期望值来源（严格只从 doc/spec.md 推导，不读 src/data/providers/ll2.ts 的实现当期望）：
// - 字段映射：SPEC-5.5「id=ll2:{results[].id}；坐标取发射工位 pad.latitude/pad.longitude（字符串
//   数值，parse 为 number）；title=name；summary=mission.description；urls 取 infoURLs[].url ∪
//   vidURLs[].url，二者皆空时回落自链 url（保证 urls≥1）；ts=net」。
// - severity：SPEC-5.5（v0.2.3 修订条款）「以 net 相对当前时刻的剩余时间（仅未来方向）分
//   档——T-1h 内 3，T-24h 内 2，其余 1；net 已过去（net ≤ now）时归「其余」档 = 1，不取绝对值
//   双向对称」。原方向性歧义（BUG-019）已由 REV-009 §2 裁决二仲裁消解并补句 pin 入 spec（见
//   doc/review/REV-009-expiry-and-severity.md §2.5），本文件断言覆盖 spec 全区间（含 net 已
//   过去方向），不再留白。
// - 结构不变量：SPEC-6.1（category 属六值枚举之一、severity∈{1,2,3}、id 全局唯一格式
//   `{source}:{原始id}`、urls 非 flight 源须 ≥1、source 字段值）。
//
// fixture 抓取时间/来源 URL 见 tests/fixtures/README.md（本文件不重复登记）；NOW 取
// ll2_upcoming_detailed.json 的抓取时刻（README 登记 2026-07-20T14:38:00Z），使真实 fixture
// 全部 10 条 net 均在 NOW 之后（脚本核实），落在无歧义区间内，不依赖系统当前时钟。

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeLl2 } from '../src/data/providers/ll2'

const FIXTURE_DIR = path.dirname(fileURLToPath(import.meta.url))

interface Ll2FixtureResult {
  id: string
  name: string
  net: string
  url: string
  mission: { description: string }
  pad: { latitude: string; longitude: string }
  infoURLs: Array<{ url: string }>
  vidURLs: Array<{ url: string }>
}
interface Ll2Fixture {
  results: Ll2FixtureResult[]
}

const ll2Fixture = JSON.parse(
  readFileSync(path.join(FIXTURE_DIR, 'fixtures/ll2_upcoming_detailed.json'), 'utf-8'),
) as Ll2Fixture

// fixture 抓取时刻（tests/fixtures/README.md 登记），全部真实 result 的 net 均晚于此时刻（脚本核实）
const NOW = Date.parse('2026-07-20T14:38:00Z')

describe('normalizeLl2 —— 真实 fixture 字段映射（SPEC-5.5，M2-08）', () => {
  const events = normalizeLl2(ll2Fixture, NOW)

  it('10 条真实 result 全部映射成功（fixture 抓取记录见 tests/fixtures/README.md）', () => {
    expect(events).toHaveLength(10)
  })

  it('id = ll2:{results[].id}（SPEC-5.5）', () => {
    events.forEach((e, i) => {
      expect(e.id).toBe(`ll2:${ll2Fixture.results[i].id}`)
    })
  })

  it('坐标 = pad.latitude/pad.longitude 字符串数值化（SPEC-5.5）', () => {
    events.forEach((e, i) => {
      const pad = ll2Fixture.results[i].pad
      expect(e.lat).toBe(Number(pad.latitude))
      expect(e.lon).toBe(Number(pad.longitude))
    })
  })

  it('title=name、summary=mission.description、ts=net（SPEC-5.5）', () => {
    events.forEach((e, i) => {
      const r = ll2Fixture.results[i]
      expect(e.title).toBe(r.name)
      expect(e.summary).toBe(r.mission.description)
      expect(e.ts).toBe(Date.parse(r.net)) // net 为 ISO 含 Z，Date.parse 直接得 UTC（SPEC-5.5）
    })
  })

  it('urls：infoURLs∪vidURLs 皆非空时取二者全数组并集（SPEC-5.5，result[0] 1+3 条）', () => {
    const r0 = ll2Fixture.results[0]
    expect(r0.infoURLs.length).toBeGreaterThan(0)
    expect(r0.vidURLs.length).toBeGreaterThan(0)
    const expected = [...r0.infoURLs.map((u) => u.url), ...r0.vidURLs.map((u) => u.url)]
    expect(events[0].urls).toEqual(expected)
  })

  it('urls：infoURLs 与 vidURLs 皆空时回落自链 url（真实 fixture index 2/3/5/8/9 覆盖，SPEC-5.5）', () => {
    const emptyIndices = [2, 3, 5, 8, 9]
    for (const i of emptyIndices) {
      const r = ll2Fixture.results[i]
      expect(r.infoURLs).toHaveLength(0)
      expect(r.vidURLs).toHaveLength(0)
      expect(events[i].urls).toEqual([r.url])
    }
  })

  it('真实 fixture：result[0] net 距 NOW 约 11.5 分钟（未来、T-1h 内）→ severity 3（SPEC-5.5，无歧义区间）', () => {
    const r0Net = Date.parse(ll2Fixture.results[0].net)
    expect(r0Net).toBeGreaterThan(NOW) // 确认落在无歧义区间：net 在 NOW 之后
    expect(r0Net - NOW).toBeLessThan(60 * 60 * 1000)
    expect(events[0].severity).toBe(3)
  })

  it('真实 fixture：result[1..9] net 距 NOW 均超 24h（未来、其余档）→ severity 1（SPEC-5.5，无歧义区间）', () => {
    for (let i = 1; i < 10; i++) {
      const net = Date.parse(ll2Fixture.results[i].net)
      expect(net).toBeGreaterThan(NOW) // 确认落在无歧义区间：net 在 NOW 之后
      expect(net - NOW).toBeGreaterThan(24 * 60 * 60 * 1000)
      expect(events[i].severity).toBe(1)
    }
  })
})

/** 构造单条 LL2 result，net = now + offsetMs（offset 可为负，表示 net 已过去） */
function makeResult(netOffsetMs: number, now: number) {
  return {
    id: 'constructed-id',
    name: 'Constructed Launch',
    net: new Date(now + netOffsetMs).toISOString(),
    url: 'https://example.com/launch/constructed-id/',
    mission: { description: 'Constructed mission' },
    pad: { latitude: '0', longitude: '0' },
    infoURLs: [],
    vidURLs: [],
  }
}

describe('normalizeLl2 —— severity 时序档边界（SPEC-5.5，M2-08，构造输入，net 尚未到来方向）', () => {
  it.each([
    [30 * 60 * 1000, 3], // T-30min：明确落在「T-1h 内」
    [59 * 60 * 1000, 3], // T-59min：明确落在「T-1h 内」
    [90 * 60 * 1000, 2], // T-1.5h：超出 1h、落在「T-24h 内」
    [12 * 60 * 60 * 1000, 2], // T-12h：明确落在「T-24h 内」
    [23 * 60 * 60 * 1000, 2], // T-23h：明确落在「T-24h 内」
    [25 * 60 * 60 * 1000, 1], // T-25h：超出 24h、落「其余」
    [5 * 24 * 60 * 60 * 1000, 1], // T-5 天：明确落「其余」
  ])('net 为 now 之后 %i ms → severity=%s（SPEC-5.5）', (offsetMs, expectedSeverity) => {
    const raw = { results: [makeResult(offsetMs, NOW)] }
    const [event] = normalizeLl2(raw, NOW)
    expect(event.severity).toBe(expectedSeverity)
  })
})

describe('normalizeLl2 —— severity net 已过去方向（SPEC-5.5 v0.2.3 修订条款，REV-009 §2.5，M2-08，构造输入）', () => {
  // SPEC-5.5：「net 已过去（net ≤ now）时归「其余」档 = 1，不取绝对值双向对称、不因刚发射而按
  // 时间距离判为高档」。原方向性歧义（BUG-019）已由 REV-009 §2 裁决二消解并补句 pin 入 spec，
  // 本块覆盖该方向、含 net=now 边界，不再留白（承接任务卡指定构造用例）。
  it.each([
    [-5 * 60 * 1000], // net = now − 5min（刚发射完，若误取绝对值会落「T-1h 内」=3，裁决后须为 1）
    [-30 * 60 * 1000], // net = now − 30min（BUG-019 登记的复现用例）
    [-2 * 60 * 60 * 1000], // net = now − 2h（若误取绝对值会落「T-24h 内」=2，裁决后须为 1）
    [0], // net = now（边界，diff=0 属「已过去或等于 now」，仍归其余档）
  ])('net 为 now 偏移 %i ms（已过去或等于 now）→ severity=1（SPEC-5.5，REV-009 §2.5）', (offsetMs) => {
    const raw = { results: [makeResult(offsetMs, NOW)] }
    const [event] = normalizeLl2(raw, NOW)
    expect(event.severity).toBe(1)
  })
})

describe('normalizeLl2 —— 结构不变量（SPEC-6.1，M2-08）', () => {
  const events = normalizeLl2(ll2Fixture, NOW)

  it('category 恒为 launch（SPEC-5.5「Launch Library 2 火箭发射 → category launch」）', () => {
    for (const e of events) expect(e.category).toBe('launch')
  })

  it('source 恒为 ll2（SPEC-6.1 source 字段枚举）', () => {
    for (const e of events) expect(e.source).toBe('ll2')
  })

  it('severity ∈ {1,2,3}（SPEC-6.1）', () => {
    for (const e of events) expect([1, 2, 3]).toContain(e.severity)
  })

  it('urls 非空数组（LL2 非 flight 源，SPEC-6.1「除 flight 外长度 ≥1」；SPEC-5.5 回落规则保证 urls≥1）', () => {
    for (const e of events) {
      expect(Array.isArray(e.urls)).toBe(true)
      expect(e.urls.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('id 形如 ll2:{原始id}（SPEC-6.1 `{source}:{原始id}`）', () => {
    for (const e of events) expect(e.id).toMatch(/^ll2:.+/)
  })
})
