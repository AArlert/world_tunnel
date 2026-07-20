import { useState } from 'react'
import type { GeoEvent } from '../data'
import { CATEGORY_COLORS } from '../globe/markers'

interface EventPanelProps {
  events: readonly GeoEvent[]
  /** 当前高亮/强调的事件（来自列表 hover 或 marker→list 上抛，SPEC-7.4） */
  hoveredId: string | null
  /** 当前选中的事件（列表点击，SPEC-7.4；M2 仅高亮，不弹详情卡/不飞行） */
  selectedId: string | null
  onHoverRow: (id: string | null) => void
  onSelectRow: (id: string) => void
}

/** 分类色 number → CSS hex；单一色表来自 markers.CATEGORY_COLORS（SPEC-3.7/2.2a①） */
function categoryCss(category: GeoEvent['category']): string {
  return '#' + CATEGORY_COLORS[category].toString(16).padStart(6, '0')
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
 * ts 倒序，空态「暂无事件」（SPEC-2.2a）。消费外部传入的可见集，不内建分类过滤（属 FM-10）。
 */
export function EventPanel({ events, hoveredId, selectedId, onHoverRow, onSelectRow }: EventPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const now = Date.now()
  const sorted = [...events].sort((a, b) => b.ts - a.ts) // 最新在上（SPEC-2.2a）

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
            return (
              <li
                key={e.id}
                className={active ? 'event-row event-row--active' : 'event-row'}
                onMouseEnter={() => onHoverRow(e.id)}
                onClick={() => onSelectRow(e.id)}
              >
                <span className="event-row__dot" style={{ background: categoryCss(e.category) }} />
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
