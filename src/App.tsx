import { useEffect, useRef } from 'react'
import { GlobeScene } from './globe/GlobeScene'

export function App() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const scene = new GlobeScene(containerRef.current!)
    return () => scene.dispose()
  }, [])

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">World Tunnel</span>
        <span className="placeholder">行情 ticker（M3）</span>
      </header>
      <main className="stage">
        <div id="globe-container" ref={containerRef} />
        <aside className="side-panel">
          <h2>Live events</h2>
          <p className="placeholder">事件流（M2）</p>
        </aside>
      </main>
    </div>
  )
}
