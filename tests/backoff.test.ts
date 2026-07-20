import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { conditionalFetch } from '../src/data/http'
import { Scheduler } from '../src/data/scheduler'
import type { EventProvider, GeoEvent, ProviderResult } from '../src/data/types'

// M2-04：HTTP 失败退避、条件请求与故障隔离。期望值只从 doc/spec.md 推导：
// SPEC-5.0「HTTP 失败指数退避（基础间隔×2^n，上限 30min）；支持 ETag/Last-Modified 的源
// 带条件请求头；任何源故障不得影响其他源与渲染」。
// 退避公式与故障隔离用 src/data/scheduler.ts 的 Scheduler 验证；
// 条件请求头用 src/data/http.ts 的 conditionalFetch 验证。

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: { get: (key: string) => headers[key] ?? null },
    json: async () => body,
  } as unknown as Response
}

function failingProvider(source: EventProvider['source'], intervalMs: number) {
  const calls: number[] = []
  const provider: EventProvider = {
    source,
    intervalMs,
    poll: vi.fn(async (ctx) => {
      calls.push(ctx.now)
      throw new Error('boom')
    }),
  }
  return { provider, calls }
}

describe('conditionalFetch —— 条件请求头（SPEC-5.0 条件请求条款，M2-04）', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('源首次响应带 ETag 后，下一轮请求附带 If-None-Match', async () => {
    const url = 'https://test.example/etag-case'
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { a: 1 }, { ETag: '"v1"' }))
    await conditionalFetch(url, new AbortController().signal)

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { a: 2 }, { ETag: '"v2"' }))
    await conditionalFetch(url, new AbortController().signal)

    const secondCallInit = fetchMock.mock.calls[1][1] as { headers: Record<string, string> }
    expect(secondCallInit.headers['If-None-Match']).toBe('"v1"')
  })

  it('源首次响应带 Last-Modified 后，下一轮请求附带 If-Modified-Since', async () => {
    const url = 'https://test.example/lm-case'
    const lastModified = 'Wed, 01 Jan 2026 00:00:00 GMT'
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { a: 1 }, { 'Last-Modified': lastModified }))
    await conditionalFetch(url, new AbortController().signal)

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { a: 2 }, { 'Last-Modified': lastModified }))
    await conditionalFetch(url, new AbortController().signal)

    const secondCallInit = fetchMock.mock.calls[1][1] as { headers: Record<string, string> }
    expect(secondCallInit.headers['If-Modified-Since']).toBe(lastModified)
  })

  it('服务端返回 304 时视为 notModified（成立条件请求语义，SPEC-5.0）', async () => {
    const url = 'https://test.example/304-case'
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { a: 1 }, { ETag: '"v1"' }))
    await conditionalFetch(url, new AbortController().signal)

    fetchMock.mockResolvedValueOnce(jsonResponse(304, undefined))
    const result = await conditionalFetch(url, new AbortController().signal)

    expect(result).toEqual({ status: 'notModified' })
  })

  it('普通 200 响应解析 body 返回 ok 结果', async () => {
    const url = 'https://test.example/ok-case'
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { hello: 'world' }))
    const result = await conditionalFetch(url, new AbortController().signal)
    expect(result).toEqual({ status: 'ok', body: { hello: 'world' } })
  })
})

describe('Scheduler —— 指数退避公式 intervalMs×2^n，上限 30min（SPEC-5.0 退避条款，M2-04）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0) // 令 clock()=Date.now() 从确定性的 t=0 起算
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('连续失败的重试间隔按 intervalMs×2^n 递增（n=连续失败次数）', async () => {
    const intervalMs = 1_000
    const { provider, calls } = failingProvider('usgs', intervalMs)
    const scheduler = new Scheduler([provider], () => {})
    scheduler.start()

    await vi.advanceTimersByTimeAsync(0) // t=0：首轮失败，n=1，下次延迟=1000×2=2000
    expect(calls).toEqual([0])

    await vi.advanceTimersByTimeAsync(2_000) // t=2000：第2次失败，n=2，延迟=1000×4=4000
    expect(calls).toEqual([0, 2_000])

    await vi.advanceTimersByTimeAsync(4_000) // t=6000：第3次失败，n=3，延迟=1000×8=8000
    expect(calls).toEqual([0, 2_000, 6_000])

    await vi.advanceTimersByTimeAsync(8_000) // t=14000：第4次失败，n=4，延迟=1000×16=16000
    expect(calls).toEqual([0, 2_000, 6_000, 14_000])

    scheduler.stop()
  })

  it('退避延迟不超过 30 分钟上限——基础间隔较大时单次失败即触顶', async () => {
    const intervalMs = 20 * 60 * 1000 // 20min；×2^1=40min，超过 30min 上限
    const { provider, calls } = failingProvider('eonet', intervalMs)
    const scheduler = new Scheduler([provider], () => {})
    scheduler.start()

    await vi.advanceTimersByTimeAsync(0) // t=0：首轮失败
    expect(calls).toEqual([0])

    const cap = 30 * 60 * 1000
    await vi.advanceTimersByTimeAsync(cap - 1) // 未满 30min 上限，不应触发
    expect(calls).toEqual([0])

    await vi.advanceTimersByTimeAsync(1) // 满 30min，第2次触发
    expect(calls).toEqual([0, cap])

    scheduler.stop()
  })

  it('成功后退避计数归零，下次失败重新从 n=1 起算（呼应「连续」失败语义，SPEC-5.0）', async () => {
    const intervalMs = 1_000
    let callCount = 0
    const calls: number[] = []
    const provider: EventProvider = {
      source: 'usgs',
      intervalMs,
      poll: vi.fn(async (ctx) => {
        calls.push(ctx.now)
        callCount += 1
        if (callCount === 2) {
          const result: ProviderResult = { status: 'ok', events: [] }
          return result
        }
        throw new Error('boom')
      }),
    }
    const scheduler = new Scheduler([provider], () => {})
    scheduler.start()

    await vi.advanceTimersByTimeAsync(0) // t=0：第1次调用失败，n=1，延迟2000
    await vi.advanceTimersByTimeAsync(2_000) // t=2000：第2次调用成功，n 归零，延迟=intervalMs=1000
    await vi.advanceTimersByTimeAsync(1_000) // t=3000：第3次调用失败，n 从1重新起算，延迟=1000×2=2000
    await vi.advanceTimersByTimeAsync(2_000) // t=5000：第4次调用（验证延迟确为2000而非累积的8000）

    expect(calls).toEqual([0, 2_000, 3_000, 5_000])

    scheduler.stop()
  })
})

describe('Scheduler —— 持续故障隔离：不阻断其他源轮询（SPEC-5.0 故障隔离条款，M2-04）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('A 源连续多轮（>2 轮）故障期间，B 源持续按 intervalMs 正常轮询且回调持续触发', async () => {
    const a = failingProvider('usgs', 1_000)
    const receivedEvents: GeoEvent[][] = []
    const bCalls: number[] = []
    const b: EventProvider = {
      source: 'eonet',
      intervalMs: 1_000,
      poll: vi.fn(async (ctx) => {
        bCalls.push(ctx.now)
        const result: ProviderResult = {
          status: 'ok',
          events: [
            {
              id: `eonet:${ctx.now}`,
              category: 'disaster',
              severity: 1,
              title: 't',
              summary: 's',
              urls: ['https://example.com'],
              lat: 0,
              lon: 0,
              ts: ctx.now,
              source: 'eonet',
            },
          ],
        }
        return result
      }),
    }
    const scheduler = new Scheduler([a.provider, b], (events) => receivedEvents.push(events))
    scheduler.start()

    // 覆盖 6 轮（体现「持续」故障，超出 M2-03 两轮短程验证），确认 A 从未阻断 B 的调度或回调
    await vi.advanceTimersByTimeAsync(0)
    for (let round = 1; round <= 5; round += 1) {
      await vi.advanceTimersByTimeAsync(1_000)
    }

    expect(bCalls.length).toBe(6) // B 每轮均按 intervalMs 准时触发，未被 A 的持续故障打断
    expect(receivedEvents.length).toBe(6) // B 每轮回调均正常送达
    // A 自身退避中仍按公式重试（t=0 失败后延迟2000，t=2000 再次失败后延迟4000，
    // 下次到期于 t=6000 落在本窗口外），未因故障被永久停摆——而非「与 B 同频」
    expect(a.calls).toEqual([0, 2_000])

    scheduler.stop()
  })
})
