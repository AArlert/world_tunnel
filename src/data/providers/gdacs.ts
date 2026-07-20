// GDACS 灾害/人道信源：归一化 + 条件请求轮询（SPEC-5.3，REV-008 仲裁 pin）。
// 响应为 GeoJSON FeatureCollection，同一 eventid 出现多条要素（Point 中心点 + Polygon/LineString
// 几何细节）；归一化按 eventid 分组，每组产出一个事件，坐标取该组全部 Point 要素的经纬度包围盒中心。

import { conditionalFetch } from '../http'
import type { EventProvider, GeoEvent, PollContext, ProviderResult } from '../types'

/** 轮询间隔 300s（SPEC-5.3） */
export const GDACS_INTERVAL_MS = 300 * 1000

const FEED_URL = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP'

interface GdacsProperties {
  eventid?: unknown
  eventtype?: unknown
  name?: unknown
  htmldescription?: unknown
  url?: { report?: unknown }
  datemodified?: unknown
  alertlevel?: unknown
}

interface GdacsFeature {
  geometry?: { type?: unknown; coordinates?: unknown }
  properties?: GdacsProperties
}

/** severity：alertlevel Green/Orange/Red → 1/2/3（SPEC-5.3），未知取值判缺失 */
function severityFromAlertLevel(level: string): 1 | 2 | 3 | null {
  if (level === 'Green') return 1
  if (level === 'Orange') return 2
  if (level === 'Red') return 3
  return null
}

/**
 * GDACS 时间戳为 UTC 且无时区后缀，须显式按 UTC 解析（补 Z），不依赖 Date.parse 的本地时区解释
 * （SPEC-5.3）。已带时区标记（Z 或 ±HH:MM）的字符串原样解析，避免重复追加。
 */
function parseGdacsUtc(raw: string): number {
  const hasTimezone = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(raw)
  return Date.parse(hasTimezone ? raw : `${raw}Z`)
}

/**
 * 单个 eventid 分组归一化；坐标取组内全部 Point 要素坐标的经纬度包围盒中心（单点退化为该点本身，
 * SPEC-5.3）。事件级字段跨同 eventid 各要素一致，取组内第一个 Point 要素的 properties（SPEC-5.3）。
 * 缺失必填字段返回 null，由调用方留痕丢弃（不抛断全轮）。
 */
function normalizeGroup(eventid: string, features: GdacsFeature[], now: number): GeoEvent | null {
  const pointFeatures = features.filter((f) => f.geometry?.type === 'Point')
  const points: Array<[number, number]> = []
  for (const f of pointFeatures) {
    const coords = f.geometry?.coordinates
    if (Array.isArray(coords) && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      points.push([coords[0], coords[1]])
    }
  }
  if (points.length === 0) return null // 该 eventid 无 Point 中心点要素，无法取坐标

  let minLon = Infinity
  let maxLon = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity
  for (const [lon, lat] of points) {
    if (lon < minLon) minLon = lon
    if (lon > maxLon) maxLon = lon
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }

  const props = pointFeatures[0]?.properties
  const name = props?.name
  const htmldescription = props?.htmldescription
  const reportUrl = props?.url?.report
  const datemodified = props?.datemodified
  const alertlevel = props?.alertlevel
  const eventtype = props?.eventtype

  if (
    typeof name !== 'string' ||
    typeof htmldescription !== 'string' ||
    typeof reportUrl !== 'string' ||
    typeof datemodified !== 'string' ||
    typeof alertlevel !== 'string' ||
    typeof eventtype !== 'string'
  ) {
    return null
  }

  const severity = severityFromAlertLevel(alertlevel)
  if (severity === null) return null

  const ts = parseGdacsUtc(datemodified)

  return {
    id: `gdacs:${eventid}`,
    category: eventtype === 'DR' || eventtype === 'FL' ? 'humanitarian' : 'disaster', // SPEC-5.3（REV-008 裁决①方案 A）
    severity,
    title: name,
    summary: htmldescription,
    urls: [reportUrl],
    lat: (minLat + maxLat) / 2,
    lon: (minLon + maxLon) / 2,
    ts: Number.isNaN(ts) ? now : ts, // 无则用抓取时间（SPEC-6.1）
    source: 'gdacs',
  }
}

/**
 * GDACS GeoJSON FeatureCollection 归一化为 GeoEvent[]（SPEC-5.3）。
 * 纯函数，now 显式注入（DP §4.1）；按 eventid 分组，产出条数为唯一 eventid 数，非要素数。
 */
export function normalizeGdacs(raw: unknown, now: number): GeoEvent[] {
  const features = (raw as { features?: unknown } | null)?.features
  if (!Array.isArray(features)) return []

  const groups = new Map<string, GdacsFeature[]>()
  for (const feature of features as GdacsFeature[]) {
    const eventid = feature.properties?.eventid
    if (typeof eventid !== 'number' && typeof eventid !== 'string') continue
    const key = String(eventid)
    const group = groups.get(key)
    if (group) group.push(feature)
    else groups.set(key, [feature])
  }

  const events: GeoEvent[] = []
  for (const [eventid, groupFeatures] of groups) {
    const event = normalizeGroup(eventid, groupFeatures, now)
    if (event === null) {
      console.warn('[gdacs] 跳过缺失必填字段的 eventid', eventid)
      continue
    }
    events.push(event)
  }
  return events
}

/** GDACS provider（SPEC-5.3） */
export const gdacsProvider: EventProvider = {
  source: 'gdacs',
  intervalMs: GDACS_INTERVAL_MS,
  async poll(ctx: PollContext): Promise<ProviderResult> {
    const result = await conditionalFetch(FEED_URL, ctx.signal)
    if (result.status === 'notModified') return { status: 'notModified' }
    return { status: 'ok', events: normalizeGdacs(result.body, ctx.now) }
  },
}
