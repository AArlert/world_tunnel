// Launch Library 2 火箭发射信源：归一化 + 条件请求轮询（SPEC-5.5，REV-008 仲裁 pin）。
// 走 mode=detailed 端点（唯一含发射工位坐标的模式，REV-008 裁决②），limit=10，轮询 1800s。

import { conditionalFetch } from '../http'
import type { EventProvider, GeoEvent, PollContext, ProviderResult } from '../types'

/** 轮询间隔 1800s，预算 ≤2 req/h（SPEC-5.5） */
export const LL2_INTERVAL_MS = 1800 * 1000

const FEED_URL = 'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=10&mode=detailed'

/** 1h/24h 边界换算为毫秒 */
const ONE_HOUR_MS = 60 * 60 * 1000
const ONE_DAY_MS = 24 * ONE_HOUR_MS

interface Ll2UrlEntry {
  url?: unknown
}

interface Ll2Result {
  id?: unknown
  name?: unknown
  net?: unknown
  url?: unknown
  mission?: { description?: unknown } | null
  pad?: { latitude?: unknown; longitude?: unknown } | null
  infoURLs?: unknown
  vidURLs?: unknown
}

/**
 * severity：net 相对 now 的剩余时间，仅未来方向计入——T-1h 内 3，T-24h 内 2，其余 1；
 * net 已过去（diff ≤ 0）不取绝对值双向对称，直接归其余档 = 1（SPEC-5.5，BUG-019/REV-009）。
 */
function severityFromNet(netTime: number, now: number): 1 | 2 | 3 {
  const diff = netTime - now
  if (diff <= 0) return 1
  if (diff <= ONE_HOUR_MS) return 3
  if (diff <= ONE_DAY_MS) return 2
  return 1
}

/** 从 infoURLs/vidURLs 条目数组取出 url 字符串列表 */
function collectUrls(entries: unknown): string[] {
  if (!Array.isArray(entries)) return []
  return entries
    .map((e) => (e as Ll2UrlEntry).url)
    .filter((u): u is string => typeof u === 'string')
}

/** 单条 result 归一化；缺失必填字段返回 null，由调用方留痕丢弃（不抛断全轮） */
function normalizeResult(result: Ll2Result, now: number): GeoEvent | null {
  const id = result.id
  const name = result.name
  const net = result.net
  const lat = result.pad?.latitude
  const lon = result.pad?.longitude

  if (typeof id !== 'string' || typeof name !== 'string' || typeof net !== 'string') return null
  if (typeof lat !== 'string' || typeof lon !== 'string') return null

  const latNum = Number(lat) // 字符串数值 parse 为 number（SPEC-5.5）
  const lonNum = Number(lon)
  if (Number.isNaN(latNum) || Number.isNaN(lonNum)) return null

  const netTime = Date.parse(net)
  const ts = Number.isNaN(netTime) ? now : netTime // 无则用抓取时间（SPEC-6.1）

  const summary = typeof result.mission?.description === 'string' ? result.mission.description : ''

  let urls = [...collectUrls(result.infoURLs), ...collectUrls(result.vidURLs)]
  if (urls.length === 0 && typeof result.url === 'string') urls = [result.url] // 皆空回落自链 url（SPEC-5.5）
  if (urls.length === 0) return null // urls≥1（SPEC-6.1）

  return {
    id: `ll2:${id}`,
    category: 'launch',
    severity: severityFromNet(ts, now),
    title: name,
    summary,
    urls,
    lat: latNum,
    lon: lonNum,
    ts,
    source: 'll2',
  }
}

/**
 * LL2 upcoming（mode=detailed）响应归一化为 GeoEvent[]（SPEC-5.5）。
 * 纯函数，now 显式注入（DP §4.1）；单条 result 校验失败则跳过并 console 留痕，不抛断全轮。
 */
export function normalizeLl2(raw: unknown, now: number): GeoEvent[] {
  const results = (raw as { results?: unknown } | null)?.results
  if (!Array.isArray(results)) return []

  const events: GeoEvent[] = []
  for (const result of results as Ll2Result[]) {
    const event = normalizeResult(result, now)
    if (event === null) {
      console.warn('[ll2] 跳过缺失必填字段的 result', result)
      continue
    }
    events.push(event)
  }
  return events
}

/** LL2 provider（SPEC-5.5） */
export const ll2Provider: EventProvider = {
  source: 'll2',
  intervalMs: LL2_INTERVAL_MS,
  async poll(ctx: PollContext): Promise<ProviderResult> {
    const result = await conditionalFetch(FEED_URL, ctx.signal)
    if (result.status === 'notModified') return { status: 'notModified' }
    return { status: 'ok', events: normalizeLl2(result.body, ctx.now) }
  },
}
