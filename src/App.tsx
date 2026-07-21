import { useEffect, useMemo, useState } from 'react'
import { createDataLayer, type Category, type GeoEvent } from './data'
import { GlobeStage } from './ui/GlobeStage'
import { CATEGORY_COLORS } from './globe/markers'

// 六分类顺序照 SPEC-3.7 色表枚举（唯一事实源，标识符英文、枚举值即 category）
const CATEGORIES: readonly Category[] = [
  'disaster',
  'conflict',
  'humanitarian',
  'news',
  'launch',
  'flight',
]

// 首屏开关文案（中文标签仅供人读；category 对应关系由 data-category 承载，供筛选定位）
const CATEGORY_LABELS: Record<Category, string> = {
  disaster: '灾害',
  conflict: '冲突',
  humanitarian: '人道',
  news: '新闻',
  launch: '发射',
  flight: '航班',
}

/** 分类色 number → CSS hex；单一色表来自 markers.CATEGORY_COLORS（SPEC-2.2a①/3.7），不另立色值 */
function categoryCss(c: Category): string {
  return '#' + CATEGORY_COLORS[c].toString(16).padStart(6, '0')
}

/** UTC 实时时钟（SPEC-2.1）：每秒刷新，格式 HH:MM:SS UTC（时分秒各两位，UTC 取值） */
function UtcClock() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const d = new Date(now)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  const ss = String(d.getUTCSeconds()).padStart(2, '0')
  return <span className="topbar__clock">{`${hh}:${mm}:${ss} UTC`}</span>
}

export function App() {
  const [events, setEvents] = useState<readonly GeoEvent[]>([])
  // 启用中的分类集合（默认全开）：category 集合语义，任意子集组合、非互斥（SPEC-8.1/2.4①）
  const [enabled, setEnabled] = useState<ReadonlySet<Category>>(() => new Set(CATEGORIES))

  // 数据层生命周期挂在 App：createDataLayer().start() 后事件经 store 订阅流入标记层与面板
  // （缓存优先启动，SPEC-3.11；轮询/故障隔离在数据层内部，SPEC-5.0）
  useEffect(() => {
    const dataLayer = createDataLayer()
    setEvents(dataLayer.store.snapshot()) // 先铺一次当前快照（缓存回填/首轮刷新前通常为空）
    const unsubscribe = dataLayer.store.subscribe((snap) => setEvents(snap))
    void dataLayer.start()
    return () => {
      unsubscribe()
      dataLayer.stop()
    }
  }, [])

  // 过滤接缝（SPEC-5.0a：呈现层之上的用户筛选，不入 provider 层）：按启用集合过滤后
  // 传入 GlobeStage，标记层与事件流面板共同消费同一集合，两处天然同步（SPEC-2.4①）
  const visibleEvents = useMemo(
    () => events.filter((e) => enabled.has(e.category)),
    [events, enabled],
  )

  const toggleCategory = (c: Category): void =>
    setEnabled((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">Worlens</span>
        <div className="category-filter" role="group" aria-label="分类过滤">
          {CATEGORIES.map((c) => {
            const on = enabled.has(c)
            return (
              <button
                key={c}
                type="button"
                data-category={c}
                aria-pressed={on}
                className={on ? 'category-toggle category-toggle--on' : 'category-toggle'}
                onClick={() => toggleCategory(c)}
              >
                <span className="category-toggle__dot" style={{ background: categoryCss(c) }} />
                {CATEGORY_LABELS[c]}
              </button>
            )
          })}
        </div>
        <UtcClock />
      </header>
      <main className="stage">
        <GlobeStage events={visibleEvents} />
      </main>
    </div>
  )
}
