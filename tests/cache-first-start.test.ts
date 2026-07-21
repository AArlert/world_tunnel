import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDataLayer } from '../src/data'
import { EventCache } from '../src/data/cache'
import type { GeoEvent, StoredRecord } from '../src/data/types'

// M2-20：缓存优先启动——冷启动先渲染本地缓存事件、不空屏等待网络（数据层启动顺序）。
// 期望值只从 doc/spec.md 推导（断言注释逐条标 SPEC 条目）：
//   - SPEC-3.11「冷启动即渲染上次本地缓存事件（球面标记），不空屏等待网络。……缓存从
//     『可重建、不承诺』升格为启动路径的一部分（SPEC-8.4）。」——本场景以「store（事件
//     读口）在网络首轮未完成期间已出现源自缓存的事件」作为「渲染上次本地缓存事件」的
//     机械化代理（标记层订阅同一 store 即渲染，store 提前出现缓存事件 ≡ 标记提前上屏）。
//   - SPEC-8.4「事件缓存……升格为启动路径的一部分（SPEC-3.11）」+「仍不承诺离线数据
//     完整性」——缓存回填须作为启动流程必经步骤（不可被跳过/静默忽略）；且本地无缓存或
//     缓存读取失败时启动不得阻塞/抛未捕获异常，网络轮询仍应照常启动推进。
// SPEC-3.10「缓存事件上屏 ≤1s」的时长验收基准属 M5（本场景不做计时断言）；M2 基线量测
// 另挂 FM-11，不在本场景判据（见 testplan M2-20 行文）。
// BUG-030（无缓存首批 snap/淡入 spec 歧义）待仲裁，不在本场景断言范围——本场景走
// 缓存→刷新路径，缓存批预置存在，不测「全新安装无缓存首批」的过渡性。
//
// 被测对象 = 【真实】的 createDataLayer.start（cache.load→store.load→scheduler.start 顺序）
// 与【真实】的 EventCache.persist/load 往返。为在 node 下驱动它们，需要两个浏览器运行时
// 基座的测试替身，二者都只替换「基座」、不复制被测启动逻辑（否则即照抄实现，违反 QA 边界）：
//   1) 内存 IndexedDB 替身（工作树未装 fake-indexeddb，任务边界只动 tests/，故自带最小实现）；
//   2) 永不 settle 的 fetch 桩，模拟「网络首轮请求人为长时间不 resolve」。

// ---- 最小内存 IndexedDB 替身 ----
// 只实现 src/data/cache.ts（EventCache）实际调用到的 IndexedDB 子集：
//   factory.open → req.onupgradeneeded/onsuccess/onerror + req.result；
//   db.objectStoreNames.contains；db.createObjectStore({keyPath})；db.transaction；
//   tx.objectStore；store.getAll/clear/put；tx.oncomplete/onerror。
// IndexedDB 的请求回调在「赋值处理器的同步块结束后」异步触发——此处用 queueMicrotask 复现
// 该次序（getAll()/open() 返回后调用方才赋 onsuccess，微任务在其之后运行，处理器已就位）。
type Row = Record<string, unknown>

interface ReqLike<T> {
  result?: T
  error?: unknown
  onsuccess: (() => void) | null
  onerror: (() => void) | null
  onupgradeneeded: (() => void) | null
}

function makeReq<T>(): ReqLike<T> {
  return { onsuccess: null, onerror: null, onupgradeneeded: null }
}

class FakeStore {
  constructor(
    private readonly data: Map<string, Row>,
    private readonly keyPath: string,
  ) {}
  getAll(): ReqLike<Row[]> {
    const req = makeReq<Row[]>()
    queueMicrotask(() => {
      req.result = [...this.data.values()]
      req.onsuccess?.()
    })
    return req
  }
  clear(): void {
    this.data.clear()
  }
  put(value: Row): void {
    this.data.set(String(value[this.keyPath]), value)
  }
}

class FakeTx {
  oncomplete: (() => void) | null = null
  onerror: (() => void) | null = null
  private readonly store: FakeStore
  constructor(data: Map<string, Row>, keyPath: string) {
    this.store = new FakeStore(data, keyPath)
    // 当前同步块（objectStore/clear/put/赋 oncomplete）结束后判定事务完成
    queueMicrotask(() => this.oncomplete?.())
  }
  objectStore(): FakeStore {
    return this.store
  }
}

class FakeDB {
  readonly data = new Map<string, Row>()
  private keyPath = 'id'
  private readonly stores = new Set<string>()
  readonly objectStoreNames = {
    contains: (name: string): boolean => this.stores.has(name),
  }
  createObjectStore(name: string, opts: { keyPath: string }): void {
    this.stores.add(name)
    this.keyPath = opts.keyPath
  }
  transaction(): FakeTx {
    return new FakeTx(this.data, this.keyPath)
  }
}

class FakeIDB {
  private readonly dbs = new Map<string, FakeDB>()
  constructor(private readonly failOpen = false) {}
  open(name: string): ReqLike<FakeDB> {
    const req = makeReq<FakeDB>()
    if (this.failOpen) {
      // 模拟底层存储异常（如打开失败）→ EventCache.load 内部 reject（SPEC-8.4 读取失败分支）
      queueMicrotask(() => {
        req.error = new Error('fake indexedDB open error')
        req.onerror?.()
      })
      return req
    }
    let db = this.dbs.get(name)
    const isNew = db === undefined
    if (db === undefined) {
      db = new FakeDB()
      this.dbs.set(name, db)
    }
    req.result = db
    queueMicrotask(() => {
      if (isNew) req.onupgradeneeded?.()
      req.onsuccess?.()
    })
    return req
  }
}

// ---- 永不 settle 的 fetch 桩：记账调用次数，返回一个永不 resolve/reject 的 Promise ----
function hangingFetch(counter: { n: number }): typeof fetch {
  const stub = (): Promise<Response> =>
    new Promise<Response>(() => {
      /* 永不 settle：模拟「首轮网络请求人为长时间不 resolve」 */
    })
  const wrapped = (): Promise<Response> => {
    counter.n += 1
    return stub()
  }
  return wrapped as unknown as typeof fetch
}

const NOW = Date.UTC(2026, 6, 21, 0, 0, 0)

function cachedEvent(id: string, over: Partial<GeoEvent> = {}): GeoEvent {
  return {
    id,
    category: 'disaster',
    severity: 2,
    title: `cached ${id}`,
    summary: '',
    urls: [`https://example.com/${id}`],
    lat: 10,
    lon: 20,
    ts: NOW - 3_600_000,
    source: 'usgs',
    ...over,
  }
}

describe('M2-20 缓存优先启动（数据层启动顺序）', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('网络首轮未完成期间，事件读口已出现源自缓存的事件（SPEC-3.11 不空屏等待网络）', async () => {
    const fake = new FakeIDB()
    const counter = { n: 0 }
    vi.stubGlobal('indexedDB', fake)
    vi.stubGlobal('fetch', hangingFetch(counter))

    // 预置「上次会话遗留」的缓存，经【真实】EventCache.persist 落盘（testplan 指定路径），
    // 与 createDataLayer 内部 new EventCache() 共享同一 globalThis.indexedDB=fake（同一 DB）。
    const seed = new EventCache(fake as unknown as IDBFactory)
    const cached: StoredRecord[] = [
      { event: cachedEvent('usgs:a'), lastSeen: NOW - 1_000 },
      { event: cachedEvent('eonet:b', { source: 'eonet' }), lastSeen: NOW - 2_000 },
    ]
    await seed.persist(cached)

    const layer = createDataLayer()
    await layer.start()

    // 断言①：fetch 永不 resolve（网络首轮未完成）的此刻，读口已含缓存两条事件——
    // 缓存回填不等待、不依赖网络首轮完成（SPEC-3.11「不空屏等待网络」；SPEC-8.4 缓存回填
    // 为启动必经步骤、未被跳过）。
    const ids = layer.store
      .snapshot()
      .map((e) => e.id)
      .sort()
    expect(ids).toEqual(['eonet:b', 'usgs:a'])

    // 断言②：网络轮询确已启动（各 T1 provider 已各发起一次 fetch 且仍在途），且此刻
    // store 内只有缓存事件、无任何网络事件混入（fetch 永不 resolve → onResult 从不触发）——
    // 证明「先渲染缓存」与「启动网络」两者均发生、次序上缓存先到（SPEC-3.11）。
    expect(counter.n).toBeGreaterThan(0)
    expect(layer.store.snapshot()).toHaveLength(2)

    layer.stop()
  })

  it('本地无缓存时启动不阻塞、网络轮询照常启动（SPEC-8.4 缓存不完整不使启动卡死）', async () => {
    const fake = new FakeIDB() // 空 DB：cache.load 返回 []
    const counter = { n: 0 }
    vi.stubGlobal('indexedDB', fake)
    vi.stubGlobal('fetch', hangingFetch(counter))

    const layer = createDataLayer()
    // start 正常 resolve（不抛、不卡死）
    await expect(layer.start()).resolves.toBeUndefined()
    // 无缓存 → store 空；但网络轮询仍启动推进（SPEC-8.4）
    expect(layer.store.snapshot()).toHaveLength(0)
    expect(counter.n).toBeGreaterThan(0)

    layer.stop()
  })

  it('缓存读取本身失败时启动不抛未捕获异常、网络轮询照常启动（SPEC-8.4 不承诺离线数据完整性）', async () => {
    const fake = new FakeIDB(true) // open 触发 onerror → cache.load reject
    const counter = { n: 0 }
    vi.stubGlobal('indexedDB', fake)
    vi.stubGlobal('fetch', hangingFetch(counter))

    const layer = createDataLayer()
    // 读取失败被数据层内部捕获，start 仍正常 resolve（SPEC-8.4）
    await expect(layer.start()).resolves.toBeUndefined()
    expect(layer.store.snapshot()).toHaveLength(0)
    // 读取失败不阻断后续网络轮询启动（SPEC-8.4）
    expect(counter.n).toBeGreaterThan(0)

    layer.stop()
  })
})
