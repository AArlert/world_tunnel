import { expect, test } from '@playwright/test'
import { bootWithGdacsEvents, type GdacsFixtureInput } from './eventPanelFixture'
import { sampleMarkerCount, waitForGlobeDebug } from './globeDebug'

// M2-13：事件流面板基础结构（e2e）。判据出处（全部只从 doc/spec.md 推导，注释逐条标注
// SPEC 条目；见 doc/testplan.md M2-13 v0.2.8/REV-012 + v0.2.13/REV-013 修订后的行文）：
//   - SPEC-2.2「主区：全屏地球 canvas；右侧悬浮事件流面板（宽 300px，可折叠）」——canvas 占满
//     视口（BUG-029 补齐子句），面板为悬浮层不挤占 canvas。
//   - SPEC-2.2a：列表行三要素——①分类色圆点（取 SPEC-3.7 对应 category **色相**）②标题③相对时间；
//     不变量 A：圆点色相不随 severity 改变（明度/饱和随 severity 的单调性验证归 M3-01/M3-03，不入本场景）；
//     不变量 C：severity 数值/文字/徽章不作显式行元素；列表按「距 now 时间邻近度」升序（主键
//     |ts−now| 升序，等距未来先于过去、再按 id 升序；全部为过去时等价 ts 倒序）；空态「暂无事件」。
//
// 事件注入手法：不用 e2e/globeDebug.ts 的 setDebugEvents（该函数直达 GlobeScene.setEvents，
// 绕过 App.tsx 的 React state，EventPanel 消费不到，见 e2e/eventPanelFixture.ts 头注）；
// 改为拦截网络、经真实 dataLayer 链路（GDACS 信源）驱动，使面板与标记层来自同一份数据。

const MIN = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

/** 从 "rgb(r, g, b)" 解析并算 HSL 色相（度）。用于「圆点取 category 色相」「不变量 A：色相不随
 * severity 改变」的断言——只比 hue，不比明度/饱和（后者随 severity 变，其单调性归 M3-01/M3-03）。 */
function hueOfRgbString(css: string): number {
  const m = css.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) throw new Error(`无法解析颜色字符串：${css}`)
  const r = Number(m[1]) / 255
  const g = Number(m[2]) / 255
  const b = Number(m[3]) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d === 0) return 0
  let h: number
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  h *= 60
  return h < 0 ? h + 360 : h
}

// SPEC-3.7 humanitarian 分类色 #ffc53d 的色相（从条目色值推导，非照抄实现）
const HUMANITARIAN_HUE = hueOfRgbString('rgb(255, 197, 61)')

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
  await expect.poll(() => sampleMarkerCount(page)).toBe(4)

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

test('主区地球 canvas 占满视口，事件流面板悬浮其上不挤占（SPEC-2.2 全屏地球 canvas；BUG-029）', async ({
  page,
}) => {
  // 注入一条事件即可（本用例只验版式，不涉列表内容）
  await bootAndReady(page, [
    { eventid: 'm2-13-canvas', name: 'Canvas Layout Probe', lat: 0, lon: 0, datemodifiedMs: Date.now() - MIN },
  ])

  const viewport = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }))
  const canvasBox = await page.locator('#globe-container canvas').boundingBox()
  if (!canvasBox) throw new Error('#globe-container canvas 未找到或不可见')

  // 「全屏地球 canvas」（SPEC-2.2）：canvas 横向占满整个视口宽度——若面板是分栏而非悬浮，
  // canvas 宽度会被削去约 300px。占满整宽即证明面板为悬浮层（SPEC-2.2「右侧悬浮事件流面板」）。
  expect(canvasBox.x, 'canvas 左缘应贴视口左侧').toBeLessThanOrEqual(1)
  expect(canvasBox.width, 'canvas 宽度应占满视口宽度（面板悬浮不挤占）').toBeGreaterThanOrEqual(viewport.w - 2)
  // 纵向占满主区（顶栏 48px 之下直到视口底）——canvas 下缘贴视口底
  expect(canvasBox.y + canvasBox.height, 'canvas 下缘应贴视口底部').toBeGreaterThanOrEqual(viewport.h - 2)

  // 面板悬浮于 canvas 之上：面板水平跨度落在 canvas 横向范围内（二者重叠而非并排）
  const panelBox = await page.locator('.event-panel').boundingBox()
  if (!panelBox) throw new Error('.event-panel 未找到或不可见')
  expect(panelBox.x, '面板右侧区间应落在 canvas 横向范围内（悬浮重叠）').toBeGreaterThanOrEqual(canvasBox.x)
  expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(canvasBox.x + canvasBox.width + 1)

  // 留存全屏 canvas + 悬浮面板版式截图（SPEC-2.2 版式为可见判据，供证据链）
  await page.screenshot({ path: 'test-results/event-panel-canvas-layout.png' })
})

test('列表行三要素齐备（圆点取 category 色相）、不泄漏 severity/摘要等完整字段（SPEC-2.2a）', async ({
  page,
}) => {
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

  // 结构性约束（不变量 C）：行内只有三个直接子元素（分类色圆点+标题+相对时间），排除第四个字段被渲染
  await expect(row.locator('> *')).toHaveCount(3)

  // ① 分类色圆点取对应 category **色相**（SPEC-2.2a①，取 SPEC-3.7 humanitarian 色）。只断言色相，
  // 不断言明度/饱和的具体档位（那随 severity 变，其单调性验证归 M3-01/M3-03，不入本场景）。
  const dotColor = await row.locator('.event-row__dot').evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(Math.abs(hueOfRgbString(dotColor) - HUMANITARIAN_HUE), '圆点色相应≈humanitarian 分类色相（SPEC-2.2a①/3.7）').toBeLessThanOrEqual(2)

  // ② 标题；③ 相对时间（格式细节属实现自由度，SPEC-2.2a③，只断言其存在）
  await expect(row.locator('.event-row__title')).toHaveText('Test Flood Alpha')
  const timeText = await row.locator('.event-row__time').innerText()
  expect(timeText.trim().length).toBeGreaterThan(0)

  // 摘要不进列表行（SPEC-2.2a 地点/摘要/信源属详情卡）
  const rowText = await row.innerText()
  expect(rowText).not.toContain(summaryToken)
})

test('不变量 A：行首分类色圆点色相不随 severity 改变（SPEC-2.2a）', async ({ page }) => {
  // 同一 category（humanitarian，经 FL）、不同 severity（Red→3 / Green→1）两条事件，
  // 断言两圆点色相相等——色相=分类不随 severity 变（不变量 A，SPEC-2.2a；SPEC-3.7 乘子规则只降明度/饱和）。
  await bootAndReady(page, [
    {
      eventid: 'm2-13-invA-sev3',
      eventtype: 'FL',
      alertlevel: 'Red',
      name: 'Humanitarian Sev3',
      lat: 10,
      lon: 20,
      datemodifiedMs: Date.now() - MIN,
    },
    {
      eventid: 'm2-13-invA-sev1',
      eventtype: 'FL',
      alertlevel: 'Green',
      name: 'Humanitarian Sev1',
      lat: -10,
      lon: -20,
      datemodifiedMs: Date.now() - 2 * MIN,
    },
  ])

  const dots = page.locator('.event-row__dot')
  await expect(dots).toHaveCount(2)
  const colors = await dots.evaluateAll((els) => els.map((el) => getComputedStyle(el as HTMLElement).backgroundColor))
  const hues = colors.map(hueOfRgbString)
  // 两档均为 humanitarian 色相，彼此相等且≈分类色相（±2° 取整漂移）
  expect(Math.abs(hues[0] - hues[1]), `两 severity 圆点色相应相等（不变量 A）：${colors.join(' vs ')}`).toBeLessThanOrEqual(2)
  expect(Math.abs(hues[0] - HUMANITARIAN_HUE)).toBeLessThanOrEqual(2)
})

test('列表按「距 now 时间邻近度」升序（未来近者与过去近者按 |ts-now| 混排；SPEC-2.2a）', async ({ page }) => {
  const now = Date.now()
  // 混合未来/过去，刻意打乱注入顺序，证明渲染顺序来自 |ts-now| 排序而非数组透传或旧 ts 倒序：
  //   RECENT_PAST |1min|、NEAR_FUTURE |30min|、FAR_FUTURE |9day|
  // 新排序（SPEC-2.2a 修订句）：RECENT_PAST < NEAR_FUTURE < FAR_FUTURE；
  // 旧 ts 倒序会把 FAR_FUTURE 顶到首行（BUG-024），故本用例可判别新旧。
  const RECENT_PAST = { title: 'Recent Past', ts: now - MIN }
  const NEAR_FUTURE = { title: 'Near Future', ts: now + 30 * MIN }
  const FAR_FUTURE = { title: 'Far Future', ts: now + 9 * DAY }

  await bootAndReady(
    page,
    [NEAR_FUTURE, FAR_FUTURE, RECENT_PAST].map((e, i) => ({
      eventid: `m2-13-order-${i}`,
      name: e.title,
      lat: 0,
      lon: -150 + i * 100,
      datemodifiedMs: e.ts,
    })),
  )

  const rows = page.locator('.event-row')
  await expect(rows).toHaveCount(3)

  const titles = await page.locator('.event-row__title').allTextContents()
  expect(titles, '按 |ts-now| 升序：过去近者在最前，最远未来沉底（SPEC-2.2a，非旧 ts 倒序）').toEqual([
    RECENT_PAST.title,
    NEAR_FUTURE.title,
    FAR_FUTURE.title,
  ])

  const times = await page.locator('.event-row__time').allTextContents()
  expect(new Set(times).size).toBe(3) // 三档 |ts-now| 差距悬殊，相对时间文本应两两不同（由 ts 派生）
})

test('无事件时显示空状态文案「暂无事件」（SPEC-2.2a）', async ({ page }) => {
  await bootAndReady(page, [])

  await expect(page.locator('.event-panel__empty')).toHaveText('暂无事件')
  await expect(page.locator('.event-row')).toHaveCount(0)
})
