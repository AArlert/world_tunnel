// 条件请求：ETag/Last-Modified 进程内校验缓存 + 304 短路（SPEC-5.0）。
// 校验缓存无需持久化（SPEC-5.0 未要求跨会话保留 validator），按 url 键存于进程内 Map。

export type ConditionalResult =
  | { status: 'ok'; body: unknown }
  | { status: 'notModified' }

interface Validator {
  etag?: string
  lastModified?: string
}

/** 按 url 键的进程内校验缓存；不同 url 天然隔离，无需跨会话保留（DP §3.4） */
const validatorCache = new Map<string, Validator>()

/**
 * 带条件请求的 fetch：命中校验缓存则发 If-None-Match / If-Modified-Since。
 * - 304 → notModified（不读 body、不更新 validator，SPEC-5.0）；
 * - 非 2xx/304 → throw，交 scheduler 退避（SPEC-5.0）；
 * - 2xx → 解析 JSON 并按响应头刷新 validator（无 validator 的源退化为普通 GET，DP §4.2）。
 */
export async function conditionalFetch(url: string, signal: AbortSignal): Promise<ConditionalResult> {
  const headers: Record<string, string> = {}
  const cached = validatorCache.get(url)
  if (cached?.etag) headers['If-None-Match'] = cached.etag
  if (cached?.lastModified) headers['If-Modified-Since'] = cached.lastModified

  const res = await fetch(url, { headers, signal })

  // 304：命中校验缓存，无新数据；保留原 validator（SPEC-5.0）
  if (res.status === 304) return { status: 'notModified' }

  // 非 2xx/304 一律抛错（SPEC-5.0 故障隔离）
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} @ ${url}`)

  // 记录本次 validator；源不返回 validator 时清掉旧值，下轮退化为普通 GET
  const etag = res.headers.get('ETag') ?? undefined
  const lastModified = res.headers.get('Last-Modified') ?? undefined
  if (etag || lastModified) validatorCache.set(url, { etag, lastModified })
  else validatorCache.delete(url)

  const body: unknown = await res.json()
  return { status: 'ok', body }
}
