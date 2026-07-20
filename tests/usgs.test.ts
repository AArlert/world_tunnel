// M2-05：USGS provider 字段映射、severity 三档与启动回填（SPEC-5.1）+ 结构不变量（SPEC-6.1）。
//
// 期望值来源（严格只从 doc/spec.md 推导，不读 src/data/providers/usgs.ts 的实现当期望）：
// - 字段映射：SPEC-5.1「映射：id=usgs:{feature.id}；title=M{mag} {place}；lat/lon=geometry；
//   ts=properties.time；url=properties.url」。
// - lat/lon 坐标序：SPEC-5.1 本身未写明 geometry.coordinates 数组的下标含义，但 USGS 该接口
//   是标准 GeoJSON（url 以 .geojson 结尾），坐标序 [经度,纬度,(海拔)] 为 RFC 7946 §3.1.1 通用
//   文件格式约定（外部公开标准，非本仓库实现选择）；同一约定也见于 SPEC-5.2 对 EONET Point
//   的显式表述「取该点 [lon, lat]」。为避免仅凭下标假设作数值断言，本文件额外用真实地理常识
//   交叉验证：fixture 里的 4 条真实地震分别位于夏威夷（约 19°N/155°W）与德州（约 31–32°N/
//   101–104°W）——这两处地理位置为公开常识，与源码实现无关。
// - severity 三档：SPEC-5.1「mag<4.5→1，4.5≤mag<6→2，mag≥6→3」——fixture 里的震级均 <4.5
//   （见 tests/fixtures/README.md 抓取记录），边界值 4.5/6.0 改用构造输入测，不依赖 fixture
//   恰好命中边界。
// - 启动回填：SPEC-5.1「启动时先拉 all_day.geojson 回填」，其余轮询走 all_hour.geojson——
//   验证 provider.poll 依 ctx.firstRun 请求不同 URL（URL 原文摘自 SPEC-5.1）。
// - 结构不变量：SPEC-6.1（category 属六值枚举之一、severity∈{1,2,3}、id 全局唯一格式
//   `{source}:{原始id}`、urls 非 flight 源须 ≥1、source 字段值）。
//
// fixture 抓取时间/来源 URL 见 tests/fixtures/README.md（本文件不重复登记）。

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeUsgs, usgsProvider } from '../src/data/providers/usgs'
import type { PollContext } from '../src/data/types'

const FIXTURE_DIR = path.dirname(fileURLToPath(import.meta.url))
const usgsAllHourFixture = JSON.parse(
  readFileSync(path.join(FIXTURE_DIR, 'fixtures/usgs_all_hour.json'), 'utf-8'),
) as {
  features: Array<{
    id: string
    properties: { mag: number; place: string; time: number; url: string }
    geometry: { coordinates: [number, number, number] }
  }>
}

const NOW = 1_700_000_000_000 // 占位抓取时钟，fixture 全部条目均带 properties.time 用不到该值

function makeUsgsFeature(overrides: {
  id?: string
  mag?: number
  place?: string
  time?: number
  url?: string
  coordinates?: [number, number]
}) {
  return {
    id: overrides.id ?? 'test1',
    type: 'Feature',
    properties: {
      mag: overrides.mag ?? 1,
      place: overrides.place ?? 'Test Place',
      time: overrides.time ?? NOW,
      url: overrides.url ?? 'https://earthquake.usgs.gov/earthquakes/eventpage/test1',
    },
    geometry: {
      type: 'Point',
      coordinates: overrides.coordinates ?? [0, 0],
    },
  }
}

describe('normalizeUsgs —— 真实 fixture 字段映射（SPEC-5.1，M2-05）', () => {
  const events = normalizeUsgs(usgsAllHourFixture, NOW)

  it('4 条真实 feature 全部映射成功（fixture 抓取记录见 tests/fixtures/README.md）', () => {
    expect(events).toHaveLength(4)
  })

  it('id = usgs:{feature.id}（SPEC-5.1）', () => {
    events.forEach((e, i) => {
      expect(e.id).toBe(`usgs:${usgsAllHourFixture.features[i].id}`)
    })
  })

  it('title = M{mag} {place}（SPEC-5.1）', () => {
    events.forEach((e, i) => {
      const f = usgsAllHourFixture.features[i]
      expect(e.title).toBe(`M${f.properties.mag} ${f.properties.place}`)
    })
  })

  it('ts = properties.time，urls = [properties.url]（SPEC-5.1）', () => {
    events.forEach((e, i) => {
      const f = usgsAllHourFixture.features[i]
      expect(e.ts).toBe(f.properties.time)
      expect(e.urls).toEqual([f.properties.url])
    })
  })

  it('lat/lon 与 geometry 坐标一致，按 [经度,纬度] 序取值（SPEC-5.1 + RFC 7946）', () => {
    events.forEach((e, i) => {
      const coords = usgsAllHourFixture.features[i].geometry.coordinates
      expect(e.lon).toBe(coords[0])
      expect(e.lat).toBe(coords[1])
    })
  })

  it('地理常识交叉验证：夏威夷条目 lat≈19°N/lon≈155°W（公开地理常识，非源码）', () => {
    const hawaii = events.find((e) => e.id === 'usgs:hv75004902')
    expect(hawaii).toBeDefined()
    expect(hawaii!.lat).toBeGreaterThan(18)
    expect(hawaii!.lat).toBeLessThan(20)
    expect(hawaii!.lon).toBeGreaterThan(-157)
    expect(hawaii!.lon).toBeLessThan(-154)
  })

  it('地理常识交叉验证：德州条目 lat≈31–32°N/lon≈101–104°W（公开地理常识，非源码）', () => {
    const texasEvents = events.filter((e) => e.id.startsWith('usgs:tx'))
    expect(texasEvents.length).toBeGreaterThan(0)
    for (const e of texasEvents) {
      expect(e.lat).toBeGreaterThan(30)
      expect(e.lat).toBeLessThan(33)
      expect(e.lon).toBeGreaterThan(-105)
      expect(e.lon).toBeLessThan(-100)
    }
  })
})

describe('normalizeUsgs —— severity 三档边界（SPEC-5.1，M2-05，构造输入测边界）', () => {
  it.each([
    [4.49, 1], // mag<4.5 → 1
    [0, 1],
    [4.5, 2], // 4.5≤mag<6 → 2（左闭）
    [5.99, 2],
    [6, 3], // mag≥6 → 3（左闭）
    [8.5, 3],
  ])('mag=%s → severity=%s', (mag, expectedSeverity) => {
    const raw = { features: [makeUsgsFeature({ mag })] }
    const [event] = normalizeUsgs(raw, NOW)
    expect(event.severity).toBe(expectedSeverity)
  })
})

describe('normalizeUsgs —— 结构不变量（SPEC-6.1，M2-05）', () => {
  const events = normalizeUsgs(usgsAllHourFixture, NOW)

  it('category 恒为 disaster（SPEC-5.1「USGS 地震 → category disaster」）', () => {
    for (const e of events) expect(e.category).toBe('disaster')
  })

  it('source 恒为 usgs（SPEC-6.1 source 字段枚举）', () => {
    for (const e of events) expect(e.source).toBe('usgs')
  })

  it('severity ∈ {1,2,3}（SPEC-6.1）', () => {
    for (const e of events) expect([1, 2, 3]).toContain(e.severity)
  })

  it('urls 非空数组（USGS 非 flight 源，SPEC-6.1「除 flight 外长度 ≥1」）', () => {
    for (const e of events) {
      expect(Array.isArray(e.urls)).toBe(true)
      expect(e.urls.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('id 形如 usgs:{原始id}（SPEC-6.1 `{source}:{原始id}`）', () => {
    for (const e of events) expect(e.id).toMatch(/^usgs:.+/)
  })
})

describe('usgsProvider —— 启动回填 all_day，常规轮询 all_hour（SPEC-5.1，M2-05）', () => {
  it('ctx.firstRun=true 时请求 all_day.geojson，firstRun=false 时请求 all_hour.geojson', async () => {
    const requestedUrls: string[] = []
    const fetchMock = async (url: string) => {
      requestedUrls.push(url)
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: () => null },
        json: async () => ({ features: [] }),
      } as unknown as Response
    }

    const g = globalThis as { fetch: typeof fetch }
    const originalFetch = g.fetch
    g.fetch = fetchMock as typeof fetch
    try {
      const firstRunCtx: PollContext = { firstRun: true, now: NOW, signal: new AbortController().signal }
      await usgsProvider.poll(firstRunCtx)

      const laterCtx: PollContext = { firstRun: false, now: NOW, signal: new AbortController().signal }
      await usgsProvider.poll(laterCtx)
    } finally {
      g.fetch = originalFetch
    }

    // URL 原文摘自 SPEC-5.1
    expect(requestedUrls[0]).toBe(
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
    )
    expect(requestedUrls[1]).toBe(
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson',
    )
  })
})
