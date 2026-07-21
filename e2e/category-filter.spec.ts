import { expect, test, type Page } from '@playwright/test'
import { bootWithGdacsEvents } from './eventPanelFixture'
import {
  canvasBufferSize,
  findColorInRegion,
  waitForGlobeDebug,
  waitForSurfaceReady,
  waitNextFrame,
} from './globeDebug'

// M2-19：六分类过滤控件——首屏可见性与过滤生效（e2e）。
// 期望值出处（断言期望值只从 doc/spec.md 推导，逐条标注 SPEC 条目）：
//   - SPEC-2.4①「基础分类过滤（六 category 开关）前移至 M2，作为首屏可见控件（不进设置面板）」。
//   - SPEC-3.7 六值 category 枚举：disaster/conflict/humanitarian/news/launch/flight（data-category 期望集）。
//   - SPEC-8.1「分类（category 集合）」集合语义：任意子集组合、非互斥单选。
//   - SPEC-2.2 事件流面板同源事件集：过滤对球面标记与事件流面板列表两处同步生效。
//
// 事件注入手法：走真实 dataLayer 链路（GDACS 信源 mock，见 e2e/eventPanelFixture.ts），
// 使标记层与事件流面板消费 App.tsx 同一份 store 快照并共同经 enabled 集合过滤（src/App.tsx）。
// GDACS 归一化仅产出 disaster（eventtype 非 DR/FL）与 humanitarian（DR/FL）两类——足以覆盖
// 「关某类→仅该类消失、其余保留」「多类子集组合」「独立再切换证明非互斥」的集合语义判据；
// conflict/news/launch/flight 无 M2 信源产事件（GDELT/opensky 属 M3），其开关的 DOM 存在与
// 可切换性在「六开关」用例校验，事件级过滤俟 M3 有源后补（见交付汇报遗留风险）。
//
// 标记层消失校验用「像素」而非「实例数」：MarkerLayer 的 InstancedMesh.count 是历史高水位
// （freeSlot 只零缩放隐藏、不回退 count，见 src/globe/markers.ts），过滤移除后 count 不下降，
// 故 sampleMarkerCount 不适用于「减少」方向；改为在 canvas 上搜索该分类色像素（SPEC-3.7 色表），
// 移除后零缩放标记不再渲染 → 该色像素归零。全画布搜索可行的前提：SPEC-3.7 六色与矢量地球
// 底色/海岸线/网格/大气/星点各通道区间互斥，故某分类色像素只可能来自该分类标记（下方色值皆抄 SPEC-3.7）。

const DISASTER_RGB: [number, number, number] = [0xff, 0x4d, 0x4f] // SPEC-3.7 disaster
const HUMANITARIAN_RGB: [number, number, number] = [0xff, 0xc5, 0x3d] // SPEC-3.7 humanitarian
const COLOR_TOL = 25

// SPEC-3.7 六值 category 枚举（data-category 期望集，逐字照条目）
const SIX_CATEGORIES = ['disaster', 'conflict', 'humanitarian', 'news', 'launch', 'flight']

// 画布中性落点（明显偏离所有前半球标记投影）：click 触发 canvas pointerdown 重置 SPEC-7.3
// 空闲自转计时，避免测试耗时累计触发自转、使前半球标记转到背面被遮挡而误判为「已移除」。
async function resetIdle(page: Page) {
  await page.mouse.click(60, 700)
}

// canvas 上该分类色像素总数（SPEC-3.7 色表命中数）：>0 即该类标记在渲染，0 即不在渲染。
async function countColor(page: Page, rgb: [number, number, number]): Promise<number> {
  const { width, height } = await canvasBufferSize(page)
  const hit = await findColorInRegion(page, { x: 0, y: 0, width, height }, rgb, COLOR_TOL)
  return hit?.count ?? 0
}

test('六个分类开关首屏可见、带 SPEC-3.7 正确 data-category、默认全开且可直接切换（SPEC-2.4①）', async ({
  page,
}) => {
  await bootWithGdacsEvents(page, []) // 拦截网络、空事件；校验开关 DOM 无需事件
  await waitForGlobeDebug(page)

  const toggles = page.locator('[data-category]')
  await expect(toggles).toHaveCount(6) // 六 category 开关（SPEC-2.4①）

  // 首屏可见：无需打开设置面板等额外导航即可直接可见（SPEC-2.4①「作为首屏可见控件（不进设置面板）」）
  for (let i = 0; i < 6; i++) await expect(toggles.nth(i)).toBeVisible()

  // data-category 集合精确等于 SPEC-3.7 六值枚举
  const cats = await toggles.evaluateAll((els) => els.map((e) => e.getAttribute('data-category')))
  expect([...cats].sort()).toEqual([...SIX_CATEGORIES].sort())

  // 默认全开（category 集合默认全选，SPEC-8.1/2.4①）
  for (const c of SIX_CATEGORIES) {
    await expect(page.locator(`[data-category="${c}"]`)).toHaveAttribute('aria-pressed', 'true')
  }

  // 可直接操作：点击翻转 aria-pressed、再点回（操作性；集合过滤的实际生效在下方用例校验）
  const disaster = page.locator('[data-category="disaster"]')
  await disaster.click()
  await expect(disaster).toHaveAttribute('aria-pressed', 'false')
  await disaster.click()
  await expect(disaster).toHaveAttribute('aria-pressed', 'true')
})

test('关闭某分类：该类标记与列表两处同步消失、其余保留；重开恢复（SPEC-2.4①/8.1/2.2）', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const now = Date.now()
  // 两枚前半球净空标记（severity 3 = alertlevel Red，像素足印更大更稳）：
  //   disaster（eventtype EQ）与 humanitarian（eventtype FL）
  await bootWithGdacsEvents(page, [
    { eventid: 'm2-19-b-disaster', eventtype: 'EQ', name: 'B Disaster', alertlevel: 'Red', lat: -15, lon: -10, datemodifiedMs: now },
    { eventid: 'm2-19-b-humanitarian', eventtype: 'FL', name: 'B Humanitarian', alertlevel: 'Red', lat: 20, lon: 30, datemodifiedMs: now - 1000 },
  ])
  await waitForGlobeDebug(page)
  await waitForSurfaceReady(page)

  const rows = page.locator('.event-row')
  await expect(rows).toHaveCount(2)

  // 基线：两类标记色像素均在（前置自检 + 「显示」态）
  await resetIdle(page)
  await waitNextFrame(page)
  await expect.poll(() => countColor(page, DISASTER_RGB)).toBeGreaterThan(0)
  await expect.poll(() => countColor(page, HUMANITARIAN_RGB)).toBeGreaterThan(0)

  // 关闭 disaster：列表仅剩 humanitarian 行；标记层 disaster 色像素归零、humanitarian 仍在（两处同步）
  await page.locator('[data-category="disaster"]').click()
  await expect(rows).toHaveCount(1)
  await expect(rows.locator('.event-row__title')).toHaveText('B Humanitarian')
  await resetIdle(page)
  await waitNextFrame(page)
  await expect.poll(() => countColor(page, DISASTER_RGB)).toBe(0) // 标记层：该类消失
  await expect.poll(() => countColor(page, HUMANITARIAN_RGB)).toBeGreaterThan(0) // 其余保留

  // 重新开启 disaster：列表恢复 2 行、disaster 标记像素回归（SPEC-8.1 重开恢复显示）
  await page.locator('[data-category="disaster"]').click()
  await expect(rows).toHaveCount(2)
  await resetIdle(page)
  await waitNextFrame(page)
  await expect.poll(() => countColor(page, DISASTER_RGB)).toBeGreaterThan(0)
})

test('子集组合与非互斥单选：多类同时关、独立再切换互不牵连（SPEC-8.1 集合语义）', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const now = Date.now()
  // 4 事件：2 disaster + 2 humanitarian（本用例查列表行的集合过滤，坐标任意合法即可）
  await bootWithGdacsEvents(page, [
    { eventid: 'm2-19-c-d1', eventtype: 'EQ', name: 'C Disaster 1', lat: -20, lon: -40, datemodifiedMs: now },
    { eventid: 'm2-19-c-d2', eventtype: 'EQ', name: 'C Disaster 2', lat: -10, lon: -30, datemodifiedMs: now - 1000 },
    { eventid: 'm2-19-c-h1', eventtype: 'DR', name: 'C Humanitarian 1', lat: 10, lon: 30, datemodifiedMs: now - 2000 },
    { eventid: 'm2-19-c-h2', eventtype: 'FL', name: 'C Humanitarian 2', lat: 25, lon: 40, datemodifiedMs: now - 3000 },
  ])
  await waitForGlobeDebug(page)

  const rows = page.locator('.event-row')
  await expect(rows).toHaveCount(4) // 默认全开：disaster 与 humanitarian 同时显示 → 多类同时开（非互斥）

  // 关 disaster（子集：仅 humanitarian 开）→ 剩 2 行且均为 humanitarian
  await page.locator('[data-category="disaster"]').click()
  await expect(rows).toHaveCount(2)
  const titles1 = await rows.locator('.event-row__title').allTextContents()
  expect(titles1.every((t) => t.startsWith('C Humanitarian'))).toBe(true)

  // 再关 humanitarian（多类同时关，空子集）→ 0 行 + 空状态「暂无事件」
  await page.locator('[data-category="humanitarian"]').click()
  await expect(rows).toHaveCount(0)
  await expect(page.locator('.event-panel__empty')).toHaveText('暂无事件')

  // 独立再开 disaster（humanitarian 仍关）→ 剩 2 行且均为 disaster：
  // 重开一类不牵连另一类开关态，证明集合语义非互斥单选（SPEC-8.1）
  await page.locator('[data-category="disaster"]').click()
  await expect(rows).toHaveCount(2)
  const titles2 = await rows.locator('.event-row__title').allTextContents()
  expect(titles2.every((t) => t.startsWith('C Disaster'))).toBe(true)
  await expect(page.locator('[data-category="disaster"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-category="humanitarian"]')).toHaveAttribute('aria-pressed', 'false')
})

test('全部关闭→空集：标记清空 + 事件流「暂无事件」（SPEC-2.4①/2.2/8.1）', async ({ page }) => {
  test.setTimeout(60_000)
  const now = Date.now()
  await bootWithGdacsEvents(page, [
    { eventid: 'm2-19-d-disaster', eventtype: 'EQ', name: 'D Disaster', alertlevel: 'Red', lat: -15, lon: -10, datemodifiedMs: now },
    { eventid: 'm2-19-d-humanitarian', eventtype: 'FL', name: 'D Humanitarian', alertlevel: 'Red', lat: 20, lon: 30, datemodifiedMs: now - 1000 },
  ])
  await waitForGlobeDebug(page)
  await waitForSurfaceReady(page)

  const rows = page.locator('.event-row')
  await expect(rows).toHaveCount(2)
  await resetIdle(page)
  await waitNextFrame(page)
  await expect.poll(() => countColor(page, DISASTER_RGB)).toBeGreaterThan(0)
  await expect.poll(() => countColor(page, HUMANITARIAN_RGB)).toBeGreaterThan(0)

  // 关闭全部六开关 → 可见集为空（enabled 空集，src/App.tsx 过滤接缝）
  for (const c of SIX_CATEGORIES) await page.locator(`[data-category="${c}"]`).click()

  // 列表空状态（SPEC-2.2a「无事件时显示空状态文案『暂无事件』」）
  await expect(rows).toHaveCount(0)
  await expect(page.locator('.event-panel__empty')).toHaveText('暂无事件')

  // 标记层清空：两类分类色像素均归零（SPEC-3.7 色表）
  await resetIdle(page)
  await waitNextFrame(page)
  await expect.poll(() => countColor(page, DISASTER_RGB)).toBe(0)
  await expect.poll(() => countColor(page, HUMANITARIAN_RGB)).toBe(0)
})
