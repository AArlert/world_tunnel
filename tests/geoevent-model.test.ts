// M2-01：GeoEvent 归一化模型字段与坐标一致性——四源（usgs/eonet/gdacs/ll2）在同一套断言下
// 过 SPEC-6.1 全部结构约束 + SPEC-6.2 坐标约定（FM-05 收口场景）。
//
// 期望值来源（严格只从 doc/spec.md 推导，不读 src/data/providers/*.ts 与 src/globe/geo.ts 的
// 实现当期望）：
// - 结构不变量：SPEC-6.1 interface GeoEvent 逐字段——
//   `id: string`（`"{source}:{原始id}"`，全局唯一，跨轮询去重键）；
//   `category`：六值枚举 'disaster'|'conflict'|'humanitarian'|'news'|'launch'|'flight' 之一；
//   `severity: 1 | 2 | 3`；
//   `urls: string[]`，除 flight 外长度 ≥1（本场景四源 usgs/eonet/gdacs/ll2 均非 flight）；
//   `lat`/`lon`：WGS84 度——纬度∈[-90,90]、经度∈[-180,180] 为 WGS84 外部标准的度值范围
//   （非本仓库实现选择，与 usgs.test.ts 引用 RFC 7946 同类做法）；
//   `ts: number`（epoch ms，须为正有限数）；
//   `source: string`：SPEC-6.1 类型注释枚举 `'usgs' | 'eonet' | 'gdacs' | 'gdelt' | 'll2' |
//   'opensky'` 之一，本场景四源分别产出对应字面值。
// - 跨源 id 全局唯一：SPEC-6.1「id: string "{source}:{原始id}"，全局唯一，跨轮询去重键」——
//   四源归一化结果合并后不得出现重复 id（每源自带前缀，天然不冲突，此处显式断言证明之）。
// - SPEC-6.2 坐标约定：「北极 (90,·)→+Y；(0,0)→+Z；(0,90°E)→+X」。三个精确锚点已由 M0-01
//   （tests/geo.test.ts）覆盖，本场景改用四源真实归一化坐标（65 条，覆盖全球分散经纬度）批量
//   校验，检验方式为由三锚点直接蕴含、且不移植 latLonToVector3 内部三角公式的符号/模长不变量
//   （类比 M1-14「禁止移植 GLSL 公式再对该移植断言」的同义反复禁区）：
//     ① 球面坐标向量模长 = 半径（默认 1）——球面参数化的定义性质，与具体轴映射公式无关；
//     ② 北极→+Y 蕴含纬度符号决定 y 符号：lat>0 → y>0，lat<0 → y<0；
//     ③ (0,0)→+Z 与 (0,90°E)→+X 蕴含经度符号决定 x/z 符号：0°<lon<180° → x>0，
//        −180°<lon<0° → x<0；|lon|<90° → z>0，|lon|>90° → z<0（边界附近若干度设阈值跳过，
//        避免浮点/精确 0 附近的符号判定噪声）。
// - 每源精确字段抽查（不复述 M2-05~08 全量断言，逐源仅取 1 条动态对照 fixture 自身字段值，
//   不硬编码期望字符串）：id/summary/urls/ts 分别引用 SPEC-5.1/5.2/5.3/5.5（GDACS/LL2 字段来源
//   已由 REV-008 §6.5 精确 pin）。
//
// fixture 抓取时间/来源 URL 见 tests/fixtures/README.md（本文件不重复登记）；gdacs_eventlist.json
// 634KB 体量沿用既有测试（gdacs.test.ts）对已知 eventid 的定点访问方式，不整读。

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeEonet } from '../src/data/providers/eonet'
import { normalizeGdacs } from '../src/data/providers/gdacs'
import { normalizeLl2 } from '../src/data/providers/ll2'
import { normalizeUsgs } from '../src/data/providers/usgs'
import { latLonToVector3 } from '../src/globe/geo'
import type { GeoEvent } from '../src/data/types'

const FIXTURE_DIR = path.dirname(fileURLToPath(import.meta.url))

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(path.join(FIXTURE_DIR, 'fixtures', name), 'utf-8'))
}

const usgsFixture = loadFixture('usgs_all_hour.json') as {
  features: Array<{ id: string; properties: { url: string } }>
}
const eonetFixture = loadFixture('eonet_events.json') as {
  events: Array<{ id: string; categories: Array<{ title: string }> }>
}
const gdacsFixture = loadFixture('gdacs_eventlist.json') as {
  features: Array<{
    geometry: { type: string }
    properties: { eventid: number; name: string }
  }>
}
const ll2Fixture = loadFixture('ll2_upcoming_detailed.json') as {
  results: Array<{ id: string; net: string }>
}

// 各源占位抓取时钟，沿用对应 M2-05~08 测试文件已核实的取值（真实 fixture 条目均带自身时间戳，
// NOW 仅用于缺失回落与 LL2 severity 时序档，不影响本场景的结构/坐标不变量）。
const USGS_NOW = 1_700_000_000_000
const EONET_NOW = 1_753_000_000_000
const GDACS_NOW = 1_753_100_000_000
const LL2_NOW = Date.parse('2026-07-20T14:38:00Z')

const usgsEvents = normalizeUsgs(usgsFixture, USGS_NOW)
const eonetEvents = normalizeEonet(eonetFixture, EONET_NOW)
const gdacsEvents = normalizeGdacs(gdacsFixture, GDACS_NOW)
const ll2Events = normalizeLl2(ll2Fixture, LL2_NOW)

const allEvents: GeoEvent[] = [...usgsEvents, ...eonetEvents, ...gdacsEvents, ...ll2Events]

const VALID_CATEGORIES = ['disaster', 'conflict', 'humanitarian', 'news', 'launch', 'flight']
const VALID_SOURCES = ['usgs', 'eonet', 'gdacs', 'gdelt', 'll2', 'opensky']

describe('GeoEvent 归一化——四源非空前置（M2-01，证明本场景确有真实数据可测）', () => {
  it('四源均产出 ≥1 条真实归一化事件', () => {
    expect(usgsEvents.length).toBeGreaterThan(0)
    expect(eonetEvents.length).toBeGreaterThan(0)
    expect(gdacsEvents.length).toBeGreaterThan(0)
    expect(ll2Events.length).toBeGreaterThan(0)
  })
})

describe('GeoEvent 归一化——SPEC-6.1 结构不变量（M2-01，四源合并统一断言）', () => {
  it('id 形如 {source}:{原始id}，且四源合并后全局唯一（SPEC-6.1）', () => {
    for (const e of usgsEvents) expect(e.id).toMatch(/^usgs:.+/)
    for (const e of eonetEvents) expect(e.id).toMatch(/^eonet:.+/)
    for (const e of gdacsEvents) expect(e.id).toMatch(/^gdacs:.+/)
    for (const e of ll2Events) expect(e.id).toMatch(/^ll2:.+/)

    const ids = allEvents.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('category 属六值枚举之一（SPEC-6.1）', () => {
    for (const e of allEvents) expect(VALID_CATEGORIES).toContain(e.category)
  })

  it('severity ∈ {1,2,3}（SPEC-6.1）', () => {
    for (const e of allEvents) expect([1, 2, 3]).toContain(e.severity)
  })

  it('urls 为数组且长度 ≥1（本场景四源均非 flight，SPEC-6.1「除 flight 外长度 ≥1」）', () => {
    for (const e of allEvents) {
      expect(Array.isArray(e.urls)).toBe(true)
      expect(e.urls.length).toBeGreaterThanOrEqual(1)
      for (const u of e.urls) expect(typeof u).toBe('string')
    }
  })

  it('lat/lon 为 WGS84 度值，落在纬度[-90,90]/经度[-180,180]（外部标准范围，SPEC-6.1「WGS84 度」）', () => {
    for (const e of allEvents) {
      expect(Number.isFinite(e.lat)).toBe(true)
      expect(Number.isFinite(e.lon)).toBe(true)
      expect(e.lat).toBeGreaterThanOrEqual(-90)
      expect(e.lat).toBeLessThanOrEqual(90)
      expect(e.lon).toBeGreaterThanOrEqual(-180)
      expect(e.lon).toBeLessThanOrEqual(180)
    }
  })

  it('ts 为 epoch ms，正有限数（SPEC-6.1）', () => {
    for (const e of allEvents) {
      expect(Number.isFinite(e.ts)).toBe(true)
      expect(e.ts).toBeGreaterThan(0)
    }
  })

  it('source 属 SPEC-6.1 枚举字符串集合，且与产出该事件的 provider 一致', () => {
    for (const e of allEvents) expect(VALID_SOURCES).toContain(e.source)
    for (const e of usgsEvents) expect(e.source).toBe('usgs')
    for (const e of eonetEvents) expect(e.source).toBe('eonet')
    for (const e of gdacsEvents) expect(e.source).toBe('gdacs')
    for (const e of ll2Events) expect(e.source).toBe('ll2')
  })
})

describe('GeoEvent 归一化——SPEC-6.2 坐标约定（M2-01，latLonToVector3 批量符号/模长不变量）', () => {
  // 由 SPEC-6.2「北极(90,·)→+Y；(0,0)→+Z；(0,90°E)→+X」三锚点直接蕴含、独立于
  // latLonToVector3 内部三角公式的不变量（不移植公式再自证，类比 M1-14 禁区）。
  const RADIUS = 1

  it('向量模长 = 半径（球面坐标定义性质，与四源全部真实坐标点核对，SPEC-6.2）', () => {
    for (const e of allEvents) {
      const v = latLonToVector3(e.lat, e.lon, RADIUS)
      const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
      expect(len).toBeCloseTo(RADIUS, 9)
    }
  })

  it('北极(90,·)→+Y 蕴含纬度符号决定 y 符号：lat>0→y>0，lat<0→y<0（SPEC-6.2）', () => {
    const withNonZeroLat = allEvents.filter((e) => Math.abs(e.lat) > 0.001)
    expect(withNonZeroLat.length).toBeGreaterThan(0) // 前置：确有非赤道样本可测
    for (const e of withNonZeroLat) {
      const v = latLonToVector3(e.lat, e.lon)
      if (e.lat > 0) expect(v.y).toBeGreaterThan(0)
      else expect(v.y).toBeLessThan(0)
    }
  })

  it('(0,0)→+Z 与 (0,90°E)→+X 蕴含经度符号决定 x 符号：0°<lon<180°→x>0，−180°<lon<0°→x<0（SPEC-6.2，跳过 |lon|<1° 与 |180−|lon||<1° 边界噪声带）', () => {
    const samples = allEvents.filter(
      (e) => Math.abs(e.lon) > 1 && Math.abs(180 - Math.abs(e.lon)) > 1,
    )
    expect(samples.length).toBeGreaterThan(0) // 前置：确有非边界样本可测
    for (const e of samples) {
      const v = latLonToVector3(e.lat, e.lon)
      if (e.lon > 0) expect(v.x).toBeGreaterThan(0)
      else expect(v.x).toBeLessThan(0)
    }
  })

  it('|lon|<90°→z>0，|lon|>90°→z<0（SPEC-6.2 由 (0,0)→+Z 与 (0,90°E)→+X 蕴含，跳过 |90−|lon||<1° 边界噪声带）', () => {
    const samples = allEvents.filter((e) => Math.abs(90 - Math.abs(e.lon)) > 1)
    expect(samples.length).toBeGreaterThan(0) // 前置：确有非边界样本可测
    for (const e of samples) {
      const v = latLonToVector3(e.lat, e.lon)
      if (Math.abs(e.lon) < 90) expect(v.z).toBeGreaterThan(0)
      else expect(v.z).toBeLessThan(0)
    }
  })
})

describe('GeoEvent 归一化——每源精确字段抽查（M2-01，逐源 1 条，不复述 M2-05~08 全量断言）', () => {
  it('usgs：id = usgs:{feature.id}（SPEC-5.1），首条真实 feature', () => {
    const raw = usgsFixture.features[0]
    const event = usgsEvents.find((e) => e.id === `usgs:${raw.id}`)
    expect(event).toBeDefined()
    expect(event!.urls).toEqual([raw.properties.url])
  })

  it('eonet：summary = categories[0].title（SPEC-5.2），首条真实 event', () => {
    const raw = eonetFixture.events[0]
    const event = eonetEvents.find((e) => e.id === `eonet:${raw.id}`)
    expect(event).toBeDefined()
    expect(event!.summary).toBe(raw.categories[0].title)
  })

  it('gdacs：title = name（SPEC-5.3），首个含 Point 要素的真实 eventid', () => {
    const firstPointFeature = gdacsFixture.features.find((f) => f.geometry.type === 'Point')!
    const eventid = String(firstPointFeature.properties.eventid)
    const event = gdacsEvents.find((e) => e.id === `gdacs:${eventid}`)
    expect(event).toBeDefined()
    expect(event!.title).toBe(firstPointFeature.properties.name)
  })

  it('ll2：ts = net（SPEC-5.5，Date.parse 直接得 UTC），首条真实 result', () => {
    const raw = ll2Fixture.results[0]
    const event = ll2Events.find((e) => e.id === `ll2:${raw.id}`)
    expect(event).toBeDefined()
    expect(event!.ts).toBe(Date.parse(raw.net))
  })
})
