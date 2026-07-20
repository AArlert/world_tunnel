import { expect, test } from '@playwright/test'
import { bootWithGdacsEvents, type GdacsFixtureInput } from './eventPanelFixture'
import { sampleMarkerCount, waitForGlobeDebug } from './globeDebug'

// M2-13：事件流面板基础结构（e2e）。判据出处（全部只从 doc/spec.md 推导，注释逐条标注
// SPEC 条目；见 doc/testplan.md M2-13 扩写后的行文，收口 SPEC-2.2a 此前无场景引用的缺口）：
//   - SPEC-2.2「右侧悬浮事件流面板（宽 300px，可折叠）」。
//   - SPEC-2.2a：列表行三要素——①分类色圆点（取 SPEC-3.7 对应 category 色）②标题③相对时间；
//     ts 倒序（最新在上）；无事件时空状态文案「暂无事件」；severity/地点/摘要/信源不进列表行。
//
// 事件注入手法：不用 e2e/globeDebug.ts 的 setDebugEvents（该函数直达 GlobeScene.setEvents，
// 绕过 App.tsx 的 React state，EventPanel 消费不到，见 e2e/eventPanelFixture.ts 头注）；
// 改为拦截网络、经真实 dataLayer 链路（GDACS 信源）驱动，使面板与标记层来自同一份数据。

const HOUR = 3_600_000
const DAY = 86_400_000

function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff]
}

// SPEC-3.7 六分类色表节选（本文件只用到这一档，逐字照抄条目正文）
const HUMANITARIAN_RGB = hexToRgb(0xffc53d)

async function bootAndReady(page: import('@playwright/test').Page, events: GdacsFixtureInput[]) {
  await bootWithGdacsEvents(page, events)
  await waitForGlobeDebug(page)
}

test('面板初始宽度 300px、折叠/展开双向切换、列表条目数与球面已加载标记数一一对应（SPEC-2.2）', async ({
  page,
}) => {
  const now = Date.now()
  const events: GdacsFixtureInput[] = [0, 1, 2, 3].map((i) => ({
    eventid: `m2-13-count-${i}`,
    name: `Structure Event ${i}`,
    lat: -60 + i * 40,
    lon: -120 + i * 60,
    datemodifiedMs: now - i * HOUR,
  }))
  await bootAndReady(page, events)

  const rows = page.locator('.event-row')
  await expect(rows).toHaveCount(4)

  // 面板内列表条目数 == 球面已加载事件标记数（同一份数据双消费，SPEC-2.2「事件流面板」定名即事件列表语义）
  await expect
    .poll(() => sampleMarkerCount(page))
    .toBe(4)

  const panel = page.locator('.event-panel')
  const expandedBox = await panel.boundingBox()
  if (!expandedBox) throw new Error('.event-panel 未找到或不可见')
  expect(Math.round(expandedBox.width)).toBe(300)

  // 折叠：主区不再显示列表，面板收起明显变窄
  await page.locator('.event-panel__toggle').click()
  await expect(page.locator('.event-panel__list')).toHaveCount(0)
  const collapsedBox = await panel.boundingBox()
  if (!collapsedBox) throw new Error('折叠后 .event-panel 未找到或不可见')
  expect(collapsedBox.width).toBeLessThan(150)

  // 再次点击恢复展开：宽度与列表条目数均复原（双向切换）
  await page.locator('.event-panel__toggle').click()
  await expect(rows).toHaveCount(4)
  const reExpandedBox = await panel.boundingBox()
  if (!reExpandedBox) throw new Error('恢复展开后 .event-panel 未找到或不可见')
  expect(Math.round(reExpandedBox.width)).toBe(300)
})

test('列表行三要素齐备且不泄漏 severity/摘要等完整字段（SPEC-2.2a）', async ({ page }) => {
  const summaryToken = 'DO-NOT-LEAK-SUMMARY-TOKEN'
  await bootAndReady(page, [
    {
      eventid: 'm2-13-row-1',
      eventtype: 'FL', // → humanitarian（normalizeGroup 分类规则，仅供构造合法 mock）
      alertlevel: 'Red', // → severity 3；本场景不断言 severity 数值本身，只断言其不被渲染
      name: 'Test Flood Alpha',
      htmldescription: summaryToken,
      lat: 10,
      lon: 20,
      datemodifiedMs: Date.now() - 10_000,
    },
  ])

  const row = page.locator('.event-row')
  await expect(row).toHaveCount(1)

  // 结构性约束：行内只有三个直接子元素（分类色圆点+标题+相对时间），排除任何第四个字段被渲染
  await expect(row.locator('> *')).toHaveCount(3)

  const dotColor = await row.locator('.event-row__dot').evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(dotColor).toBe(`rgb(${HUMANITARIAN_RGB.join(', ')})`)

  await expect(row.locator('.event-row__title')).toHaveText('Test Flood Alpha')

  const timeText = await row.locator('.event-row__time').innerText()
  expect(timeText.trim().length).toBeGreaterThan(0) // 相对时间存在（格式细节属实现自由度，SPEC-2.2a③）

  const rowText = await row.innerText()
  expect(rowText).not.toContain(summaryToken) // 摘要不进列表行（SPEC-2.2a）
})

test('列表按 ts 倒序排列（最新在上），相对时间随 ts 变化（SPEC-2.2a）', async ({ page }) => {
  const now = Date.now()
  const NEWEST = { title: 'Event Newest', ts: now - HOUR }
  const MIDDLE = { title: 'Event Middle', ts: now - DAY }
  const OLDEST = { title: 'Event Oldest', ts: now - 3 * DAY }

  // 注入顺序刻意打乱（MIDDLE, OLDEST, NEWEST），证明渲染顺序来自 ts 排序而非数组透传顺序
  await bootAndReady(page, [MIDDLE, OLDEST, NEWEST].map((e, i) => ({
    eventid: `m2-13-order-${i}`,
    name: e.title,
    lat: 0,
    lon: -150 + i * 100,
    datemodifiedMs: e.ts,
  })))

  const rows = page.locator('.event-row')
  await expect(rows).toHaveCount(3)

  const titles = await page.locator('.event-row__title').allTextContents()
  expect(titles).toEqual([NEWEST.title, MIDDLE.title, OLDEST.title])

  const times = await page.locator('.event-row__time').allTextContents()
  expect(new Set(times).size).toBe(3) // 三档 ts 差距悬殊，相对时间文本应两两不同（由 ts 派生，非静态值）
})

test('无事件时显示空状态文案「暂无事件」（SPEC-2.2a）', async ({ page }) => {
  await bootAndReady(page, [])

  await expect(page.locator('.event-panel__empty')).toHaveText('暂无事件')
  await expect(page.locator('.event-row')).toHaveCount(0)
})
