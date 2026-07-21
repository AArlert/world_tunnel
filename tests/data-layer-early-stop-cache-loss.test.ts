import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDataLayer } from '../src/data'
import { EventCache } from '../src/data/cache'
import type { GeoEvent, StoredRecord } from '../src/data/types'

// BUG-034 最小复现（登记于 doc/bugs.md，发现于 M2-24 卡编写 e2e 冷启动基线量测时）：
// createDataLayer().stop() 无条件按「当前 store 快照」持久化（src/data/index.ts stop()：
// `void cache.persist(store.entriesForPersist())`），即便其自身 start() 触发的
// cache.load()→store.load() 尚未完成（此时 store 必为空）。若共享的浏览器 IndexedDB
// 里已有此前真实持久化的事件（如「上次会话遗留」的缓存），这次早停会用空快照覆盖掉它。
//
// 该竞态在真实浏览器下由 React 18 StrictMode 的「挂载→卸载→再挂载」双调用确定性触发：
// App.tsx 的 useEffect 内 `void dataLayer.start()` 不等待，StrictMode 的 cleanup 紧接
// 在同一同步块内执行（先于该 start() 内部任何微任务/Promise resolve，包括 IndexedDB 的
// open/getAll 回调）——首个（很快被卸载的）dataLayer 实例的 stop() 几乎必然抢在其自身
// cache.load() 完成前执行。QA 于编写 e2e/cold-start-perf.spec.ts（M2-24）时，用「预置真实
// 缓存 → reload 触发冷启动」的方法在真实浏览器（dev server）下复现：预置的种子事件写入后
// 立即读回确认存在，reload 后再读回却已变为空数组，标记层实例数在 10s 轮询窗口内恒为 0
// （复现记录见交付汇报）。本文件用最小 Node 级 fake IndexedDB 复现同一根因（不依赖浏览器/
// React/StrictMode，纯粹是 createDataLayer 实例生命周期契约本身的问题，故是比端到端浏览器
// 场景更小的独立复现）。
//
// 期望（SPEC 依据）：SPEC-3.11「缓存……升格为启动路径的一部分」+ SPEC-8.4「事件缓存……
// 仍不承诺离线数据完整性」——「不承诺完整性」≠「允许把已有的持久化数据清空」；一个从未
// 成功完成 load 的实例被 stop() 时，不应清空共享存储里可能存在的、属于其他（甚至是自己
// 稍后真正存活）实例的数据。
//
// ---- 最小内存 IndexedDB 替身：与 tests/cache-first-start.test.ts 同一最小实现（工作树
// 未装 fake-indexeddb，任务边界只动 tests/，故各自内联，不改动既有文件）----
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
  constructor(private readonly db: FakeDB) {}
  getAll(): ReqLike<Row[]> {
    const req = makeReq<Row[]>()
    queueMicrotask(() => {
      // 回归检查点②（catch 路径跳过）专用：模拟「本次读取本身失败，但底层存储
      // 其余能力（含随后的 persist）仍健康」——与「open() 整体失效」（现有
      // cache-first-start.test.ts 的 FakeIDB(true)）是不同的边界，后者读写会
      // 一并失败、测不出「读失败但写健康时是否误清」这个更贴近本缺陷的场景。
      if (this.db.failNextGetAll) {
        this.db.failNextGetAll = false
        req.error = new Error('fake getAll error')
        req.onerror?.()
        return
      }
      req.result = [...this.db.data.values()]
      req.onsuccess?.()
    })
    return req
  }
  clear(): void {
    this.db.data.clear()
  }
  put(value: Row): void {
    this.db.data.set(String(value[this.db.keyPath]), value)
  }
}

class FakeTx {
  oncomplete: (() => void) | null = null
  onerror: (() => void) | null = null
  private readonly store: FakeStore
  constructor(db: FakeDB) {
    this.store = new FakeStore(db)
    queueMicrotask(() => this.oncomplete?.())
  }
  objectStore(): FakeStore {
    return this.store
  }
}

class FakeDB {
  readonly data = new Map<string, Row>()
  keyPath = 'id'
  /** 回归检查点②专用开关：置 true 后下一次 getAll() 失败一次，随后自动复位 */
  failNextGetAll = false
  private readonly stores = new Set<string>()
  readonly objectStoreNames = {
    contains: (name: string): boolean => this.stores.has(name),
  }
  createObjectStore(name: string, opts: { keyPath: string }): void {
    this.stores.add(name)
    this.keyPath = opts.keyPath
  }
  transaction(): FakeTx {
    return new FakeTx(this)
  }
}

class FakeIDB {
  private readonly dbs = new Map<string, FakeDB>()
  /** 回归检查点②专用：全测试生命周期内只会开出一个库（EventCache 内部固定库名，
   * 对本文件不可见），故直接取「唯一已开的库」而非按名查找，避免耦合实现私有常量 */
  getOnlyDb(): FakeDB | undefined {
    return [...this.dbs.values()][0]
  }
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
// cache-first-start.test.ts 同一手法，本文件断言范围不涉及网络）。
function hangingFetch(): typeof fetch {
  return (() => new Promise<Response>(() => {})) as unknown as typeof fetch
}

describe('BUG-034 复现：dataLayer 早停（其自身 cache.load 未完成）会用空快照清空共享持久化缓存', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('实例 A 的 start() 触发但未 await 即被 stop()；随后实例 B 的 start() 应仍读到 A 启动前已持久化的种子事件（SPEC-3.11/8.4）', async () => {
    const fake = new FakeIDB()
    vi.stubGlobal('indexedDB', fake)
    vi.stubGlobal('fetch', hangingFetch())

    // 预置「上次会话遗留」的真实持久化事件（经真实 EventCache.persist 落盘）
    const seed = new EventCache(fake as unknown as IDBFactory)
    const seeded: StoredRecord[] = [{ event: seededEvent('usgs:seed'), lastSeen: NOW }]
    await seed.persist(seeded)

    // 实例 A：模拟 React StrictMode「挂载→立即卸载」——start() 触发但不等待其内部
    // cache.load() 完成，随即调用 stop()（与 App.tsx useEffect cleanup 同一时序）。
    const a = createDataLayer()
    void a.start()
    a.stop()

    // 放行足够的微任务轮次，让 A 的 stop() 触发的 cache.persist(空快照) 真正落盘完成
    // （FakeIDB 的 open/getAll/transaction 均经 queueMicrotask 排队，多轮 flush 确保排空）。
    for (let i = 0; i < 5; i++) await Promise.resolve()

    // 实例 B：模拟 StrictMode 存活下来的真正实例，正常 start 并 await 到底。
    const b = createDataLayer()
    await b.start()

    // 期望：B 应读到 A 启动前就已持久化的种子事件（SPEC-3.11「冷启动即渲染上次本地缓存事件」）。
    // 复现缺陷时：B 读到空——A 的早停用空快照覆盖了共享缓存，种子数据丢失。
    expect(b.store.snapshot().map((e) => e.id)).toEqual(['usgs:seed'])

    a.stop()
    b.stop()
  })

  // 回归检查点①正常路径落盘（防修复引入的 cacheLoaded 闸门误伤正常场景）：
  // 未早停、start() 已完整 await 到底（cache.load() 已 settle，cacheLoaded 应为
  // true）后再 stop()，持久化仍须正常执行——SPEC-8.4「事件缓存……升格为启动路径
  // 的一部分」不因本次 BUG-034 修复而在正常路径退化为「跳过持久化」。
  it('正常路径（start 完整 await 到底后再 stop）持久化仍正常执行，不被闸门误挡', async () => {
    const fake = new FakeIDB()
    vi.stubGlobal('indexedDB', fake)
    vi.stubGlobal('fetch', hangingFetch())

    const seed = new EventCache(fake as unknown as IDBFactory)
    const seeded: StoredRecord[] = [{ event: seededEvent('usgs:normal'), lastSeen: NOW }]
    await seed.persist(seeded)

    // 正常路径：start() 被完整 await，cache.load() 已 settle，非早停。
    const layer = createDataLayer()
    await layer.start()
    expect(layer.store.snapshot().map((e) => e.id)).toEqual(['usgs:normal'])

    layer.stop()
    for (let i = 0; i < 5; i++) await Promise.resolve()

    // 持久化仍正常发生：另起实例读回，应仍能读到原有事件（未被跳过、也未被清空）。
    const verify = createDataLayer()
    await verify.start()
    expect(verify.store.snapshot().map((e) => e.id)).toEqual(['usgs:normal'])
    verify.stop()
  })

  // 回归检查点②catch 路径跳过（读取失败不得清空底层仍健康的真实数据）：
  // SPEC-8.4「仍不承诺离线数据完整性」不等于「允许把已有持久化数据清空」（同 BUG-034
  // 期望段引用）。本次读取（getAll）本身失败，但底层存储其余能力（含随后的 persist）
  // 健康——与「open() 整体失效」（cache-first-start.test.ts 既有场景）是不同边界，
  // 后者读写一并失败，测不出「读失败但写健康时是否误清」这个更贴近本缺陷根因的场景。
  it('cache.load() 读取失败（catch 分支）后 stop() 跳过持久化，不清空底层已有真实数据', async () => {
    const fake = new FakeIDB()
    vi.stubGlobal('indexedDB', fake)
    vi.stubGlobal('fetch', hangingFetch())

    const seed = new EventCache(fake as unknown as IDBFactory)
    const seeded: StoredRecord[] = [{ event: seededEvent('usgs:readfail'), lastSeen: NOW }]
    await seed.persist(seeded)

    // seed.persist 只调用 put/clear，从未调用过 getAll——故此刻置位「下一次 getAll
    // 失败」，必定精确命中 layer.start() 触发的第一次（也是唯一一次）cache.load()，
    // 无需摸索任何微任务时序。库本身健康（open 成功、随后 persist 的 clear/put 正常）。
    const db = fake.getOnlyDb()
    if (db) db.failNextGetAll = true

    const layer = createDataLayer()
    await layer.start()

    expect(layer.store.snapshot()).toEqual([]) // 读取失败：本实例未回填任何事件

    layer.stop()
    for (let i = 0; i < 5; i++) await Promise.resolve()

    // 期望：读取失败不应清空底层已有真实数据——另起实例应仍读到原始种子事件。
    const verify = createDataLayer()
    await verify.start()
    expect(verify.store.snapshot().map((e) => e.id)).toEqual(['usgs:readfail'])
    verify.stop()
  })

  // 回归检查点③早停后晚到 load 无竞态复活：主复现用例本身已隐含覆盖——A 早停后
  // flush 的 5 轮微任务足以让 A 自身晚到的 cache.load() settle，随后 B 仍正确读到
  // 种子事件，证明晚到的 load 未引发任何复活/污染。更深一层的边界（若该早停实例
  // 之后被二次 stop()）揭示了修复未覆盖的残留缺口，已独立登记 BUG-035（复现测试
  // tests/data-layer-double-stop-cache-loss.test.ts），不并入本文件（避免把一条新
  // 发现的、尚未修复的失败断言混进 BUG-034 的机械复验复现命令，致其失守）。
})
