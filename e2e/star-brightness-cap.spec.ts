import { expect, test } from '@playwright/test'
import { canvasBufferSize, maxLumaInRegion, sampleCamera, waitForGlobeDebug, waitNextFrame } from './globeDebug'

// M3-04：星空不盖过信息层（视觉；e2e，真实 Chromium + WebGL 渲染）。
//
// 判据出处（doc/testplan.md M3-04 行文；断言期望值只从 doc/spec.md 推导，逐条标注 SPEC）：
//   - SPEC-3.5 v0.2.13 追加句：「星最大亮度不得高于昼面海岸线（SPEC-3.2a `#6690b3`）——星空
//     为最底层深度、不得盖过结构层与信息层而成为视觉噪声（保 D3「宁静」、信息永远比结构响，
//     D23 L0）；星亮度分布/上限数值/星色属实现自由度」——本场景只断言相对上限，不断言星色/
//     分布/具体亮度值。
//   - 「任意机位」不可穷举全部相机位姿：本场景取默认机位（SPEC-3.1）+ 一次显著旋转后的
//     机位两组代表性采样（旋转手法沿用 e2e/starfield.spec.ts 对相机拖拽的既有验证方式）；
//     星空随相机旋转会把不同星点转入采样区（SPEC-3.5「随相机旋转」），两组机位合起来比单一
//     机位提供更强代表性，但仍非穷举——遗留风险写入交付汇报，不作为放宽判据的理由。
//
// 亮度定义 = gamma 编码 Rec.709 luma（同 e2e/day-night-hemisphere-contrast.spec.ts C-2 口径：
// 0.2126R+0.7152G+0.0722B，对 0-255 sRGB 值直接加权、不线性化）。`#6690b3` → luma≈137.60。
//
// 采样安全区：复用 e2e/starfield.spec.ts 已验证的手法——canvas 左侧窄条不覆盖地球本体/大气
// 辉光（该文件几何论证：fov=45°/距离 3.2/球半径 1 时球面半张角≈18.2°，远小于半 FOV 22.5°，
// 左侧 20% 宽度留有安全余量）。本场景在此基础上收紧至 12%：M1-08（该文件判据）只做「像素是否
// 变化」的差异对比，边缘误差不影响判据；本场景直接比较绝对亮度值，若大气辉光壳（SPEC-3.4，
// 加法混合+菲涅尔边缘增强，见 src/globe/atmosphere.ts）的极边缘像素混入采样区，会产生与星空
// 无关的伪高读数——收紧安全边界以留足余量（不影响可用星点覆盖：2000 颗星均匀分布于整个球壳
// 天空，12% 宽的窄条仍能采到星点）。

function starZoneRegion(width: number, height: number) {
  return { x: 0, y: 0, width: Math.round(width * 0.12), height }
}

// SPEC-3.2a 昼面海岸线 pin 色 `#6690b3` 的 gamma luma（SPEC-3.5 的相对上限判据）
const COAST_DAY_LUMA = 0.2126 * 0x66 + 0.7152 * 0x90 + 0.0722 * 0xb3

test.describe('M3-04 星空不盖过信息层（SPEC-3.5 相对亮度契约）', () => {
  test('默认机位与旋转后机位，星空安全区最大 luma 均不高于昼面海岸线 luma', async ({ page }) => {
    test.setTimeout(60_000)
    // 拦截跨源请求：屏蔽真实数据层轮询，避免测试运行期间产生真实网络负担/等待
    // （同 day-night-hemisphere-contrast.spec.ts 的确定性手法；标记本身渲染于球面几何范围内，
    // 几何上不可能落入本场景的星空安全区，故此处主要为测试稳定性/时长考虑，非防污染必需）。
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url())
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return route.continue()
      return route.abort()
    })
    await page.bringToFront()
    await page.goto('/')
    await waitForGlobeDebug(page)

    const { width, height } = await canvasBufferSize(page)
    const region = starZoneRegion(width, height)

    // --- 机位一：默认视角（SPEC-3.1） ---
    await waitNextFrame(page)
    const atDefault = await maxLumaInRegion(page, region)
    expect(
      atDefault.maxLuma,
      `默认机位星空安全区最大 luma=${atDefault.maxLuma.toFixed(2)}（像素 ${atDefault.x},${atDefault.y}）` +
        `应 ≤ 昼面海岸线 luma=${COAST_DAY_LUMA.toFixed(2)}（SPEC-3.5）`,
    ).toBeLessThanOrEqual(COAST_DAY_LUMA)

    // --- 机位二：拖拽相机绕球心转动一个明显角度，把不同星点转入采样区（手法同 starfield.spec.ts）---
    const camBefore = await sampleCamera(page)
    await page.mouse.move(400, 300)
    await page.mouse.down()
    await page.mouse.move(700, 300, { steps: 10 })
    await page.mouse.up()
    await waitNextFrame(page)
    const camAfter = await sampleCamera(page)
    // 前置自检（非 SPEC 判据）：确认相机确实转动了，否则第二组机位与第一组重复、采样无意义
    expect(camAfter.x).not.toBeCloseTo(camBefore.x, 3)

    const atRotated = await maxLumaInRegion(page, region)
    expect(
      atRotated.maxLuma,
      `旋转后机位星空安全区最大 luma=${atRotated.maxLuma.toFixed(2)}（像素 ${atRotated.x},${atRotated.y}）` +
        `应 ≤ 昼面海岸线 luma=${COAST_DAY_LUMA.toFixed(2)}（SPEC-3.5）`,
    ).toBeLessThanOrEqual(COAST_DAY_LUMA)

    // 视觉存证（testplan M3-04 标「视觉」，需附截图）
    await page.screenshot({ path: 'test-results/star-brightness-cap.png' })
  })
})
