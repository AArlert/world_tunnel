// M2-22：事件流面板列表排序——距 now 时间邻近度升序（SPEC-2.2a REV-012 修订排序句）。
//
// 期望值来源（严格只从 doc/spec.md SPEC-2.2a 推导，不读 src/ui/EventPanel.tsx 的比较器实现当期望）：
//   SPEC-2.2a 排序句原文：「列表按『距当前时刻 now 的时间邻近度』升序排序：主排序键为 |ts − now|，
//   值越小越靠前、值越大越靠后；|ts − now| 相等时未来事件（ts > now）先于过去事件（ts ≤ now），
//   仍并列者按 id 升序稳定排序以保确定性。全部为过去事件时该规则等价于 ts 倒序（最新在上）；
//   全部为未来事件时等价于最近发生者在上（倒计时序）。无事件时显示空状态文案『暂无事件』。」
//
// 被测对象：EventPanel 组件内联比较器（真实渲染，非重实现）。用 react-dom/server 的
//   renderToStaticMarkup 渲染真实组件、读回 DOM 中列表行的出现顺序，避免引入 jsdom；
//   组件的 now 取自 Date.now()（SPEC-2.2a「now 与③相对时间同源」），故用 vi.spyOn 钉死时钟
//   做确定性构造。行 title 直接置为 id，读回顺序即被测事件的排序结果。

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EventPanel } from '../src/ui/EventPanel'
import type { GeoEvent } from '../src/data'

const NOW = 1_700_000_000_000 // 钉死时钟，供确定性构造（SPEC-2.2a：now 与相对时间同源）
const MIN = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

/** 构造一条最小合法 GeoEvent（SPEC-6.1）；title=id，便于从渲染结果读回排序顺序 */
function evt(id: string, ts: number): GeoEvent {
  return {
    id,
    category: 'news',
    severity: 1,
    title: id,
    summary: '',
    urls: ['https://example.test/'],
    lat: 0,
    lon: 0,
    ts,
    source: 'gdelt',
  }
}

/** 渲染 EventPanel，返回列表行 title（=id）的 DOM 出现顺序 */
function renderOrder(events: GeoEvent[]): string[] {
  const html = renderToStaticMarkup(
    createElement(EventPanel, {
      events,
      hoveredId: null,
      selectedId: null,
      onHoverRow: () => {},
      onSelectRow: () => {},
    }),
  )
  return [...html.matchAll(/event-row__title">([^<]*)</g)].map((m) => m[1])
}

function renderHtml(events: GeoEvent[]): string {
  return renderToStaticMarkup(
    createElement(EventPanel, {
      events,
      hoveredId: null,
      selectedId: null,
      onHoverRow: () => {},
      onSelectRow: () => {},
    }),
  )
}

describe('EventPanel 排序——距 now 邻近度升序（SPEC-2.2a，M2-22）', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('混合：远未来 + 近过去 → 近过去在顶（|ts-now| 主键，直锁 BUG-024 首屏被最远未来占据）', () => {
    // future 距 now = 3 天，past 距 now = 5 分钟；5min < 3d ⇒ past 更近、必在顶（SPEC-2.2a 主键）
    const order = renderOrder([evt('mix-future', NOW + 3 * DAY), evt('mix-past', NOW - 5 * MIN)])
    expect(order).toEqual(['mix-past', 'mix-future'])
    // 反例硬断言：首屏首行绝不是最远未来事件（BUG-024 回归锁）
    expect(order[0]).not.toBe('mix-future')
  })

  it('全未来退化：+1h/+12h/+9d → +1h 在顶（倒计时序，最近发生者在上，SPEC-2.2a）', () => {
    const order = renderOrder([
      evt('f-9d', NOW + 9 * DAY),
      evt('f-1h', NOW + 1 * HOUR),
      evt('f-12h', NOW + 12 * HOUR),
    ])
    expect(order).toEqual(['f-1h', 'f-12h', 'f-9d'])
  })

  it('全过去退化：等价 ts 倒序（最新在上，SPEC-2.2a），零回归', () => {
    const order = renderOrder([
      evt('p-2d', NOW - 2 * DAY),
      evt('p-1min', NOW - 1 * MIN),
      evt('p-1h', NOW - 1 * HOUR),
    ])
    // ts 倒序：最新（-1min，离 now 最近）在上，最旧（-2d）在下
    expect(order).toEqual(['p-1min', 'p-1h', 'p-2d'])
  })

  it('等距 tie-break：|ts-now| 相等时未来先于过去、同侧再按 id 升序（SPEC-2.2a）', () => {
    // 四条均距 now 2h：两未来（ts=now+2h）、两过去（ts=now-2h）
    const order = renderOrder([
      evt('p-b', NOW - 2 * HOUR),
      evt('f-b', NOW + 2 * HOUR),
      evt('p-a', NOW - 2 * HOUR),
      evt('f-a', NOW + 2 * HOUR),
    ])
    // 未来（f-*）整体先于过去（p-*）；同侧内 id 升序 ⇒ f-a,f-b,p-a,p-b
    expect(order).toEqual(['f-a', 'f-b', 'p-a', 'p-b'])
  })

  it('空态：无事件时显示「暂无事件」、无列表行、不崩（SPEC-2.2a）', () => {
    const html = renderHtml([])
    expect(html).toContain('暂无事件')
    expect(renderOrder([])).toEqual([])
    expect(html).not.toContain('event-row__title')
  })
})
