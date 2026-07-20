import { useEffect, useState } from 'react'
import { createDataLayer, type GeoEvent } from './data'
import { GlobeStage } from './ui/GlobeStage'

export function App() {
  const [events, setEvents] = useState<readonly GeoEvent[]>([])

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

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">World Tunnel</span>
        <span className="placeholder">行情 ticker（M3）</span>
      </header>
      <main className="stage">
        <GlobeStage events={events} />
      </main>
    </div>
  )
}
