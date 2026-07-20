import { useEffect, useRef, useState } from 'react'
import type { GeoEvent } from '../data'
import { GlobeScene } from '../globe/GlobeScene'
import { EventPanel } from './EventPanel'

interface GlobeStageProps {
  /** 可见事件集（M2 无 FM-10 时即 store 全量快照）；标记层与面板共同消费（DP §3.3） */
  events: readonly GeoEvent[]
}

/**
 * React ↔ three 联动桥接（DP §3.4）：承载 GlobeScene 生命周期 + 事件流面板，
 * 联动态（hoveredId/selectedId）为 React 侧单一真相，双向同步到 GlobeScene 的命令式高亮（SPEC-7.4）。
 */
export function GlobeStage({ events }: GlobeStageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<GlobeScene | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // 挂载/卸载 GlobeScene（沿用 App 既有模式，StrictMode 双挂载靠 cleanup 复位）
  useEffect(() => {
    // DEV/测试专用：?style=satellite 显式走卫星风格路径（BUG-020 方案 a），生产忽略、默认矢量
    const satellite =
      import.meta.env.DEV &&
      new URLSearchParams(window.location.search).get('style') === 'satellite'
    const scene = new GlobeScene(containerRef.current!, { satellite })
    sceneRef.current = scene
    // marker→list：canvas hover 命中标记 → 上抛为 React 态（DP §3.4 上抛方向）
    scene.onMarkerHover = (id) => setHoveredId(id)
    return () => {
      scene.dispose()
      sceneRef.current = null
    }
  }, [])

  // store 快照 → 标记层（setEvents 是快照进入渲染层的唯一入口，SPEC-6.2）
  useEffect(() => {
    sceneRef.current?.setEvents(events)
  }, [events])

  // list→marker：hover 优先，否则 selected 驱动球面标记高亮（DP §3.4 下推方向）
  useEffect(() => {
    sceneRef.current?.setHighlightedEvent(hoveredId ?? selectedId)
  }, [hoveredId, selectedId])

  return (
    <>
      <div id="globe-container" ref={containerRef} />
      <EventPanel
        events={events}
        hoveredId={hoveredId}
        selectedId={selectedId}
        onHoverRow={setHoveredId}
        onSelectRow={(id) => setSelectedId((prev) => (prev === id ? null : id))}
      />
    </>
  )
}
