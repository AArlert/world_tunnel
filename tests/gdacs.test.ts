// M2-07：GDACS provider 字段映射、eventid 分组坐标与 UTC 时间解析（SPEC-5.3）+ 结构不变量（SPEC-6.1）。
//
// 期望值来源（严格只从 doc/spec.md 推导，不读 src/data/providers/gdacs.ts 的实现当期望）：
// - 分组：SPEC-5.3「归一化按 eventid 分组，每组产出一个事件（去重键 gdacs:{eventid} 亦合并
//   同 eventid 的多要素）」——fixture 唯一 eventid 数（脚本核实为 25）即预期产出事件数。
// - 坐标：SPEC-5.3「坐标：取该 eventid 全部 geometry.type='Point' 中心点要素坐标的经纬度
//   包围盒中心 ((minLon+maxLon)/2,(minLat+maxLat)/2)（单点退化为该点本身）；Polygon/LineString
//   要素仅为几何细节，不单独成事件、不参与取坐标」——本文件独立对原始 fixture 的 Point 坐标求
//   min/max，不搬用被测模块内部的分组/包围盒算法。
// - 字段：SPEC-5.3「id=gdacs:{eventid}；title=name；summary=htmldescription；urls=[url.report]；
//   ts=datemodified」。
// - UTC 解析：SPEC-5.3「GDACS 时间戳为 UTC 且无时区后缀，归一化须显式按 UTC 解析（补 Z 或等价），
//   不得依赖 Date.parse 的本地时区解释」——期望值一律用 Date.UTC(...) 显式计算，不使用会受本地
//   时区影响的 Date.parse 无后缀字符串。
// - severity：SPEC-5.3「alertlevel Green/Orange/Red → 1/2/3」——真实 fixture 只覆盖 Green/Orange
//   （脚本核实），Red 档改构造输入测。
// - category：SPEC-5.3「eventtype ∈ {DR, FL} → humanitarian，其余（EQ/TC/…）→ disaster」。
// - 结构不变量：SPEC-6.1（category 属六值枚举之一、severity∈{1,2,3}、id 全局唯一格式
//   `{source}:{原始id}`、urls 非 flight 源须 ≥1、source 字段值）。
//
// fixture 抓取时间/来源 URL 见 tests/fixtures/README.md（本文件不重复登记）。fixture 分组结构
// （唯一 eventid 数、各分组要素类型构成、alertlevel/eventtype 取值分布）已用脚本探查核实，
// 未整读 634KB 原始文件。

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeGdacs } from '../src/data/providers/gdacs'

const FIXTURE_DIR = path.dirname(fileURLToPath(import.meta.url))

interface GdacsFixtureFeature {
  geometry: { type: string; coordinates: unknown }
  properties: {
    eventid: number
    eventtype: string
    name: string
    htmldescription: string
    url: { report: string }
    datemodified: string
    alertlevel: string
  }
}
interface GdacsFixture {
  features: GdacsFixtureFeature[]
}

const gdacsFixture = JSON.parse(
  readFileSync(path.join(FIXTURE_DIR, 'fixtures/gdacs_eventlist.json'), 'utf-8'),
) as GdacsFixture

const NOW = 1_753_100_000_000 // 占位抓取时钟，fixture 全部条目均带 datemodified 用不到该值

/** 独立于被测模块，对原始 fixture 的 Point 要素坐标求经纬度包围盒中心——不搬用 src 的分组算法 */
function referenceBboxCenter(coordsList: Array<[number, number]>): { lat: number; lon: number } {
  const lons = coordsList.map((c) => c[0])
  const lats = coordsList.map((c) => c[1])
  return {
    lon: (Math.min(...lons) + Math.max(...lons)) / 2,
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
  }
}

function pointFeaturesOf(eventid: string): GdacsFixtureFeature[] {
  return gdacsFixture.features.filter(
    (f) => String(f.properties.eventid) === eventid && f.geometry.type === 'Point',
  )
}

describe('normalizeGdacs —— 真实 fixture 分组与坐标（SPEC-5.3，M2-07）', () => {
  const events = normalizeGdacs(gdacsFixture, NOW)

  it('唯一 eventid 分组数（脚本核实为 25）＝产出事件数，证明按 eventid 分组去重（SPEC-5.3）', () => {
    const uniqueEventIds = new Set(gdacsFixture.features.map((f) => String(f.properties.eventid)))
    expect(uniqueEventIds.size).toBe(25)
    expect(events).toHaveLength(25)
  })

  it('id = gdacs:{eventid}，每个唯一 eventid 恰好对应一条事件（SPEC-5.3）', () => {
    const uniqueEventIds = new Set(gdacsFixture.features.map((f) => String(f.properties.eventid)))
    for (const eventid of uniqueEventIds) {
      const matches = events.filter((e) => e.id === `gdacs:${eventid}`)
      expect(matches).toHaveLength(1)
    }
  })

  it('单 Point 分组（eventid=1552752，另含 1 条 Polygon 细节）坐标＝该 Point 坐标本身，Polygon 不参与取坐标（SPEC-5.3）', () => {
    // fixture 校验：该 eventid 下只有 1 条 Point 要素 + 1 条 Polygon 要素；Polygon 的经纬度范围
    // （约 lon -76.2~-74.4／lat -12.9~-11.1）明显不同于 Point 坐标，若被误纳入包围盒计算，
    // 坐标必然偏离 Point 坐标——故本断言同时证明了「单点退化」与「Polygon 不参与取坐标」两条。
    const pts = pointFeaturesOf('1552752')
    expect(pts).toHaveLength(1)
    const [lon, lat] = pts[0].geometry.coordinates as [number, number]
    const event = events.find((e) => e.id === 'gdacs:1552752')!
    expect(event.lon).toBe(lon)
    expect(event.lat).toBe(lat)
  })

  it('多 Point 分组（eventid=1018546）坐标＝全部 Point 要素经纬度包围盒中心（SPEC-5.3，独立计算）', () => {
    const pts = pointFeaturesOf('1018546')
    expect(pts.length).toBeGreaterThan(1)
    const expected = referenceBboxCenter(pts.map((f) => f.geometry.coordinates as [number, number]))
    const event = events.find((e) => e.id === 'gdacs:1018546')!
    expect(event.lon).toBeCloseTo(expected.lon, 9)
    expect(event.lat).toBeCloseTo(expected.lat, 9)
  })

  it('title=name、summary=htmldescription、urls=[url.report]（SPEC-5.3，eventid=1552752）', () => {
    const props = pointFeaturesOf('1552752')[0].properties
    const event = events.find((e) => e.id === 'gdacs:1552752')!
    expect(event.title).toBe(props.name)
    expect(event.summary).toBe(props.htmldescription)
    expect(event.urls).toEqual([props.url.report])
  })
})

describe('normalizeGdacs —— category 分支（SPEC-5.3，M2-07，真实 fixture）', () => {
  const events = normalizeGdacs(gdacsFixture, NOW)

  it('eventtype=DR（eventid=1018546）→ category humanitarian（SPEC-5.3）', () => {
    const event = events.find((e) => e.id === 'gdacs:1018546')!
    expect(event.category).toBe('humanitarian')
  })

  it('eventtype=FL（eventid=1103888）→ category humanitarian（SPEC-5.3）', () => {
    const event = events.find((e) => e.id === 'gdacs:1103888')!
    expect(event.category).toBe('humanitarian')
  })

  it('eventtype=EQ（eventid=1552752）→ category disaster（SPEC-5.3「其余（EQ/TC/…）→ disaster」）', () => {
    const event = events.find((e) => e.id === 'gdacs:1552752')!
    expect(event.category).toBe('disaster')
  })

  it('eventtype=TC（eventid=1001282）→ category disaster（SPEC-5.3「其余（EQ/TC/…）→ disaster」）', () => {
    const event = events.find((e) => e.id === 'gdacs:1001282')!
    expect(event.category).toBe('disaster')
  })
})

describe('normalizeGdacs —— severity（SPEC-5.3，M2-07）', () => {
  const events = normalizeGdacs(gdacsFixture, NOW)

  it('真实 fixture：alertlevel=Green（eventid=1103888）→ severity 1（SPEC-5.3）', () => {
    const event = events.find((e) => e.id === 'gdacs:1103888')!
    expect(event.severity).toBe(1)
  })

  it('真实 fixture：alertlevel=Orange（eventid=1552752）→ severity 2（SPEC-5.3）', () => {
    const event = events.find((e) => e.id === 'gdacs:1552752')!
    expect(event.severity).toBe(2)
  })

  it.each([
    ['Green', 1],
    ['Orange', 2],
    ['Red', 3], // 真实 fixture 无 Red 样本（脚本核实），构造输入补齐
  ])('构造输入：alertlevel=%s → severity=%s（SPEC-5.3，Red 档无真实样本覆盖）', (alertlevel, expectedSeverity) => {
    const raw = {
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0, 0] },
          properties: {
            eventid: 900001,
            eventtype: 'EQ',
            name: 'Constructed Event',
            htmldescription: 'Constructed description',
            url: { report: 'https://example.com/report' },
            datemodified: '2026-01-01T00:00:00',
            alertlevel,
          },
        },
      ],
    }
    const [event] = normalizeGdacs(raw, NOW)
    expect(event.severity).toBe(expectedSeverity)
  })
})

describe('normalizeGdacs —— UTC 时间戳显式解析（SPEC-5.3，M2-07）', () => {
  it('真实 fixture：datemodified 无时区后缀（eventid=1552752，"2026-07-20T14:02:43"）按显式 UTC 解析（SPEC-5.3）', () => {
    const events = normalizeGdacs(gdacsFixture, NOW)
    const event = events.find((e) => e.id === 'gdacs:1552752')!
    // 期望值用 Date.UTC(...) 显式计算，不使用会受本地时区影响的 Date.parse 无后缀字符串
    expect(event.ts).toBe(Date.UTC(2026, 6, 20, 14, 2, 43))
  })

  it('构造输入：无时区后缀字符串按 UTC 解析（补 Z 等价，SPEC-5.3）', () => {
    const raw = {
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0, 0] },
          properties: {
            eventid: 900002,
            eventtype: 'EQ',
            name: 'Constructed Event',
            htmldescription: 'Constructed description',
            url: { report: 'https://example.com/report' },
            datemodified: '2026-03-15T08:30:00',
            alertlevel: 'Green',
          },
        },
      ],
    }
    const [event] = normalizeGdacs(raw, NOW)
    expect(event.ts).toBe(Date.UTC(2026, 2, 15, 8, 30, 0))
  })

  it('构造输入：已带 Z 后缀的字符串原样按 UTC 解析，不重复追加（SPEC-5.3）', () => {
    const raw = {
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0, 0] },
          properties: {
            eventid: 900003,
            eventtype: 'EQ',
            name: 'Constructed Event',
            htmldescription: 'Constructed description',
            url: { report: 'https://example.com/report' },
            datemodified: '2026-03-15T08:30:00Z',
            alertlevel: 'Green',
          },
        },
      ],
    }
    const [event] = normalizeGdacs(raw, NOW)
    expect(event.ts).toBe(Date.UTC(2026, 2, 15, 8, 30, 0))
  })
})

describe('normalizeGdacs —— eventid 分组合并（SPEC-5.3，M2-07，构造输入）', () => {
  it('同一 eventid 下 Point + Polygon 两条要素合并为 1 个事件，坐标取 Point 要素（SPEC-5.3）', () => {
    const raw = {
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [10, 20] },
          properties: {
            eventid: 900004,
            eventtype: 'EQ',
            name: 'Constructed Grouped Event',
            htmldescription: 'Constructed description',
            url: { report: 'https://example.com/report' },
            datemodified: '2026-01-01T00:00:00',
            alertlevel: 'Green',
          },
        },
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [100, 100],
                [110, 100],
                [110, 110],
                [100, 110],
                [100, 100],
              ],
            ],
          },
          properties: {
            eventid: 900004,
            eventtype: 'EQ',
            name: 'Constructed Grouped Event',
            htmldescription: 'Constructed description',
            url: { report: 'https://example.com/report' },
            datemodified: '2026-01-01T00:00:00',
            alertlevel: 'Green',
          },
        },
      ],
    }
    const events = normalizeGdacs(raw, NOW)
    expect(events).toHaveLength(1)
    expect(events[0].lon).toBe(10)
    expect(events[0].lat).toBe(20)
  })
})

describe('normalizeGdacs —— 结构不变量（SPEC-6.1，M2-07）', () => {
  const events = normalizeGdacs(gdacsFixture, NOW)

  it('category ∈ {disaster, humanitarian}（SPEC-5.3「GDACS → category disaster 或 humanitarian」）', () => {
    for (const e of events) expect(['disaster', 'humanitarian']).toContain(e.category)
  })

  it('source 恒为 gdacs（SPEC-6.1 source 字段枚举）', () => {
    for (const e of events) expect(e.source).toBe('gdacs')
  })

  it('severity ∈ {1,2,3}（SPEC-6.1）', () => {
    for (const e of events) expect([1, 2, 3]).toContain(e.severity)
  })

  it('urls 非空数组（GDACS 非 flight 源，SPEC-6.1「除 flight 外长度 ≥1」）', () => {
    for (const e of events) {
      expect(Array.isArray(e.urls)).toBe(true)
      expect(e.urls.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('id 形如 gdacs:{原始id}（SPEC-6.1 `{source}:{原始id}`）', () => {
    for (const e of events) expect(e.id).toMatch(/^gdacs:.+/)
  })
})
