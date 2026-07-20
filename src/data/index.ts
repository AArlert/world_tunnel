// 数据层装配根：组合 store + scheduler + cache，暴露只读读口与 start/stop（DP §3.6）。
// 谁来 start 属 FM-07/FM-10 wiring，非本卡。

import { EventCache } from './cache'
import { T1_PROVIDERS } from './providers'
import { Scheduler } from './scheduler'
import { EventStore } from './store'

export type { Category, GeoEvent, SourceId } from './types'
export { EventStore } from './store'

/** 去抖合并写窗口：属实现细节，不进 spec（DP §2.5） */
const PERSIST_DEBOUNCE_MS = 2000

export interface DataLayer {
  /** 只读读口：FM-07 标记层 / FM-10 面板共同消费 */
  readonly store: EventStore
  /** 1) cache→store.load（SPEC-3.11）  2) scheduler.start */
  start(): Promise<void>
  /** scheduler.stop + 落一次持久化（DP §3.6） */
  stop(): void
}

export function createDataLayer(): DataLayer {
  const store = new EventStore()
  const cache = new EventCache()

  let stopped = false
  let persistTimer: ReturnType<typeof setTimeout> | null = null

  // 去抖持久化：合并同窗口内的多次变更为一次落盘（SPEC-8.4）
  const schedulePersist = (): void => {
    if (persistTimer !== null) return
    persistTimer = setTimeout(() => {
      persistTimer = null
      void cache.persist(store.entriesForPersist()).catch((err) => {
        console.error('[data] 事件缓存持久化失败', err)
      })
    }, PERSIST_DEBOUNCE_MS)
  }

  const scheduler = new Scheduler(T1_PROVIDERS, (events) => {
    // 每轮成功刷新：去重合并+续期 → 随同一 now 清扫过期 → 去抖落盘（SPEC-6.3①，DP §3.6）
    const now = Date.now()
    store.upsertMany(events, now)
    store.sweepExpired(now)
    schedulePersist()
  })

  return {
    store,
    async start() {
      // 1) 先从缓存回填入 store（SPEC-3.11：不空网络等待）；load 不触发清扫（§2.5）。
      //    缓存读取失败不阻塞启动（SPEC-8.4 不承诺离线数据完整性）。
      try {
        const cached = await cache.load()
        if (!stopped && cached.length > 0) store.load(cached)
      } catch (err) {
        console.error('[data] 事件缓存读取失败，跳过回填', err)
      }
      // 2) 再启动调度（SPEC-3.11 数据侧顺序）
      if (!stopped) scheduler.start()
    },
    stop() {
      stopped = true
      scheduler.stop()
      if (persistTimer !== null) {
        clearTimeout(persistTimer)
        persistTimer = null
      }
      // 落一次持久化（DP §3.6）
      void cache.persist(store.entriesForPersist()).catch((err) => {
        console.error('[data] 停机持久化失败', err)
      })
    },
  }
}
