import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDataLayer } from '../src/data'
import { EventCache } from '../src/data/cache'
import type { GeoEvent, StoredRecord } from '../src/data/types'

// BUG-035 最小复现（登记于 doc/bugs.md，发现于 BUG-034 复验卡评估「早停后晚到 load
// 无竞态复活」回归检查点时）：BUG-034 的修复给 createDataLayer 引入了 cacheLoaded
// 闸门——stop() 只在 cacheLoaded 为 true 时才落盘，避免用未完成回填的空 store 快照
// 清空共享缓存。但 cacheLoaded 的翻转（`try { ...; cacheLoaded = true } catch {...}`）
// 不受 `stopped` 状态约束：一个已被早停（stop() 抢在其自身 cache.load() 完成前执行，
// 此时 store.load 因 `!stopped` 判断被跳过、store 仍为空）的实例，其自身 load 晚到
// settle 后仍会把 cacheLoaded 悄悄翻为 true——若此时该（早已早停、store 仍为空的）
// 实例再被调用一次 stop()，闸门此刻已开，会用这份必然为空的快照第二次清空共享缓存，
// BUG-034 本欲杜绝的破坏又通过「二次 stop」这条路径复活。
//
// 期望（SPEC 依据）：与 BUG-034 同源——SPEC-3.11「缓存……升格为启动路径的一部分」+
// SPEC-8.4「事件缓存……仍不承诺离线数据完整性」——「不承诺完整性」不等于「允许把
// 已有的持久化数据清空」，该原则不因触发路径是「首次 stop」还是「同一实例的后续
// stop」而改变；一个从未真正完成回填（store 从未装入真实数据）的实例，不论被 stop()
// 多少次，都不应该用空快照覆盖共享存储。
//
// ---- 最小内存 IndexedDB 替身：与 tests/data-layer-early-stop-cache-loss.test.ts /
// tests/cache-first-start.test.ts 同一最小实现（工作树未装 fake-indexeddb，任务边界
// 只动 tests/，故各自内联，不改动既有文件）----
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
  open(name: string): ReqLike<FakeDB> {
    const req = makeReq<FakeDB>()
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

const NOW = Date.UTC(2026, 6, 21, 0, 0, 0)

function seededEvent(id: string): GeoEvent {
  return {
    id,
    category: 'disaster',
    severity: 2,
    title: `seed ${id}`,
    summary: '',
    urls: ['https://example.com'],
    lat: 1,
    lon: 2,
    ts: NOW,
    source: 'usgs',
  }
}

// 永不 settle 的 fetch 桩：避免真实 provider 轮询在测试期间报错/产生噪声（与
// data-layer-early-stop-cache-loss.test.ts 同一手法，本文件断言范围不涉及网络）。
function hangingFetch(): typeof fetch {
  return (() => new Promise<Response>(() => {})) as unknown as typeof fetch
}

describe('BUG-035 复现：早停实例自身 load 晚到 settle 后，二次 stop() 仍会用空快照清空共享持久化缓存', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('实例 A 早停(首次 stop 未落盘)→自身 load 晚到 settle→二次 stop()；共享缓存不应被清空（SPEC-3.11/8.4）', async () => {
    const fake = new FakeIDB()
    vi.stubGlobal('indexedDB', fake)
    vi.stubGlobal('fetch', hangingFetch())

    // 预置「上次会话遗留」的真实持久化事件（经真实 EventCache.persist 落盘）
    const seed = new EventCache(fake as unknown as IDBFactory)
    const seeded: StoredRecord[] = [{ event: seededEvent('usgs:doublestop'), lastSeen: NOW }]
    await seed.persist(seeded)

    // 实例 A：与 BUG-034 同一手法模拟早停——start() 触发但不等待即 stop()。
    // 首次 stop() 时 cacheLoaded 尚为 false（BUG-034 修复后应跳过持久化，不清空）。
    const a = createDataLayer()
    void a.start()
    a.stop()

    // 放行足够微任务，让 A 自身晚到的 cache.load() 完成 settle——`cacheLoaded` 翻为
    // true，但因 `!stopped` 判断，store.load 被跳过，A 的 store 仍为空。
    for (let i = 0; i < 5; i++) await Promise.resolve()

    // 二次 stop()：此时闸门已开（cacheLoaded=true），若无额外防护会用 A 仍为空的
    // store 快照再次落盘，清空共享缓存里的种子事件。
    a.stop()
    for (let i = 0; i < 5; i++) await Promise.resolve()

    // 期望：共享缓存不应被清空——另起实例应仍读到最初的种子事件。
    // 复现缺陷时：读到空——二次 stop 用空快照覆盖了共享缓存，种子数据丢失。
    const verify = createDataLayer()
    await verify.start()
    expect(verify.store.snapshot().map((e) => e.id)).toEqual(['usgs:doublestop'])
    verify.stop()
  })
})
