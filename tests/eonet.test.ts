// M2-06：NASA EONET provider 字段映射、坐标降维与 severity 默认值（SPEC-5.2）+ 结构不变量（SPEC-6.1）。
//
// 期望值来源（严格只从 doc/spec.md 推导，不读 src/data/providers/eonet.ts 的实现当期望）：
// - id：SPEC-5.2「id=eonet:{event.id}」。
// - 坐标：SPEC-5.2「坐标取 geometry 数组中时间最新的一条——其 type 为 Point 时取该点
//   [lon, lat]；为 Polygon/MultiPolygon 时取该 geometry 全部坐标点的经纬度包围盒中心
//   ((minLon+maxLon)/2, (minLat+maxLat)/2)」。「时间最新」由本文件对 geometry[].date 独立
//   取最大值验证，不搬用被测模块内部的选择算法；包围盒中心用构造的规则矩形坐标令 min/max
//   显而易见，避免对被测的拍平算法产生依赖。
// - summary：SPEC-5.2「categories[0].title 进 summary」。
// - urls：SPEC-5.2「sources[].url 为信源」——数组记号 `[]` 表示对 sources 全数组取 url，
//   非仅取首条。
// - severity：SPEC-5.2「severity 默认 2」。
// - 结构不变量：SPEC-6.1（category 属六值枚举之一、severity∈{1,2,3}、id 全局唯一格式
//   `{source}:{原始id}`、urls 非 flight 源须 ≥1、source 字段值）。
//
// fixture 抓取时间/来源 URL 见 tests/fixtures/README.md（本文件不重复登记）；fixture 全部 26
// 条 geometry 均为 Point 类型（已用脚本核实，见 M2-06 交付汇报），故 Polygon/MultiPolygon
// 降维分支 fixture 无真实样本覆盖，改用构造 geometry 测（注释标明构造原因，紧随 SPEC-5.2
// 引用其后）。

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeEonet } from '../src/data/providers/eonet'

const FIXTURE_DIR = path.dirname(fileURLToPath(import.meta.url))

interface EonetFixtureGeometry {
  date: string
  type: string
  coordinates: unknown
}
interface EonetFixtureEvent {
  id: string
  title: string
  categories: Array<{ id: string; title: string }>
  sources: Array<{ id: string; url: string }>
  geometry: EonetFixtureGeometry[]
}
interface EonetFixture {
  events: EonetFixtureEvent[]
}

const eonetFixture = JSON.parse(
  readFileSync(path.join(FIXTURE_DIR, 'fixtures/eonet_events.json'), 'utf-8'),
) as EonetFixture

const NOW = 1_753_000_000_000 // 占位抓取时钟，fixture 全部 geometry 均带 date 用不到该值

/** 独立于被测模块，对 geometry[].date 求最大值——不搬用 src 的选择算法 */
function referenceLatestByDate(geometries: EonetFixtureGeometry[]): EonetFixtureGeometry {
  return geometries.reduce((latest, g) =>
    Date.parse(g.date) >= Date.parse(latest.date) ? g : latest,
  )
}

describe('normalizeEonet —— 真实 fixture 字段映射（SPEC-5.2，M2-06）', () => {
  const events = normalizeEonet(eonetFixture, NOW)

  it('26 条真实 event 全部映射成功（fixture 抓取记录见 tests/fixtures/README.md）', () => {
    expect(events).toHaveLength(26)
  })

  it('id = eonet:{event.id}（SPEC-5.2）', () => {
    events.forEach((e, i) => {
      expect(e.id).toBe(`eonet:${eonetFixture.events[i].id}`)
    })
  })

  it('summary = categories[0].title（SPEC-5.2）', () => {
    events.forEach((e, i) => {
      expect(e.summary).toBe(eonetFixture.events[i].categories[0].title)
    })
  })

  it('urls = sources[].url 全数组映射（SPEC-5.2「sources[].url 为信源」）', () => {
    events.forEach((e, i) => {
      const expectedUrls = eonetFixture.events[i].sources.map((s) => s.url)
      expect(e.urls).toEqual(expectedUrls)
    })
  })

  it('多信源事件（EONET_6523/EONET_21373）urls 含全部 source url，非仅首条', () => {
    const multiSourceIds = ['EONET_6523', 'EONET_21373']
    for (const id of multiSourceIds) {
      const rawEvent = eonetFixture.events.find((e) => e.id === id)!
      const normalized = events.find((e) => e.id === `eonet:${id}`)!
      expect(rawEvent.sources.length).toBeGreaterThan(1)
      expect(normalized.urls).toHaveLength(rawEvent.sources.length)
    }
  })

  it('坐标取 geometry 数组中时间最新一条的 [lon,lat]（SPEC-5.2，独立求最大值校验）', () => {
    events.forEach((e, i) => {
      const latest = referenceLatestByDate(eonetFixture.events[i].geometry)
      expect(latest.type).toBe('Point') // fixture 全为 Point，已用脚本核实
      const coords = latest.coordinates as [number, number]
      expect(e.lon).toBe(coords[0])
      expect(e.lat).toBe(coords[1])
    })
  })

  it('多 geometry 事件 EONET_21399（3 条，时间递增）落点取最晚一条而非首条', () => {
    const raw = eonetFixture.events.find((e) => e.id === 'EONET_21399')!
    expect(raw.geometry).toHaveLength(3)
    const normalized = events.find((e) => e.id === 'eonet:EONET_21399')!
    const last = raw.geometry[raw.geometry.length - 1]
    const coords = last.coordinates as [number, number]
    expect(normalized.lon).toBe(coords[0])
    expect(normalized.lat).toBe(coords[1])
    // 反证：不等于首条坐标，证明确实选的是"最新"而非"第一条"
    const first = raw.geometry[0].coordinates as [number, number]
    expect([normalized.lon, normalized.lat]).not.toEqual([first[0], first[1]])
  })
})

describe('normalizeEonet —— severity 默认值（SPEC-5.2，M2-06）', () => {
  it('真实 fixture 全部事件 severity 恒为 2（SPEC-5.2「severity 默认 2」）', () => {
    const events = normalizeEonet(eonetFixture, NOW)
    for (const e of events) expect(e.severity).toBe(2)
  })
})

describe('normalizeEonet —— Polygon/MultiPolygon 坐标降维（SPEC-5.2，M2-06，构造 geometry）', () => {
  // fixture 无真实 Polygon/MultiPolygon 样本（已脚本核实全为 Point），故构造规则矩形坐标，
  // 令包围盒 min/max 显而易见，独立于被测的坐标拍平算法验证公式
  // ((minLon+maxLon)/2, (minLat+maxLat)/2)（SPEC-5.2）。

  it('Polygon：矩形四角坐标 (10,0)-(20,0)-(20,10)-(10,10) → 中心 (lon=15, lat=5)', () => {
    const raw = {
      events: [
        {
          id: 'CONSTRUCTED_POLY',
          title: 'Constructed Polygon Event',
          categories: [{ id: 'x', title: 'Test Category' }],
          sources: [{ id: 's', url: 'https://example.com/poly' }],
          geometry: [
            {
              date: '2026-01-01T00:00:00Z',
              type: 'Polygon',
              coordinates: [
                [
                  [10, 0],
                  [20, 0],
                  [20, 10],
                  [10, 10],
                  [10, 0],
                ],
              ],
            },
          ],
        },
      ],
    }
    const [event] = normalizeEonet(raw, NOW)
    expect(event.lon).toBe(15)
    expect(event.lat).toBe(5)
  })

  it('MultiPolygon：两个相距矩形 (0,0)-(10,10) 与 (20,20)-(30,30) → 中心 (lon=15, lat=15)', () => {
    const raw = {
      events: [
        {
          id: 'CONSTRUCTED_MULTIPOLY',
          title: 'Constructed MultiPolygon Event',
          categories: [{ id: 'x', title: 'Test Category' }],
          sources: [{ id: 's', url: 'https://example.com/multipoly' }],
          geometry: [
            {
              date: '2026-01-01T00:00:00Z',
              type: 'MultiPolygon',
              coordinates: [
                [
                  [
                    [0, 0],
                    [10, 0],
                    [10, 10],
                    [0, 10],
                    [0, 0],
                  ],
                ],
                [
                  [
                    [20, 20],
                    [30, 20],
                    [30, 30],
                    [20, 30],
                    [20, 20],
                  ],
                ],
              ],
            },
          ],
        },
      ],
    }
    const [event] = normalizeEonet(raw, NOW)
    expect(event.lon).toBe(15)
    expect(event.lat).toBe(15)
  })

  it('Polygon 为最新一条几何时，非最新的 Point 几何不参与包围盒计算（复合校验「时间最新」+ 降维公式）', () => {
    const raw = {
      events: [
        {
          id: 'CONSTRUCTED_MIXED',
          title: 'Constructed Mixed Geometry Event',
          categories: [{ id: 'x', title: 'Test Category' }],
          sources: [{ id: 's', url: 'https://example.com/mixed' }],
          geometry: [
            { date: '2026-01-01T00:00:00Z', type: 'Point', coordinates: [100, 50] }, // 更早，应被忽略
            {
              date: '2026-01-02T00:00:00Z', // 更晚，应被采用
              type: 'Polygon',
              coordinates: [
                [
                  [10, 0],
                  [20, 0],
                  [20, 10],
                  [10, 10],
                  [10, 0],
                ],
              ],
            },
          ],
        },
      ],
    }
    const [event] = normalizeEonet(raw, NOW)
    expect(event.lon).toBe(15)
    expect(event.lat).toBe(5)
  })
})

describe('normalizeEonet —— 结构不变量（SPEC-6.1，M2-06）', () => {
  const events = normalizeEonet(eonetFixture, NOW)

  it('category 恒为 disaster（SPEC-5.2「NASA EONET 自然事件 → category disaster」）', () => {
    for (const e of events) expect(e.category).toBe('disaster')
  })

  it('source 恒为 eonet（SPEC-6.1 source 字段枚举）', () => {
    for (const e of events) expect(e.source).toBe('eonet')
  })

  it('severity ∈ {1,2,3}（SPEC-6.1）', () => {
    for (const e of events) expect([1, 2, 3]).toContain(e.severity)
  })

  it('urls 非空数组（EONET 非 flight 源，SPEC-6.1「除 flight 外长度 ≥1」）', () => {
    for (const e of events) {
      expect(Array.isArray(e.urls)).toBe(true)
      expect(e.urls.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('id 形如 eonet:{原始id}（SPEC-6.1 `{source}:{原始id}`）', () => {
    for (const e of events) expect(e.id).toMatch(/^eonet:.+/)
  })
})
