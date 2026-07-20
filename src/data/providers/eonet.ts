// NASA EONET 自然事件信源：归一化 + 条件请求轮询（SPEC-5.2）。
// 坐标取 geometry 数组中时间最新的一条：Point 直接取点，Polygon/MultiPolygon 取全部坐标点的
// 经纬度包围盒中心（Point 为其单点退化情形，G-1 已裁入 SPEC-5.2）。

import { conditionalFetch } from '../http'
import type { EventProvider, GeoEvent, PollContext, ProviderResult } from '../types'

/** 轮询间隔 300s（SPEC-5.2） */
export const EONET_INTERVAL_MS = 300 * 1000

/** SPEC-5.2 未给出 severity 字段来源，统一默认 2 */
const DEFAULT_SEVERITY = 2

const FEED_URL = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=7'

interface EonetGeometry {
  date?: unknown
  type?: unknown
  coordinates?: unknown
}

interface EonetEvent {
  id?: unknown
  title?: unknown
  categories?: unknown
  sources?: unknown
  geometry?: unknown
}

/** 递归拍平 Polygon/MultiPolygon 的嵌套坐标数组为 [lon, lat] 列表 */
function flattenCoordinates(coords: unknown): Array<[number, number]> {
  if (!Array.isArray(coords)) return []
  if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    return [[coords[0] as number, coords[1] as number]]
  }
  const points: Array<[number, number]> = []
  for (const c of coords) points.push(...flattenCoordinates(c))
  return points
}

/** geometry 数组中取 date 最新的一条（SPEC-5.2） */
function latestGeometry(geometries: EonetGeometry[]): EonetGeometry | null {
  let latest: EonetGeometry | null = null
  let latestTime = -Infinity
  for (const g of geometries) {
    const t = typeof g.date === 'string' ? Date.parse(g.date) : NaN
    if (Number.isNaN(t)) continue
    if (t >= latestTime) {
      latestTime = t
      latest = g
    }
  }
  return latest
}

/**
 * Point 取该点 [lon, lat]；Polygon/MultiPolygon 取全部坐标点经纬度包围盒中心
 * `((minLon+maxLon)/2, (minLat+maxLat)/2)`（SPEC-5.2）。
 */
function geometryToLatLon(geometry: EonetGeometry): { lat: number; lon: number } | null {
  if (geometry.type === 'Point') {
    const coords = geometry.coordinates
    if (!Array.isArray(coords) || typeof coords[0] !== 'number' || typeof coords[1] !== 'number') return null
    return { lat: coords[1], lon: coords[0] }
  }

  const points = flattenCoordinates(geometry.coordinates)
  if (points.length === 0) return null
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
  return { lat: (minLat + maxLat) / 2, lon: (minLon + maxLon) / 2 }
}

/** 单条 event 归一化；缺失必填字段返回 null，由调用方留痕丢弃（不抛断全轮） */
function normalizeEvent(ev: EonetEvent, now: number): GeoEvent | null {
  const id = ev.id
  const title = ev.title
  if (typeof id !== 'string' || typeof title !== 'string') return null

  const geometries = Array.isArray(ev.geometry) ? (ev.geometry as EonetGeometry[]) : []
  const latest = latestGeometry(geometries)
  if (latest === null) return null
  const latLon = geometryToLatLon(latest)
  if (latLon === null) return null

  const categories = Array.isArray(ev.categories) ? ev.categories : []
  const firstCategory = categories[0] as { title?: unknown } | undefined
  const summary = typeof firstCategory?.title === 'string' ? firstCategory.title : '' // categories[0].title 进 summary（SPEC-5.2）

  const sources = Array.isArray(ev.sources) ? ev.sources : []
  const urls = sources
    .map((s) => (s as { url?: unknown }).url)
    .filter((u): u is string => typeof u === 'string')
  if (urls.length === 0) return null // urls≥1（SPEC-6.1）

  const ts = typeof latest.date === 'string' ? Date.parse(latest.date) : now // 无则用抓取时间（SPEC-6.1）

  return {
    id: `eonet:${id}`,
    category: 'disaster',
    severity: DEFAULT_SEVERITY,
    title,
    summary,
    urls,
    lat: latLon.lat,
    lon: latLon.lon,
    ts,
    source: 'eonet',
  }
}

/**
 * EONET events 数组归一化为 GeoEvent[]（SPEC-5.2）。
 * 纯函数，now 显式注入（DP §4.1）；单条 event 校验失败则跳过并 console 留痕，不抛断全轮。
 */
export function normalizeEonet(raw: unknown, now: number): GeoEvent[] {
  const rawEvents = (raw as { events?: unknown } | null)?.events
  if (!Array.isArray(rawEvents)) return []

  const events: GeoEvent[] = []
  for (const ev of rawEvents as EonetEvent[]) {
    const event = normalizeEvent(ev, now)
    if (event === null) {
      console.warn('[eonet] 跳过缺失必填字段的 event', ev)
      continue
    }
    events.push(event)
  }
  return events
}

/** EONET provider（SPEC-5.2） */
export const eonetProvider: EventProvider = {
  source: 'eonet',
  intervalMs: EONET_INTERVAL_MS,
  async poll(ctx: PollContext): Promise<ProviderResult> {
    const result = await conditionalFetch(FEED_URL, ctx.signal)
    if (result.status === 'notModified') return { status: 'notModified' }
    return { status: 'ok', events: normalizeEonet(result.body, ctx.now) }
  },
}
