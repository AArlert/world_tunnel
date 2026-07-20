// IndexedDB 事件缓存读写：启动回填 + 每轮持久化（SPEC-8.4、SPEC-3.11 数据侧）。
// 仅承载事件缓存；watchlist/设置持久化属 FM-10/FM-16，不在此（SPEC-8.4 边界）。
// 不承诺离线数据完整性，配额溢出淘汰 M2 不做（过期窗已天然限界，DP §2.5）。

import type { GeoEvent, StoredRecord } from './types'

const DB_NAME = 'world_tunnel'
const DB_VERSION = 1
const STORE_NAME = 'events'

/** IndexedDB 落盘形态：GeoEvent 字段铺平 + lastSeen，keyPath='id' 直接取事件 id（SPEC-6.3①） */
type PersistedRecord = GeoEvent & { lastSeen: number }

export class EventCache {
  private readonly factory: IDBFactory
  private dbPromise: Promise<IDBDatabase> | null = null

  /** factory 可注入以便测试用 fake-indexeddb；默认取全局 indexedDB（浏览器运行时） */
  constructor(factory: IDBFactory = globalThis.indexedDB) {
    this.factory = factory
  }

  /** 读回上次缓存的全部事件（连同 lastSeen），供启动先上屏（SPEC-3.11）与冷启动续期判定（SPEC-6.3①） */
  async load(): Promise<StoredRecord[]> {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).getAll()
      req.onsuccess = () => {
        const rows = req.result as PersistedRecord[]
        resolve(
          rows.map((row) => {
            const { lastSeen, ...event } = row
            return { event, lastSeen }
          }),
        )
      }
      req.onerror = () => reject(req.error)
    })
  }

  /** 覆盖式持久化当前快照（clear + put，SPEC-8.4 每轮变更落盘）；随事件一并落盘 lastSeen（SPEC-6.3①） */
  async persist(records: readonly StoredRecord[]): Promise<void> {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.clear()
      for (const { event, lastSeen } of records) store.put({ ...event, lastSeen })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  private open(): Promise<IDBDatabase> {
    if (this.dbPromise !== null) return this.dbPromise
    this.dbPromise = new Promise((resolve, reject) => {
      const req = this.factory.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          // 以 id 为主键，天然承接 SPEC-6.3 的 id 去重
          db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    return this.dbPromise
  }
}
