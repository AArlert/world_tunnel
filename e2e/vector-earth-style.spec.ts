import { expect, test } from '@playwright/test'
import type { DebugHook } from './globeDebug'
import {
  canvasBufferSize,
  findColorInRegion,
  sampleCamera,
  samplePixelBoxStable,
  setEarthRotationY,
  setSunDirVector,
  waitForGlobeDebug,
  waitForSurfaceReady,
  waitNextFrame,
} from './globeDebug'

const DEG = Math.PI / 180

// M2-15：矢量默认风格昼夜混合与视觉参数（e2e，真实 Chromium + WebGL 渲染）。
//
// 判据出处（全部只从 doc/spec.md 推导，逐条标注 SPEC 条目）：
//   - SPEC-3.2②「默认风格＝轻量矢量……免大纹理」——本文件全程 `goto('/')` 不带
//     `?style=satellite`（该参数是 BUG-020 方案 a 引入的 DEV-only 显式切换，见
//     src/App.tsx；不传即走矢量默认路径）。
//   - SPEC-3.2① `t = dot(N, sunDir)`，过渡带 t∈[-0.1,+0.1] smoothstep 混合——跨风格
//     公式，本文件验证其在矢量风格自身 shader（src/globe/shaders/vectorEarth.ts）中
//     同样成立（矢量与卫星是两份独立 shader 源码，不能只凭 M1 已验证卫星路径而假定
//     矢量路径同样正确）。
//   - SPEC-3.2a：底面昼端 `#0a1a2f`、海岸线昼端 `#4db8ff`、网格线 `#1e3a5f`；
//     夜端「QA 断言夜端暗于昼端即可」；夜面海岸线辉光「QA 断言其存在与色相
//     `#7fd4ff`，不断言强度精确值」。
//   - SPEC-3.3 第二句：矢量默认风格夜面表达不依赖夜纹理、昼半球不叠加发光——本文件
//     不使用卫星专属的 `uNightGain`/`uDayMap` 校准手段（那是 day-side-no-lights.spec.ts
//     的卫星路径专属仪器，矢量三层材质结构不同，见 globeDebug.ts setSunDirVector 注释）。
//
// 取样策略（黑盒、不解析/移植 shader 源码，禁止 M1-14 明令禁止的两类写法）：
// 用 findColorInRegion 在画布上以 SPEC-3.2a pin 的三个昼端色为目标做区域扫描，黑盒定位
// 底面/海岸线/网格在屏幕上的真实渲染位置（不依赖透视投影计算或经纬度换算），再对
// 同一批像素坐标在另一种 sunDir 下复测颜色——全程只读黑盒 uniform 名与像素颜色。
//
// 安全采样区域推导（SPEC-3.1：fov 45°、相机距离 3.2、球半径 1.0）：
// 相机到球心距离 d=3.2、球半径 R=1，可见球面上任意点的法线与相机轴夹角 theta 满足
// cos(theta) ∈ [R/d, 1]=[0.3125, 1]（标准透视测地线几何）。若把 sunDir 严格对齐相机轴
// （(0,0,±1)），则 t=cos(theta) 恒不低于 0.3125，远超过渡带上界 0.1——理论上整个可见
// 圆面都应保持纯昼/纯夜。但求交计算表明：给定 SPEC-3.1 的宽画幅（相机 aspect≈1.9），
// 屏幕 NDC 坐标到 theta 的映射在水平方向比垂直方向陡峭得多，越靠近可见圆面边缘（掠射）
// 该点的渲染会失真、不可作为可靠取样点。经独立 node 脚本核算：把采样区域限制在
// 画布中心 ±(0.25·宽, 0.4·高) 的矩形内，该矩形四角对应的 theta 最大约 38.5°
// （cos theta ≈0.78），远离掠射区、也远离过渡带边界，取样稳定可靠。
const SAFE_NDC_X = 0.25
const SAFE_NDC_Y = 0.4

// SPEC-3.2a pin 的三个昼端色（sRGB 0-255）
const BASE_DAY: [number, number, number] = [10, 26, 47] // #0a1a2f
const COAST_DAY: [number, number, number] = [77, 184, 255] // #4db8ff
const GRID_DAY: [number, number, number] = [30, 58, 95] // #1e3a5f

const DAY_SUN = { x: 0, y: 0, z: 1 }
const NIGHT_SUN = { x: 0, y: 0, z: -1 }

/** 纯色扫描容差：矢量三层皆为无纹理的程序化纯色 fill/line，round-trip（sRGB→线性→
 * shader 混合→#include<colorspace_fragment> 转回 sRGB）经独立探测脚本实测偏差 ≤1，
 * 这里取 3 留出跨环境/抗锯齿的安全余量（比 M1 纹理场景的容差更紧，因为没有 JPEG
 * 解码/mipmap 噪声）。 */
const COLOR_TOLERANCE = 3

function luminance([r, g, b]: readonly number[]): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

async function safeRegion(page: Parameters<typeof canvasBufferSize>[0]) {
  const { width, height } = await canvasBufferSize(page)
  const boxW = Math.round(width * SAFE_NDC_X)
  const boxH = Math.round(height * SAFE_NDC_Y)
  return {
    width,
    height,
    region: {
      x: Math.round((width - boxW) / 2),
      y: Math.round((height - boxH) / 2),
      width: boxW,
      height: boxH,
    },
  }
}

/** 前置自检（非 SPEC 判据）：确认矢量默认路径未加载卫星纹理（SPEC-3.2②「免大纹理」）——
 * 卫星路径（src/globe/earth.ts）的材质持有 `uDayMap`/`uNightMap` 贴图 uniform，
 * 矢量路径（src/globe/vectorEarth.ts）的三个材质只有 uColorDay/uColorNight/uSunDir/
 * uTwilight/uGlowColor/uGlowStrength，不含任何贴图 uniform。 */
async function assertNoSatelliteTexture(page: Parameters<typeof canvasBufferSize>[0]) {
  const hasTextureUniform = await page.evaluate(() => {
    const dbg = (window as unknown as { __globeDebug: DebugHook }).__globeDebug
    const earth = dbg.globe.markerRoot.children.find((c) => c.geometry?.type === 'SphereGeometry') as unknown as
      | { material?: { uniforms?: Record<string, unknown> } }
      | undefined
    const keys = Object.keys(earth?.material?.uniforms ?? {})
    return keys.some((k) => /map/i.test(k))
  })
  expect(hasTextureUniform, '矢量默认风格材质不应含任何贴图类 uniform（SPEC-3.2②免大纹理）').toBe(false)
}

test.describe('M2-15 矢量默认风格昼夜混合与视觉参数', () => {
  test('昼半球取样近 SPEC-3.2a 三层昼端色，未加载卫星纹理（SPEC-3.2②/3.2a）', async ({ page }) => {
    await page.bringToFront()
    await page.goto('/')
    await waitForGlobeDebug(page)
    await waitForSurfaceReady(page)

    // 前置自检（非 SPEC 判据）：确认仍是 SPEC-3.1 默认视角，否则安全采样区域的
    // 几何推导（见文件头注）不成立
    const cam = await sampleCamera(page)
    expect(cam.x).toBeCloseTo(0, 3)
    expect(cam.y).toBeCloseTo(0, 3)
    expect(cam.z).toBeCloseTo(3.2, 3)

    await assertNoSatelliteTexture(page)

    await setSunDirVector(page, DAY_SUN)
    await page.waitForTimeout(150)
    await waitNextFrame(page)
    await waitNextFrame(page)

    const { region } = await safeRegion(page)
    const base = await findColorInRegion(page, region, BASE_DAY, COLOR_TOLERANCE)
    const coast = await findColorInRegion(page, region, COAST_DAY, COLOR_TOLERANCE)
    const grid = await findColorInRegion(page, region, GRID_DAY, COLOR_TOLERANCE)

    expect(base, '安全采样区域内应能找到接近底面昼端色 #0a1a2f 的像素（SPEC-3.2a）').not.toBeNull()
    expect(coast, '安全采样区域内应能找到接近海岸线昼端色 #4db8ff 的像素（SPEC-3.2a）').not.toBeNull()
    expect(grid, '安全采样区域内应能找到接近网格线昼端色 #1e3a5f 的像素（SPEC-3.2a）').not.toBeNull()

    // 找到的像素数量应有一定规模（底面覆盖面积最大，海岸线/网格为细线相对稀疏），
    // 排除"只是噪声偶然落入容差"的情形
    expect(base!.count).toBeGreaterThan(50)
    expect(coast!.count).toBeGreaterThan(3)
    expect(grid!.count).toBeGreaterThan(3)

    // 直接复核采样像素与 SPEC 三色的绝对偏差（比"是否被扫描命中"更直接的断言）
    const basePx = await samplePixelBoxStable(page, base!.x, base!.y, 1)
    const coastPx = await samplePixelBoxStable(page, coast!.x, coast!.y, 1)
    const gridPx = await samplePixelBoxStable(page, grid!.x, grid!.y, 1)
    for (let i = 0; i < 3; i++) {
      expect(Math.abs(basePx[i] - BASE_DAY[i])).toBeLessThanOrEqual(COLOR_TOLERANCE)
      expect(Math.abs(coastPx[i] - COAST_DAY[i])).toBeLessThanOrEqual(COLOR_TOLERANCE)
      expect(Math.abs(gridPx[i] - GRID_DAY[i])).toBeLessThanOrEqual(COLOR_TOLERANCE)
    }

    // 视觉判据留存截图（视觉场景须附截图，任务卡要求）
    await page.screenshot({ path: 'test-results/vector-earth-day.png' })
  })

  test('夜端暗于昼端；海岸线夜面辉光存在与色相 #7fd4ff（SPEC-3.2a 夜面条款 + SPEC-3.3 非叠加）', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await page.bringToFront()
    await page.goto('/')
    await waitForGlobeDebug(page)
    await waitForSurfaceReady(page)

    await setSunDirVector(page, DAY_SUN)
    await page.waitForTimeout(150)
    await waitNextFrame(page)
    await waitNextFrame(page)

    const { region } = await safeRegion(page)
    const base = await findColorInRegion(page, region, BASE_DAY, COLOR_TOLERANCE)
    const coast = await findColorInRegion(page, region, COAST_DAY, COLOR_TOLERANCE)
    const grid = await findColorInRegion(page, region, GRID_DAY, COLOR_TOLERANCE)
    expect(base).not.toBeNull()
    expect(coast).not.toBeNull()
    expect(grid).not.toBeNull()

    const baseDayPx = await samplePixelBoxStable(page, base!.x, base!.y, 1)
    const coastDayPx = await samplePixelBoxStable(page, coast!.x, coast!.y, 1)
    const gridDayPx = await samplePixelBoxStable(page, grid!.x, grid!.y, 1)

    await setSunDirVector(page, NIGHT_SUN)
    await page.waitForTimeout(150)
    await waitNextFrame(page)
    await waitNextFrame(page)

    const baseNightPx = await samplePixelBoxStable(page, base!.x, base!.y, 1)
    const coastNightPx = await samplePixelBoxStable(page, coast!.x, coast!.y, 1)
    const gridNightPx = await samplePixelBoxStable(page, grid!.x, grid!.y, 1)

    // ① 夜端整体暗于昼端（SPEC-3.2a「QA 断言夜端暗于昼端即可」，三层皆适用）
    expect(luminance(baseNightPx)).toBeLessThan(luminance(baseDayPx))
    expect(luminance(gridNightPx)).toBeLessThan(luminance(gridDayPx))
    expect(luminance(coastNightPx)).toBeLessThan(luminance(coastDayPx))

    // ② 辉光「存在」的判定法：任何对固定日间色做纯标量压暗（乘以某系数 k∈(0,1]）都
    // 不可能使某一通道的值超过其昼端原值——若观测到海岸线夜面像素的 R 通道**高于**
    // 昼端 R 通道，则唯一解释是叠加了另一种非等比例（换色相）的加法分量，即辉光
    // （SPEC-3.2a「以海岸线在夜半球的微弱自发光辉光表达」）。这是不依赖任何具体
    // 压暗系数/辉光强度取值的存在性证明，满足「不断言强度精确值」。
    expect(
      coastNightPx[0],
      `海岸线夜面像素 R=${coastNightPx[0]} 应高于昼端 R=${coastDayPx[0]}——` +
        `纯压暗不可能使某通道回升，观测不到回升说明未检出辉光`,
    ).toBeGreaterThan(coastDayPx[0])

    // ③ 辉光「色相」的判定法：辉光色 #7fd4ff 是 R 明显小于 G、B 的青蓝色，其自身
    // G/R、B/R 比值（212/127≈1.67、255/127≈2.0）低于海岸线昼端色 #4db8ff 自身的
    // G/R、B/R 比值（184/77≈2.39、255/77≈3.31）。若辉光确实叠加，夜面像素的
    // G/R、B/R 应相应地向辉光色方向偏移（比值降低）——不依赖压暗系数或辉光强度，
    // 只要叠加了辉光这一方向性偏移就应出现
    const dayGR = coastDayPx[1] / coastDayPx[0]
    const dayBR = coastDayPx[2] / coastDayPx[0]
    const nightGR = coastNightPx[1] / coastNightPx[0]
    const nightBR = coastNightPx[2] / coastNightPx[0]
    expect(nightGR, `夜面 G/R=${nightGR.toFixed(2)} 应低于昼端 G/R=${dayGR.toFixed(2)}（辉光色相偏移）`).toBeLessThan(
      dayGR,
    )
    expect(nightBR, `夜面 B/R=${nightBR.toFixed(2)} 应低于昼端 B/R=${dayBR.toFixed(2)}（辉光色相偏移）`).toBeLessThan(
      dayBR,
    )

    // ④ 差异化对照：海岸线夜/昼亮度比明显高于底面夜/昼亮度比——SPEC-3.2a 只把辉光
    // 赋予海岸线一层，底面没有对应条款，故底面的压暗应比海岸线更彻底（辉光部分
    // 抵消了海岸线自身的压暗）
    const coastRatio = luminance(coastNightPx) / luminance(coastDayPx)
    const baseRatio = luminance(baseNightPx) / luminance(baseDayPx)
    expect(
      coastRatio,
      `海岸线夜/昼亮度比 ${coastRatio.toFixed(2)} 应明显高于底面夜/昼亮度比 ${baseRatio.toFixed(2)}`,
    ).toBeGreaterThan(baseRatio + 0.15)

    await page.screenshot({ path: 'test-results/vector-earth-night.png' })
  })

  test('晨昏线过渡带 t∈[-0.1,+0.1] 内渐变、带外趋于饱和（SPEC-3.2①，矢量自身 shader）', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await page.bringToFront()
    await page.goto('/')
    await waitForGlobeDebug(page)
    await waitForSurfaceReady(page)

    const cam = await sampleCamera(page)
    expect(cam.z).toBeCloseTo(3.2, 3)

    const { width, height } = await canvasBufferSize(page)
    const cx = width / 2
    const cy = height / 2

    // 取样点固定在画布几何中心、经度固定为 0（格林尼治，SPEC-3.1 默认视角正对该方向）。
    // 采样点位于赤道（纬线 lat=0 恰为矢量网格 30° 纬线之一，SPEC-3.2a），画布中心
    // 像素落在底面与网格线的抗锯齿混合处；不依赖具体经度选择（赤道自身即是一个
    // 绕 Y 轴旋转对称的圆，居中到该点的局部子像素结构与经度无关，已用独立探测脚本
    // 核实：不同经度下该固定像素的昼/夜对比幅度稳定，故本用例不需要 M1-05 式的
    // 候选经度扫描，直接固定 lon=0 即可）。
    function sunDirForLon(t: number, lonDeg: number) {
      const L = lonDeg * DEG
      const s = Math.sqrt(Math.max(0, 1 - t * t))
      return { x: t * Math.sin(L) + s * Math.cos(L), y: 0, z: t * Math.cos(L) - s * Math.sin(L) }
    }

    async function lumAt(t: number): Promise<number> {
      await page.mouse.click(400, 300) // 重置 SPEC-7.3 空闲自转计时（黑盒无位移点击）
      await setEarthRotationY(page, 0)
      await setSunDirVector(page, sunDirForLon(t, 0))
      await page.waitForTimeout(120)
      await waitNextFrame(page)
      return luminance(await samplePixelBoxStable(page, cx, cy, 3))
    }

    const nightDeep = await lumAt(-1)
    const nightNear = await lumAt(-0.3)
    const dayNear = await lumAt(0.3)
    const dayDeep = await lumAt(1)

    const steps = 21
    const samples: number[] = []
    for (let i = 0; i < steps; i++) {
      const t = -0.1 + (0.2 * i) / (steps - 1)
      samples.push(await lumAt(t))
    }

    const contrast = dayDeep - nightDeep
    // 昼夜对比需足够显著（矢量纯色场景对比幅度天然小于卫星纹理场景，独立探测脚本
    // 实测约 19，10 留有安全余量）
    expect(contrast).toBeGreaterThan(10)

    const SATURATION_TOLERANCE = 4
    // ① band 外已饱和
    expect(Math.abs(nightDeep - nightNear)).toBeLessThanOrEqual(SATURATION_TOLERANCE)
    expect(Math.abs(dayDeep - dayNear)).toBeLessThanOrEqual(SATURATION_TOLERANCE)
    // ② band 边界本身达到饱和值
    expect(Math.abs(samples[0] - nightDeep)).toBeLessThanOrEqual(SATURATION_TOLERANCE)
    expect(Math.abs(samples[steps - 1] - dayDeep)).toBeLessThanOrEqual(SATURATION_TOLERANCE)
    // ③ band 中点（t=0）明显未饱和——band 并未收窄到近乎 0 宽度
    const mid = samples[(steps - 1) / 2]
    expect(Math.abs(mid - nightDeep)).toBeGreaterThan(contrast * 0.2)
    expect(Math.abs(mid - dayDeep)).toBeGreaterThan(contrast * 0.2)
    // ④ band 内部渐变、非硬跳变
    const MONOTONIC_NOISE_TOLERANCE = 3
    let maxStep = 0
    let nonDecreasing = true
    for (let i = 1; i < samples.length; i++) {
      const d = samples[i] - samples[i - 1]
      if (d < -MONOTONIC_NOISE_TOLERANCE) nonDecreasing = false
      maxStep = Math.max(maxStep, Math.abs(d))
    }
    expect(nonDecreasing).toBe(true)
    expect(maxStep).toBeLessThan(contrast * 0.5)
    // ⑤ 存在多个互不相同的中间亮度层级
    const distinctLevels = new Set(samples.map((v) => Math.round(v))).size
    expect(distinctLevels).toBeGreaterThanOrEqual(5)
  })
})
