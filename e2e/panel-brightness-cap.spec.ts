import { expect, test } from '@playwright/test'
import { waitForGlobeDebug } from './globeDebug'

// M3-05：面板不亮于球（视觉；e2e）。
//
// 判据出处（doc/testplan.md M3-05 行文；断言期望值只从 doc/spec.md 推导，逐条标注 SPEC）：
//   - SPEC-2.2 v0.2.13 追加句：「面板底亮度不得高于夜半球底面（SPEC-3.2a 夜端 `#0d1827`），
//     使面板退后、球为本体（D3「球为本体、列表从属」）；面板具体底色/边框/圆角/质感（实底或
//     玻璃）属 UI 实现自由度」——本场景只断言相对亮度上限，不断言具体底色/边框/圆角/质感。
//
// 量测对象 = 面板 CSS 声明的 background-color（getComputedStyle，只取 RGB 三通道、忽略
// alpha），而非屏幕合成后像素。理由：
//   ① spec 显式把「实底或玻璃」列为实现自由度——面板允许半透明 + backdrop-filter，合成后
//      像素亮度会随此刻叠加在球面何处（昼半球/夜半球/大气边缘）浮动，那是不可控的渲染时刻
//      因素，不是「面板底色」这一设计契约本身要检验的量；契约测的是面板自身选定的底色是否
//      比夜端色更亮，不是「此刻恰好叠加在什么背景之上」。
//   ② 与 REV-013 §5.3 仲裁依据的量测口径一致——该条款以两个色板 swatch 的 gamma luma 直接
//      比较作为契约可算天花板（doc/review/REV-013-visual-batch1-arbitration.md §5.3：
//      「面板阶 1 Y 20.7 < 夜半球阶 2 Y 22.7」，色值分别为 aes 方案推荐面板色 `#0c1622`
//      （0.2126*12+0.7152*22+0.0722*34≈20.7）与已 pin 的夜端色 `#0d1827`
//      （0.2126*13+0.7152*24+0.0722*39≈22.7），与本文件下方 gammaLuma() 同一公式，数值吻合）。
//   ③ 与 e2e/event-panel.spec.ts 解析行内圆点颜色（getComputedStyle + 正则解析 rgb()/忽略
//      alpha）同一手法，非本场景自创量测口径。
//
// 亮度定义 = gamma 编码 Rec.709 luma（同 e2e/day-night-hemisphere-contrast.spec.ts C-2 口径：
// 0.2126R+0.7152G+0.0722B，对 0-255 sRGB 值直接加权、不线性化）。

function gammaLuma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** 解析 "rgb(r, g, b)" / "rgba(r, g, b, a)" 字符串的 RGB 三通道（忽略 alpha，理由见头注①）。 */
function parseRgbChannels(css: string): [number, number, number] {
  const m = css.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) throw new Error(`无法解析颜色字符串：${css}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

// SPEC-3.2a 已 pin 的夜端底面色 `#0d1827` 的 gamma luma（SPEC-2.2 的相对上限判据）
const NIGHT_BASE_LUMA = gammaLuma(0x0d, 0x18, 0x27)

test.describe('M3-05 面板不亮于球（SPEC-2.2 相对亮度契约）', () => {
  test('事件流面板声明底色 luma 不高于夜半球底面 luma（#0d1827）', async ({ page }) => {
    await page.goto('/')
    await waitForGlobeDebug(page)

    const panel = page.locator('.event-panel')
    await expect(panel).toBeVisible()
    const bgCss = await panel.evaluate((el) => getComputedStyle(el).backgroundColor)
    const [r, g, b] = parseRgbChannels(bgCss)
    const panelLuma = gammaLuma(r, g, b)

    expect(
      panelLuma,
      `面板声明底色 ${bgCss} 的 luma=${panelLuma.toFixed(2)} 应 ≤ 夜半球底面 luma=` +
        `${NIGHT_BASE_LUMA.toFixed(2)}（SPEC-2.2）`,
    ).toBeLessThanOrEqual(NIGHT_BASE_LUMA)

    // 视觉存证（testplan M3-05 标「视觉」，需附截图）：面板与球同屏，人工判读面板是否退后、球为本体
    await page.screenshot({ path: 'test-results/panel-brightness-cap.png' })
  })
})
