// USGS 地震信源：归一化 + 条件请求轮询（SPEC-5.1）。
// 启动首轮拉 all_day 回填（覆盖过去 24h，天然含 all_hour 子集），此后常规轮询走 all_hour。

import { conditionalFetch } from '../http'
import type { EventProvider, GeoEvent, PollContext, ProviderResult } from '../types'

/** 轮询间隔 60s（SPEC-5.1） */
export const USGS_INTERVAL_MS = 60 * 1000

const ALL_HOUR_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson'
const ALL_DAY_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson'

/** severity 三档：mag<4.5→1，4.5≤mag<6→2，mag≥6→3（SPEC-5.1） */
function severityFromMag(mag: number): 1 | 2 | 3 {
  if (mag >= 6) return 3
  if (mag >= 4.5) return 2
  return 1
}

interface UsgsFeature {
  id?: unknown
  properties?: {
    mag?: unknown
    place?: unknown
    time?: unknown
    url?: unknown
  }
  geometry?: {
    type?: unknown
    coordinates?: unknown
  }
}

/** 单条 feature 归一化；缺失必填字段返回 null，由调用方留痕丢弃（不抛断全轮） */
function normalizeFeature(feature: UsgsFeature, now: number): GeoEvent | null {
  const id = feature.id
  const mag = feature.properties?.mag
  const place = feature.properties?.place
  const time = feature.properties?.time
  const url = feature.properties?.url
  const geometry = feature.geometry
  const coords = geometry?.coordinates

  if (
    typeof id !== 'string' ||
    typeof mag !== 'number' ||
    typeof place !== 'string' ||
    typeof url !== 'string' ||
    geometry?.type !== 'Point' ||
    !Array.isArray(coords) ||
    typeof coords[0] !== 'number' ||
    typeof coords[1] !== 'number'
  ) {
    return null
  }

  return {
    id: `usgs:${id}`,
    category: 'disaster',
    severity: severityFromMag(mag),
    title: `M${mag} ${place}`,
    summary: '', // SPEC-5.1 未给出 summary 字段来源，留空串（SPEC-6.1 允许）
    urls: [url],
    lat: coords[1],
    lon: coords[0],
    ts: typeof time === 'number' ? time : now, // 无则用抓取时间（SPEC-6.1）
    source: 'usgs',
  }
}

/**
 * USGS geojson FeatureCollection 归一化为 GeoEvent[]（SPEC-5.1）。
 * 纯函数，now 显式注入（DP §4.1）；单条 feature 校验失败则跳过并 console 留痕，不抛断全轮。
 */
export function normalizeUsgs(raw: unknown, now: number): GeoEvent[] {
  const features = (raw as { features?: unknown } | null)?.features
  if (!Array.isArray(features)) return []

  const events: GeoEvent[] = []
  for (const feature of features as UsgsFeature[]) {
    const event = normalizeFeature(feature, now)
    if (event === null) {
      console.warn('[usgs] 跳过缺失必填字段的 feature', feature)
      continue
    }
    events.push(event)
  }
  return events
}

/** USGS provider：首轮拉 all_day 回填，常规轮询走 all_hour（SPEC-5.1） */
export const usgsProvider: EventProvider = {
  source: 'usgs',
  intervalMs: USGS_INTERVAL_MS,
  async poll(ctx: PollContext): Promise<ProviderResult> {
    const url = ctx.firstRun ? ALL_DAY_URL : ALL_HOUR_URL
    const result = await conditionalFetch(url, ctx.signal)
    if (result.status === 'notModified') return { status: 'notModified' }
    return { status: 'ok', events: normalizeUsgs(result.body, ctx.now) }
  },
}
