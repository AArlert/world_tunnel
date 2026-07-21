import { expect, test } from '@playwright/test'
import { bootWithGdacsEvents, type GdacsFixtureInput } from './eventPanelFixture'
import { waitForGlobeDebug } from './globeDebug'

// M3-01：事件流行 severity 单调编码——不变量 B（视觉；e2e）。
//
// 判据出处（doc/testplan.md M3-01 行文；断言期望值只从 doc/spec.md 推导，逐条标注 SPEC 条目）：
//   - SPEC-2.2a（v0.2.13 D25 落定）主通道：列表行**标题文本明度**三档单调递增——
//     sev3 `#eef2f7` 亮于 sev2 `#c2ccd8` 亮于 sev1 `#8794a3`；三档 sRGB 亮度、以及对面板底的
//     WCAG 对比率均单调递增，全档 ≥4.5:1 AA。
//   - SPEC-2.2a 行首分类色圆点**镜像球面标记的 severity 变换**：色相=分类不随 severity 变，
//     明度/饱和随 severity，取 SPEC-3.7 六类分级值（乘子规则为权威、分级 hex 为派生参考）。
//
// 事件注入沿用 e2e/eventPanelFixture.ts 头注理由（走真实 dataLayer 链路，面板消费 React state，
// 而非 globeDebug.setEvents 直达 GlobeScene）：GDACS 信源，eventtype 留空即 'EQ' → disaster
// （normalizeGroup 分类规则，仅供构造合法 mock，非期望值来源），alertlevel Green/Orange/Red
// → severity 1/2/3（SPEC-5.3，同一构造手法）。

const MIN = 60_000

// ---- 亮度/对比算法（两套口径，题面明确要求区分，均在此注明出处）----

/** 从 "rgb(r, g, b)" / "rgba(r, g, b, a)" 解析 RGB 三通道（忽略 alpha，理由见下方面板底注释）。
 * 同 e2e/event-panel.spec.ts、e2e/panel-brightness-cap.spec.ts 既有解析手法。 */
function parseRgbChannels(css: string): [number, number, number] {
  const m = css.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) throw new Error(`无法解析颜色字符串：${css}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

/** 「sRGB 亮度」= gamma 编码 Rec.709 luma，对 0-255 值直接加权、不线性化。
 * 同 e2e/panel-brightness-cap.spec.ts / e2e/day-night-hemisphere-contrast.spec.ts C-2 口径，
 * 与下方 WCAG 对比率（线性化后计算）是两套不同算法，题面要求区分标注。 */
function gammaLuma([r, g, b]: readonly number[]): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2.x 标准相对亮度：sRGB 通道先线性化（≤0.03928 走除以 12.92 的线性段，否则走 2.4 次幂的
 * gamma 曲线），再按 0.2126/0.7152/0.0722 加权求和。算法出处：WCAG 2.1 SC 1.4.3 附带的
 * relative luminance 定义（https://www.w3.org/TR/WCAG21/#dfn-relative-luminance）。 */
function relativeLuminance([r, g, b]: readonly number[]): number {
  const lin = (c: number) => {
    const cs = c / 255
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** WCAG 对比率 = (L_lighter + 0.05) / (L_darker + 0.05)（同上 SC 1.4.3 定义）。 */
function contrastRatio(a: readonly number[], b: readonly number[]): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const lighter = Math.max(la, lb)
  const darker = Math.min(la, lb)
  return (lighter + 0.05) / (darker + 0.05)
}

/** sRGB(0-255) → HSL（h 度、s/l ∈[0,1]），标准公式；同 e2e/marker-severity-tri-channel.spec.ts。 */
function rgbToHsl([r, g, b]: readonly number[]): { h: number; s: number; l: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  let s = 0
  if (d > 1e-9) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === rn) h = ((gn - bn) / d) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s, l }
}

function hueDiff(a: number, b: number): number {
  const d = Math.abs(a - b)
  return Math.min(d, 360 - d)
}

function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff]
}

// SPEC-2.2a 标题明度三档 pin 值（逐字照条目正文，非从实现读取）
const TITLE_HEX: Record<1 | 2 | 3, [number, number, number]> = {
  3: hexToRgb(0xeef2f7),
  2: hexToRgb(0xc2ccd8),
  1: hexToRgb(0x8794a3),
}

// SPEC-3.7 disaster 分类六类分级表（逐字照条目正文；乘子规则为权威、此为派生参考，用于圆点比对）
const DOT_HEX: Record<1 | 2 | 3, [number, number, number]> = {
  3: hexToRgb(0xff4d4f),
  2: hexToRgb(0xed484a),
  1: hexToRgb(0xcf4142),
}

const ALERT_LEVEL: Record<1 | 2 | 3, GdacsFixtureInput['alertlevel']> = {
  3: 'Red',
  2: 'Orange',
  1: 'Green',
}

async function bootAndReady(page: import('@playwright/test').Page, events: GdacsFixtureInput[]) {
  await bootWithGdacsEvents(page, events)
  await waitForGlobeDebug(page)
}

function rowByTitle(page: import('@playwright/test').Page, title: string) {
  return page.locator('.event-row', { has: page.locator('.event-row__title', { hasText: title }) })
}

test('标题文本明度三档单调、对面板底 WCAG 对比全档 ≥4.5:1 AA（主通道，SPEC-2.2a）', async ({ page }) => {
  const now = Date.now()
  const titles: Record<1 | 2 | 3, string> = { 3: 'Sev3 Title Row', 2: 'Sev2 Title Row', 1: 'Sev1 Title Row' }
  const events: GdacsFixtureInput[] = ([3, 2, 1] as const).map((sev, i) => ({
    eventid: `m3-01-title-${sev}`,
    name: titles[sev],
    alertlevel: ALERT_LEVEL[sev],
    lat: -40 + i * 40,
    lon: -100 + i * 80,
    datemodifiedMs: now - (i + 1) * MIN,
  }))
  await bootAndReady(page, events)
  await expect(page.locator('.event-row')).toHaveCount(3)

  // 对面板底 = .event-panel 声明背景色（RGB 三通道，忽略 alpha）。面板底为半透明玻璃质感
  // （rgba(10,12,20,0.75)，属实现自由度），与 e2e/panel-brightness-cap.spec.ts（M3-05）同一
  // 量测口径一致：契约测的是面板自身选定底色，不测合成后随此刻球面背景浮动的像素。
  const panelBgCss = await page.locator('.event-panel').evaluate((el) => getComputedStyle(el).backgroundColor)
  const panelRgb = parseRgbChannels(panelBgCss)

  const titleRgb: Record<1 | 2 | 3, [number, number, number]> = { 3: [0, 0, 0], 2: [0, 0, 0], 1: [0, 0, 0] }
  for (const sev of [3, 2, 1] as const) {
    const css = await rowByTitle(page, titles[sev]).locator('.event-row__title').evaluate((el) => getComputedStyle(el).color)
    titleRgb[sev] = parseRgbChannels(css)
    expect(titleRgb[sev], `sev${sev} 标题色 ${css} 应严格等于 SPEC-2.2a pin 值`).toEqual(TITLE_HEX[sev])
  }

  // 三档 sRGB 亮度单调递增（sev3 > sev2 > sev1，SPEC-2.2a「三档明度单调递增」，gamma luma 口径）
  const luma = { 3: gammaLuma(titleRgb[3]), 2: gammaLuma(titleRgb[2]), 1: gammaLuma(titleRgb[1]) }
  expect(luma[3], `sev3 luma ${luma[3].toFixed(1)} 应 > sev2 luma ${luma[2].toFixed(1)}`).toBeGreaterThan(luma[2])
  expect(luma[2], `sev2 luma ${luma[2].toFixed(1)} 应 > sev1 luma ${luma[1].toFixed(1)}`).toBeGreaterThan(luma[1])

  // 三档对面板底 WCAG 对比率单调递增、全档 ≥4.5:1 AA（SPEC-2.2a）
  const contrast = {
    3: contrastRatio(titleRgb[3], panelRgb),
    2: contrastRatio(titleRgb[2], panelRgb),
    1: contrastRatio(titleRgb[1], panelRgb),
  }
  for (const sev of [3, 2, 1] as const) {
    expect(contrast[sev], `sev${sev} 对面板底对比率 ${contrast[sev].toFixed(2)}:1 应 ≥ 4.5:1 AA`).toBeGreaterThanOrEqual(4.5)
  }
  expect(contrast[3], `sev3 对比 ${contrast[3].toFixed(2)} 应 > sev2 对比 ${contrast[2].toFixed(2)}`).toBeGreaterThan(contrast[2])
  expect(contrast[2], `sev2 对比 ${contrast[2].toFixed(2)} 应 > sev1 对比 ${contrast[1].toFixed(2)}`).toBeGreaterThan(contrast[1])

  // 视觉存证（testplan M3-01 标「视觉」，需附截图）：三档标题明度同屏可辨
  await page.screenshot({ path: 'test-results/event-row-severity-title.png' })
})

test('行首分类色圆点镜像球面 severity 变换：色相恒定、明度/饱和随 severity 取 SPEC-3.7 分级值', async ({
  page,
}) => {
  const now = Date.now()
  const titles: Record<1 | 2 | 3, string> = { 3: 'Sev3 Dot Row', 2: 'Sev2 Dot Row', 1: 'Sev1 Dot Row' }
  const events: GdacsFixtureInput[] = ([3, 2, 1] as const).map((sev, i) => ({
    eventid: `m3-01-dot-${sev}`,
    name: titles[sev],
    alertlevel: ALERT_LEVEL[sev],
    lat: -40 + i * 40,
    lon: -100 + i * 80,
    datemodifiedMs: now - (i + 1) * MIN,
  }))
  await bootAndReady(page, events)
  await expect(page.locator('.event-row')).toHaveCount(3)

  // 圆点背景色对 CSS 无抗锯齿/合成噪声（DOM 元素纯色 background，非画布像素），ε=1 只兜浮点
  // 取整漂移；对照 e2e/marker-severity-tri-channel.spec.ts 画布采样场景的 ε=6（那里另有
  // WebGL 渲染/抗锯齿噪声源，本场景没有该噪声源，故容差更紧）。
  const EPS = 1
  const dotRgb: Record<1 | 2 | 3, [number, number, number]> = { 3: [0, 0, 0], 2: [0, 0, 0], 1: [0, 0, 0] }
  for (const sev of [3, 2, 1] as const) {
    const css = await rowByTitle(page, titles[sev]).locator('.event-row__dot').evaluate((el) => getComputedStyle(el).backgroundColor)
    dotRgb[sev] = parseRgbChannels(css)
    for (let i = 0; i < 3; i++) {
      expect(
        Math.abs(dotRgb[sev][i] - DOT_HEX[sev][i]),
        `sev${sev} 圆点色 ${css} 第 ${i} 通道对 SPEC-3.7 disaster 分级参考 ${DOT_HEX[sev]} 应 ≤ ±${EPS}`,
      ).toBeLessThanOrEqual(EPS)
    }
  }

  const hsl = { 3: rgbToHsl(dotRgb[3]), 2: rgbToHsl(dotRgb[2]), 1: rgbToHsl(dotRgb[1]) }

  // 色相=分类不随 severity 变（SPEC-2.2a「镜像球面标记的 severity 变换」+ SPEC-3.7「色相不动」），
  // 容差 ±2° 同 e2e/marker-severity-tri-channel.spec.ts HUE_TOL_DEG 惯例（sRGB→HSL 取整漂移）
  const HUE_TOL_DEG = 2
  expect(hueDiff(hsl[2].h, hsl[3].h), `sev2 色相 ${hsl[2].h.toFixed(1)}° 对 sev3 ${hsl[3].h.toFixed(1)}° 应 ≤ ±${HUE_TOL_DEG}°`).toBeLessThanOrEqual(HUE_TOL_DEG)
  expect(hueDiff(hsl[1].h, hsl[3].h), `sev1 色相 ${hsl[1].h.toFixed(1)}° 对 sev3 ${hsl[3].h.toFixed(1)}° 应 ≤ ±${HUE_TOL_DEG}°`).toBeLessThanOrEqual(HUE_TOL_DEG)

  // 明度/饱和随 severity 单调递减（SPEC-3.7 乘子规则：L× 1.00/0.93/0.82，S× 1.00/0.82/0.60）
  expect(hsl[3].l, 'sev3 明度应 > sev2').toBeGreaterThan(hsl[2].l)
  expect(hsl[2].l, 'sev2 明度应 > sev1').toBeGreaterThan(hsl[1].l)
  expect(hsl[3].s, 'sev3 饱和应 > sev2').toBeGreaterThan(hsl[2].s)
  expect(hsl[2].s, 'sev2 饱和应 > sev1').toBeGreaterThan(hsl[1].s)
})
