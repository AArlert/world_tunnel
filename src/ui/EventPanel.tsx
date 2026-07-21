import { useState } from 'react'
import type { GeoEvent } from '../data'
import { severityCategoryCss } from '../globe/markers'

interface EventPanelProps {
  events: readonly GeoEvent[]
  /** 当前高亮/强调的事件（来自列表 hover 或 marker→list 上抛，SPEC-7.4） */
  hoveredId: string | null
  /** 当前选中的事件（列表点击，SPEC-7.4；M2 仅高亮，不弹详情卡/不飞行） */
  selectedId: string | null
  onHoverRow: (id: string | null) => void
  onSelectRow: (id: string) => void
}

const MIN = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

/**
 * 相对时间（SPEC-2.2a③，格式细节属实现自由度）：由 ts 相对当前时刻派生。
 * 兼顾未来向（发射类 ts 为 T-0 未来时刻，SPEC-5.5）：过去用「前」、未来用「后」。
 */
function relativeTime(ts: number, now: number): string {
  const diff = ts - now
  const abs = Math.abs(diff)
  if (abs < MIN) return '刚刚'
  const suffix = diff >= 0 ? '后' : '前'
  if (abs < HOUR) return `${Math.floor(abs / MIN)} 分钟${suffix}`
  if (abs < DAY) return `${Math.floor(abs / HOUR)} 小时${suffix}`
  return `${Math.floor(abs / DAY)} 天${suffix}`
}

/**
 * 事件流面板（SPEC-2.2 右侧 300px 可折叠、球主列表从）：列表行 = 分类色圆点 + 标题 + 相对时间，
 * 按距 now 时间邻近度升序，空态「暂无事件」（SPEC-2.2a）。消费外部传入的可见集，不内建分类过滤（属 FM-10）。
 */
export function EventPanel({ events, hoveredId, selectedId, onHoverRow, onSelectRow }: EventPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const now = Date.now() // 与相对时间显示同源（SPEC-2.2a）
  // 距 now 时间邻近度升序：主键 |ts-now| 小者在前；等距时未来（ts>now）先于过去；仍并列按 id 升序（SPEC-2.2a）
  const sorted = [...events].sort((a, b) => {
    const da = Math.abs(a.ts - now)
    const db = Math.abs(b.ts - now)
    if (da !== db) return da - db
    const aFuture = a.ts > now
    const bFuture = b.ts > now
    if (aFuture !== bFuture) return aFuture ? -1 : 1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })

  if (collapsed) {
    return (
      <aside className="event-panel event-panel--collapsed">
        <button className="event-panel__toggle" onClick={() => setCollapsed(false)}>
          事件流
        </button>
      </aside>
    )
  }

  return (
    <aside className="event-panel">
      <header className="event-panel__head">
        <h2>事件流</h2>
        <button className="event-panel__toggle" onClick={() => setCollapsed(true)} aria-label="折叠">
          ⟩
        </button>
      </header>
      {sorted.length === 0 ? (
        <p className="event-panel__empty">暂无事件</p>
      ) : (
        <ul className="event-panel__list" onMouseLeave={() => onHoverRow(null)}>
          {sorted.map((e) => {
            const active = e.id === hoveredId || e.id === selectedId
            // 行整体视觉轻重编码 severity：标题明度三档（SPEC-2.2a）由 event-row--sevN 承载（见 index.css）
            const cls = `event-row event-row--sev${e.severity}${active ? ' event-row--active' : ''}`
            return (
              <li
                key={e.id}
                className={cls}
                onMouseEnter={() => onHoverRow(e.id)}
                onClick={() => onSelectRow(e.id)}
              >
                <span
                  className="event-row__dot"
                  style={{ background: severityCategoryCss(e.category, e.severity) }}
                />
                <span className="event-row__title">{e.title}</span>
                <span className="event-row__time">{relativeTime(e.ts, now)}</span>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}
