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
// 判据出处（全部只从 doc/spec.md 推导，逐条标注 SPEC 条目；对应 doc/testplan.md M2-13 之
// 邻行 M2-15 v0.2.13 REV-013 裁准后的行文，原 ✅ 系旧色值下取得已回退重测）：
//   - SPEC-3.2②「默认风格＝轻量矢量……免大纹理」——本文件全程 `goto('/')` 不带
//     `?style=satellite`（该参数是 BUG-020 方案 a 引入的 DEV-only 显式切换，见
//     src/App.tsx；不传即走矢量默认路径）。
//   - SPEC-3.2① `t = dot(N, sunDir)`，过渡带 t∈[-0.1,+0.1] smoothstep 混合——跨风格公式，
//     本文件验证其在矢量风格自身 shader（src/globe/shaders/vectorEarth.ts）中同样成立
//     （矢量与卫星是两份独立 shader 源码，不能只凭 M1 已验证卫星路径而假定矢量同样正确）。
//     注意：SPEC-3.2① v0.2.13 新增「昼半球底面在过渡带之外仍随离日角连续柔和衰减」——
//     故昼侧不再是均匀平涂，旧「昼侧均匀性」断言与该连续衰减契约矛盾，本次删除；昼夜半球
//     亮度比 [1.8,2.6] 与昼侧内部 ≥1.3:1 的衰减比值量测归 M3-02，不入本场景。
//   - SPEC-3.2a v0.2.13 pin：底面昼端色 `#1f4468`、夜端色 `#0d1827`（两端均显式 pin）；
//     海岸线昼端色 `#6690b3`（降饱和蓝灰结构线）；**默认远景画面无经纬网格（D24 默认隐藏，
//     网格色/密度断言移 M3-06）**；夜面海岸线自发光辉光色 `#3a5a72`（QA 断言其存在与色相、
//     不断言强度精确值）；夜端整体亮度暗于昼端（「QA 断言夜端暗于昼端即可」）。
//   - SPEC-3.3 第二句：矢量默认风格夜面表达不依赖夜纹理、昼半球不叠加发光——本文件不使用
//     卫星专属的 `uNightGain`/`uDayMap` 校准手段（那是 day-side-no-lights.spec.ts 的卫星
//     路径专属仪器，矢量三层材质结构不同，见 globeDebug.ts setSunDirVector 注释）。
//
// 取样策略（黑盒、不解析/移植 shader 源码，禁止 M1-14 明令禁止的两类写法）：
// 「昼端色」的定义锚点是**次日点方向（t=1）**（SPEC-3.2a 底面条款）。把 sunDir 对齐相机轴
// （(0,0,1)），则可见半球正中（屏幕几何中心，法线≈(0,0,1)）恰为次日点 t=1——该点昼端色为
// 未经离日角衰减的满值 pin 色，直接采样即可验证 pin。海岸线/网格 pin 则用 findColorInRegion
// 在中心邻域（离日角小、衰减近 1）黑盒扫描其满值 pin 色，不依赖透视投影计算或经纬度换算。
//
// 安全采样区域推导（SPEC-3.1：fov 45°、相机距离 3.2、球半径 1.0）：
// 相机到球心距离 d=3.2、球半径 R=1，可见球面上任意点的法线与相机轴夹角 theta 满足
// cos(theta) ∈ [R/d, 1]=[0.3125, 1]。把采样区域限制在画布中心 ±(0.25·宽, 0.4·高) 的矩形内，
// 该矩形四角对应的 theta 最大约 38.5°（cos theta ≈0.78），远离掠射区、取样稳定可靠。
const SAFE_NDC_X = 0.25
const SAFE_NDC_Y = 0.4

// SPEC-3.2a v0.2.13 pin 色（sRGB 0-255）
const BASE_DAY: [number, number, number] = [31, 68, 104] // #1f4468 底面昼端（次日点方向）
const BASE_NIGHT: [number, number, number] = [13, 24, 39] // #0d1827 底面夜端
const COAST_DAY: [number, number, number] = [102, 144, 179] // #6690b3 海岸线昼端
const NIGHT_GLOW: [number, number, number] = [58, 90, 114] // #3a5a72 夜面海岸线辉光色（注释锚点，色相断言在 test 2 用其色度）

const DAY_SUN = { x: 0, y: 0, z: 1 }
const NIGHT_SUN = { x: 0, y: 0, z: -1 }

/** 纯色扫描容差：矢量三层皆为无纹理的程序化纯色 fill/line，满值 pin 色（离日角衰减系数=1）
 * round-trip（sRGB→线性→shader→#include<colorspace_fragment> 转回 sRGB）偏差 ≤1，
 * 取 3 留出跨环境/抗锯齿安全余量（比 M1 纹理场景容差更紧，无 JPEG 解码/mipmap 噪声）。 */
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
 * 卫星路径（src/globe/earth.ts）材质持有 `uDayMap`/`uNightMap` 贴图 uniform，矢量路径
 * （src/globe/vectorEarth.ts）三个材质只有 uColorDay/uColorNight/uSunDir/uTwilight/uGlow*，
 * 不含任何贴图 uniform。 */
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
  test('昼半球取样：底面/海岸线昼端 pin 色、默认远景无经纬网格、未加载卫星纹理（SPEC-3.2②/3.2a）', async ({
    page,
  }) => {
    await page.bringToFront()
    await page.goto('/')
    await waitForGlobeDebug(page)
    await waitForSurfaceReady(page)

    // 前置自检（非 SPEC 判据）：确认仍是 SPEC-3.1 默认视角，否则「屏幕中心=次日点」的几何前提不成立
    const cam = await sampleCamera(page)
    expect(cam.x).toBeCloseTo(0, 3)
    expect(cam.y).toBeCloseTo(0, 3)
    expect(cam.z).toBeCloseTo(3.2, 3)

    await assertNoSatelliteTexture(page)

    await setSunDirVector(page, DAY_SUN)
    await page.waitForTimeout(150)
    await waitNextFrame(page)
    await waitNextFrame(page)

    const { width, height, region } = await safeRegion(page)

    // ① 底面昼端 pin #1f4468：sunDir 对齐相机轴时，屏幕几何中心法线≈(0,0,1)、t=1（次日点），
    // 昼端底面为满值 pin 色（离日角衰减系数=1）。中心 (lat0,lon0) 为几内亚湾洋面（无海岸线），
    // 直接采样即验证底面昼端 pin（SPEC-3.2a）
    const centerPx = await samplePixelBoxStable(page, Math.round(width / 2), Math.round(height / 2), 3)
    for (let i = 0; i < 3; i++) {
      expect(
        Math.abs(centerPx[i] - BASE_DAY[i]),
        `底面次日点(t=1)第 ${i} 通道 ${centerPx[i]} 应≈昼端 pin #1f4468=${BASE_DAY[i]}（SPEC-3.2a）`,
      ).toBeLessThanOrEqual(COLOR_TOLERANCE)
    }

    // ② 海岸线昼端 pin #6690b3：在中心邻域（离日角小、衰减近 1）黑盒扫描满值海岸线昼端色。
    // 找得到满值 #6690b3 同时旁证「昼半球不叠加发光」（SPEC-3.3 第二句）——若昼侧叠了辉光，
    // 次日点邻域海岸线会偏离该 pin 而扫不到。
    const coast = await findColorInRegion(page, region, COAST_DAY, COLOR_TOLERANCE)
    expect(coast, '中心邻域应能找到接近海岸线昼端 pin #6690b3 的像素（SPEC-3.2a；昼侧不叠加发光 SPEC-3.3）').not.toBeNull()
    const coastPx = await samplePixelBoxStable(page, coast!.x, coast!.y, 1)
    for (let i = 0; i < 3; i++) {
      expect(Math.abs(coastPx[i] - COAST_DAY[i])).toBeLessThanOrEqual(COLOR_TOLERANCE)
    }

    // ③ 默认远景画面无经纬网格（SPEC-3.2a D24 默认隐藏）：不能靠扫网格昼端色 #1e3a5f 判定——
    // 该色落在底面昼端 #1f4468 连续衰减（SPEC-3.2①）某档位的输出容差内、与底面无法用颜色区分。
    // 改黑盒读地表底面（SphereGeometry Mesh）的线层子节点（three.js LineSegments，公开 Object3D
    // 结构，同 sampleMarkerCount/sampleEarthGeometry 手法）的 `visible` 标志：默认远景只有海岸线
    // 一层可见渲染入画面（SPEC-3.2a 结构线），经纬网格层虽已构建但 visible=false 不入画面。
    const lineLayers = await page.evaluate(() => {
      const dbg = (window as unknown as { __globeDebug: DebugHook }).__globeDebug
      const earth = dbg.globe.markerRoot.children.find((c) => c.geometry?.type === 'SphereGeometry') as unknown as
        | { children?: { type?: string; visible?: boolean }[] }
        | undefined
      const segs = (earth?.children ?? []).filter((c) => c.type === 'LineSegments')
      return { visible: segs.filter((c) => c.visible === true).length, hidden: segs.filter((c) => c.visible === false).length }
    })
    expect(lineLayers.visible, '默认远景应只有海岸线一层线可见入画面（SPEC-3.2a）').toBe(1)
    expect(lineLayers.hidden, '经纬网格层应存在但不可见、不入默认远景画面（SPEC-3.2a D24 默认隐藏）').toBeGreaterThanOrEqual(1)

    // 视觉判据留存截图（视觉场景须附截图，SPEC-3.2a 为对外可验收质量）
    await page.screenshot({ path: 'test-results/vector-earth-day.png' })
  })

  test('夜端暗于昼端；海岸线夜面辉光存在与色相 #3a5a72（SPEC-3.2a 夜面条款 + SPEC-3.3 非叠加）', async ({
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

    const { width, height, region } = await safeRegion(page)
    const cx = Math.round(width / 2)
    const cy = Math.round(height / 2)

    // 底面用屏幕中心（次日点=底面昼端 #1f4468）；海岸线在中心邻域扫其昼端 pin #6690b3
    const coast = await findColorInRegion(page, region, COAST_DAY, COLOR_TOLERANCE)
    expect(coast, '应先在昼侧定位到海岸线像素（SPEC-3.2a）').not.toBeNull()

    const baseDayPx = await samplePixelBoxStable(page, cx, cy, 1)
    const coastDayPx = await samplePixelBoxStable(page, coast!.x, coast!.y, 1)

    await setSunDirVector(page, NIGHT_SUN)
    await page.waitForTimeout(150)
    await waitNextFrame(page)
    await waitNextFrame(page)

    const baseNightPx = await samplePixelBoxStable(page, cx, cy, 1)
    const coastNightPx = await samplePixelBoxStable(page, coast!.x, coast!.y, 1)

    // ① 夜端整体暗于昼端（SPEC-3.2a「QA 断言夜端暗于昼端即可」，底面与海岸线两层皆适用）。
    // 顺带旁证底面夜端≈pin #0d1827（同一像素在夜侧 t=-1）
    expect(luminance(baseNightPx), '底面夜端应暗于昼端（SPEC-3.2a）').toBeLessThan(luminance(baseDayPx))
    expect(luminance(coastNightPx), '海岸线夜端应暗于昼端（SPEC-3.2a）').toBeLessThan(luminance(coastDayPx))
    for (let i = 0; i < 3; i++) {
      expect(
        Math.abs(baseNightPx[i] - BASE_NIGHT[i]),
        `底面夜端第 ${i} 通道 ${baseNightPx[i]} 应≈夜端 pin #0d1827=${BASE_NIGHT[i]}（SPEC-3.2a 两端均 pin）`,
      ).toBeLessThanOrEqual(COLOR_TOLERANCE)
    }

    // ② 辉光「存在」的判定法（不依赖辉光强度/压暗系数具体取值，满足「不断言强度精确值」）：
    // SPEC-3.2a 只把夜面自发光辉光赋予海岸线一层、底面无对应条款。若无辉光，海岸线与底面在
    // 夜侧都只是各自昼端色的纯标量压暗，夜/昼亮度比应同量级；观测到「海岸线夜/昼比明显高于
    // 底面夜/昼比」，唯一解释是海岸线夜侧叠加了额外发光分量抵消了部分压暗——即辉光存在。
    const coastRatio = luminance(coastNightPx) / luminance(coastDayPx)
    const baseRatio = luminance(baseNightPx) / luminance(baseDayPx)
    expect(
      coastRatio,
      `海岸线夜/昼亮度比 ${coastRatio.toFixed(3)} 应明显高于底面夜/昼亮度比 ${baseRatio.toFixed(3)}（夜面辉光存在，SPEC-3.2a）`,
    ).toBeGreaterThan(baseRatio + 0.12)

    // ③ 辉光「色相」#3a5a72 的判定法（不依赖强度）：辉光 pin #3a5a72 自身色度 G/R、B/R 均**高于**
    // 海岸线昼端 pin #6690b3 的 G/R、B/R（下方前置从两 pin 推导确认）。纯标量压暗保持各通道比值
    // 不变（G/R、B/R 与昼端相同）；只有叠加了一个 G/R、B/R 更高的加法分量（辉光），夜面像素的
    // G/R、B/R 才会相对昼端向上偏移。观测到该向上偏移即证明叠加分量色相朝 #3a5a72 方向（青蓝、
    // 每单位红分量更多绿蓝），是不依赖强度的色相证据。
    const glowGR = NIGHT_GLOW[1] / NIGHT_GLOW[0]
    const glowBR = NIGHT_GLOW[2] / NIGHT_GLOW[0]
    const coastDayGRpin = COAST_DAY[1] / COAST_DAY[0]
    const coastDayBRpin = COAST_DAY[2] / COAST_DAY[0]
    // 前置（从 SPEC-3.2a 两 pin 推导，非渲染断言）：辉光 #3a5a72 色度高于海岸线昼端 #6690b3，方向断言方成立
    expect(glowGR, '辉光 pin #3a5a72 的 G/R 应高于海岸线昼端 pin #6690b3').toBeGreaterThan(coastDayGRpin)
    expect(glowBR, '辉光 pin #3a5a72 的 B/R 应高于海岸线昼端 pin #6690b3').toBeGreaterThan(coastDayBRpin)

    const dayGR = coastDayPx[1] / coastDayPx[0]
    const dayBR = coastDayPx[2] / coastDayPx[0]
    const nightGR = coastNightPx[1] / coastNightPx[0]
    const nightBR = coastNightPx[2] / coastNightPx[0]
    expect(
      nightGR,
      `夜面 G/R=${nightGR.toFixed(3)} 应高于昼端 G/R=${dayGR.toFixed(3)}（辉光 #3a5a72 色相上偏）`,
    ).toBeGreaterThan(dayGR)
    expect(
      nightBR,
      `夜面 B/R=${nightBR.toFixed(3)} 应高于昼端 B/R=${dayBR.toFixed(3)}（辉光 #3a5a72 色相上偏）`,
    ).toBeGreaterThan(dayBR)

    await page.screenshot({ path: 'test-results/vector-earth-night.png' })
  })

  test('晨昏线过渡带 t∈[-0.1,+0.1] smoothstep 软过渡（SPEC-3.2①，矢量自身 shader）', async ({ page }) => {
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

    // 取样点固定在画布几何中心（lat0,lon0，几内亚湾洋面=底面，无海岸线/网格干扰）。变的是
    // sunDir：sunDirForLon(t,0) 令中心点法线(0,0,1) 与太阳方向夹角余弦恰为 t，从而在同一像素
    // 扫过 t∈[-1,1]，不必逐点计算透视投影（推导见 day-night-calibration.spec.ts 头注）。
    function sunDirForLon(t: number, lonDeg: number) {
      const L = lonDeg * DEG
      const s = Math.sqrt(Math.max(0, 1 - t * t))
      return { x: t * Math.sin(L) + s * Math.cos(L), y: 0, z: t * Math.cos(L) - s * Math.sin(L) }
    }

    async function lumAt(t: number): Promise<number> {
      await page.mouse.click(400, 300) // 重置 SPEC-7.3 空闲自转计时（黑盒无位移点击，避开右侧面板）
      await setEarthRotationY(page, 0)
      await setSunDirVector(page, sunDirForLon(t, 0))
      await page.waitForTimeout(120)
      await waitNextFrame(page)
      return luminance(await samplePixelBoxStable(page, cx, cy, 3))
    }

    // 带外基准：夜侧（t<-0.1）为夜端单一 pin（连续衰减只作用于昼半球，SPEC-3.2①），应均匀饱和
    const nightDeep = await lumAt(-1)
    const nightNear = await lumAt(-0.3)

    // 过渡带内密采样 t∈[-0.1,+0.1]
    const steps = 21
    const samples: number[] = []
    for (let i = 0; i < steps; i++) {
      const t = -0.1 + (0.2 * i) / (steps - 1)
      samples.push(await lumAt(t))
    }
    const bandBottom = samples[0]
    const bandTop = samples[steps - 1]
    const bandRange = bandTop - bandBottom

    // 前置：夜侧带外已饱和（夜端单一 pin，非连续衰减）——|nightDeep - nightNear| 小
    const SAT_TOL = 3
    expect(Math.abs(nightDeep - nightNear), '夜侧带外应饱和到夜端单一 pin（SPEC-3.2a）').toBeLessThanOrEqual(SAT_TOL)
    // 带底(t=-0.1)≈夜端饱和值（过渡自夜端起）
    expect(Math.abs(bandBottom - nightDeep), '过渡带下缘 t=-0.1 应≈夜端饱和值').toBeLessThanOrEqual(SAT_TOL)

    // ① 过渡带内确有可测的亮度上升——存在真实过渡（非纯夜、非零宽阶跃）
    expect(bandRange, `过渡带内应有可测亮度上升，实测幅度 ${bandRange.toFixed(1)}`).toBeGreaterThan(3)

    // ② 单调非降（软过渡随 t 单向抬升，不回头）
    const MONO_TOL = 1.5
    let nonDecreasing = true
    let maxStep = 0
    for (let i = 1; i < samples.length; i++) {
      const d = samples[i] - samples[i - 1]
      if (d < -MONO_TOL) nonDecreasing = false
      maxStep = Math.max(maxStep, Math.abs(d))
    }
    expect(nonDecreasing, '过渡带内亮度应单调非降（smoothstep 软过渡）').toBe(true)

    // ③ 带中点(t=0)严格居于带内两端之间——真渐变，而非贴某一端的硬阶跃
    const mid = samples[(steps - 1) / 2]
    expect(mid, '带中点应明显高于带下缘（非贴夜端硬跳）').toBeGreaterThan(bandBottom + bandRange * 0.2)
    expect(mid, '带中点应明显低于带上缘（非贴昼端硬跳）').toBeLessThan(bandTop - bandRange * 0.2)

    // ④ 无单步硬跳变：任一相邻步幅小于半个带幅（smoothstep 而非 step 阶跃）
    expect(maxStep, `最大相邻步幅 ${maxStep.toFixed(1)} 应 < 半个带幅 ${(bandRange * 0.6).toFixed(1)}`).toBeLessThan(
      bandRange * 0.6,
    )

    // ⑤ 多个互异中间层级（smoothstep 平滑渐变，非二值阶跃）
    const intermediate = samples.filter((v) => v > bandBottom + 1 && v < bandTop - 1).length
    expect(intermediate, '过渡带内应有多个中间亮度层级（smoothstep 渐变）').toBeGreaterThanOrEqual(4)
  })
})
