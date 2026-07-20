import { expect, test } from '@playwright/test'
import {
  canvasBufferSize,
  readSunDir,
  sampleCamera,
  samplePixelBoxStable,
  setEarthRotationY,
  setNightGain,
  setSunDir,
  waitForGlobeDebug,
  waitForRealEarthTexture,
  waitNextFrame,
} from './globeDebug'

const DEG = Math.PI / 180

// M1-14：昼半球不叠加夜景灯光（e2e，真实 Chromium + WebGL 渲染）。
//
// 判据出处（只从 doc/spec.md 推导）：
//   - SPEC-3.3「夜半球显示夜纹理城市灯光（亮度增益 ≥1.5）；昼半球不显示灯光」——本场景
//     验证的是第二句。
//   - SPEC-3.2「t = dot(N, sunDir)……晨昏线软过渡带 t ∈ [-0.1, +0.1] 内 smoothstep 混合」
//     ——给出「昼半球内部」的定量定义：t 明显大于过渡带上界 +0.1。混合（mix）语义蕴含
//     纯昼端点处夜景项权重为 0。
//   - SPEC-3.1 默认视角（相机 (0,0,3.2) 看向球心）——确定画布几何中心对应的球面方向。
//   - SPEC-4.1 太阳赤纬 |δ| ≤ 23.44°、SPEC-4.5 sunDir 由真实时刻驱动——第二个 it 用于
//     论证「赤道上恒存在深昼点与深夜点」。
//
// 判定法（对 uNightGain 的不变性，而非与昼纹理比色）：
// 同一取样点、同一 sunDir、只改 `uNightGain` 一个自变量，比较两次渲染的像素。
//   - 昼侧（t ≫ +0.1）：像素**不得**随 uNightGain 变化。SPEC-3.3 第二句：昼半球不显示
//     灯光 ⇒ 灯光项（夜纹理 × 增益）在此处权重为 0 ⇒ 改变增益不改变结果。
//   - 夜侧（t ≪ -0.1）：像素**必须**随 uNightGain 变化。这是仪器对照组，证明本套采样
//     确实有能力测出增益引起的变化；若两侧都不变，说明是采样失灵而非实现正确。
//
// 最低证伪门槛（REV-003 §2.2 第 1 条硬要求）：
// 若实现被改为「昼夜叠加」（`day + night * uNightGain`，而非 SPEC-3.2 的 mix），昼侧像素
// 会随增益线性变化 delta = night_raw × (G_HIGH − G_LOW) = night_raw × 4.5。本用例的取样
// 经度按「夜侧增益响应最大」挑选（见 pickLon），即刻意选中夜纹理值最大的观测窗口，使该
// 误差项被放大到最大；实测最弱的赤道洋面窗口 night_raw 也在 5 以上（对应 delta ≳ 22），
// 远高于 DAY_INVARIANCE_TOLERANCE=3。故任何「叠加式」实现都会让昼侧断言变红。
// 另一类被证伪的错误实现：把混合权重 k 的边界写偏（如 mix 的两端接反、或 band 上界远大于
// +0.1 导致 t=0.3 处仍混入夜景项）——此时 t=0.3 的昼侧取样点会随增益变化，同样变红。
//
// 明令禁止且本文件未使用（REV-003 §2.2 第 2 条）：断言 shader 源码字符串含 mix/权重表达式；
// 把 GLSL 混合公式移植成 TS 再对该移植断言。本文件只对已知 uniform 名赋值/读值，判定完全
// 基于真实渲染回读的像素。

// SPEC-3.3 的增益下限 1.5，与另一个同样合法（≥1.5）的取值。两者都在 spec 允许区间内，
// 故「换用其中任一值都应是合法渲染状态」，昼侧结果理应完全一致。
const G_LOW = 1.5
const G_HIGH = 6.0

// 昼侧不变性的容差：SPEC-3.3 推出的期望差值是 0，本容差纯为真实 WebGL 渲染噪声预留
// （JPEG 纹理解码 + mipmap/各向异性过滤 + 抗锯齿，同一像素两次采样存在个位数抖动）。
// 取 3，比 day-night-calibration.spec.ts 的 8 更紧——那里比较的是不同 sunDir 下的两次
// 渲染，这里只改一个标量 uniform，其余状态完全相同，噪声更小。
const DAY_INVARIANCE_TOLERANCE = 3
// 夜侧对照组的最低响应幅度：spec 未规定具体数值（SPEC-3.3 只约束增益下限），此阈值的
// 唯一作用是确认「采样仪器能测出变化」，故只需明显高于上面的噪声容差即可，取其 4 倍。
const NIGHT_RESPONSE_MIN = DAY_INVARIANCE_TOLERANCE * 4

// SPEC-7.3 的空闲自转（10s 无输入后地球本体开始转动）会在长用例中改写 markerRoot.rotation.y，
// 破坏「固定取样点只改一个自变量」的前提。每次采样前模拟一次无位移点击（down+up 同坐标）
// 重置空闲计时——黑盒合法输入，不改变相机方位角/仰角/距离，做法与
// day-night-calibration.spec.ts 一致。坐标为 CSS 像素（视口坐标），固定落在 canvas 内且
// 远离 SPEC-2.2 右侧 side-panel。
const CLICK_X = 400
const CLICK_Y = 300

const luminance = ([r, g, b]: [number, number, number]) => 0.299 * r + 0.587 * g + 0.114 * b

/**
 * 让模型空间经度 lonDeg 的赤道点法线方向与 sunDir 夹角满足 dot = t。
 * 该点的法线是**模型空间**固定法线 (sin L, 0, cos L)，不随 markerRoot.rotation.y 变换
 * （旋转只决定哪段经度被转到画布中心，不改变被转到中心那一点自身的法线）——故 sunDir
 * 须在该点自身的法向-切向基下解出。推导同 day-night-calibration.spec.ts 头注。
 */
function sunDirForLon(t: number, lonDeg: number) {
  const L = lonDeg * DEG
  const s = Math.sqrt(Math.max(0, 1 - t * t))
  return {
    x: t * Math.sin(L) + s * Math.cos(L),
    y: 0,
    z: t * Math.cos(L) - s * Math.sin(L),
  }
}

// 卫星路径专属（REV-005 A3 再归属 / BUG-020）：本场景通过改写 `uNightGain` uniform
// 观察昼/夜侧像素响应差异，该 uniform 只存在于卫星昼夜 shader（src/globe/shaders/earth.ts，
// SPEC-3.3「亮度增益 ≥1.5」的机械化实现）；矢量默认风格（SPEC-3.2a）以 `uGlowStrength`/
// `uGlowColor` 表达夜面辉光，不含 `uNightGain` 这一增益 uniform，两者结构不同不可互测。
// 故本文件经 `?style=satellite` 显式走 DEV-only 卫星路径（src/App.tsx、BUG-020 方案 a），
// 生产默认（矢量）不受影响；渲染稳定门保持 waitForRealEarthTexture（读卫星专属的
// uDayMap，卫星路径下才有意义）。
test.describe('M1-14 昼半球不叠加夜景灯光', () => {
  test('昼侧取样点不随 uNightGain 变化、夜侧随之变化（SPEC-3.3 第二句 + SPEC-3.2）', async ({
    page,
  }) => {
    // 十余次「设 uniform → 等渲染稳定 → 回读像素」往返，全量回归多 worker 并发占满 GPU 时
    // 单次往返明显变慢，默认 30s 余量不足（放宽方式与既有 e2e 用例一致）
    test.setTimeout(90_000)
    await page.bringToFront()
    await page.goto('/?style=satellite')
    await waitForGlobeDebug(page)
    await waitForRealEarthTexture(page)

    // 前置自检（非 SPEC 判据）：确认相机仍是 SPEC-3.1 默认视角，否则「画布中心 = 当前被
    // 转到中心的那条经度」这一取样点假设不成立
    const cam = await sampleCamera(page)
    expect(cam.x).toBeCloseTo(0, 3)
    expect(cam.y).toBeCloseTo(0, 3)
    expect(cam.z).toBeCloseTo(3.2, 3)

    const { width, height } = await canvasBufferSize(page)
    const cx = width / 2
    const cy = height / 2

    /** 把经度 lonDeg 转到画布中心、注入使该点 t 为给定值的 sunDir、设定增益，回读中心像素亮度 */
    async function lumAt(t: number, lonDeg: number, gain: number): Promise<number> {
      await page.mouse.click(CLICK_X, CLICK_Y)
      await setEarthRotationY(page, -lonDeg * DEG)
      await setSunDir(page, sunDirForLon(t, lonDeg))
      await setNightGain(page, gain)
      await page.waitForTimeout(120)
      await waitNextFrame(page)
      return luminance(await samplePixelBoxStable(page, cx, cy, 3))
    }

    // 观测窗口的选择（不是判据的一部分）：赤道各经度的夜纹理内容不同（洋面几乎无灯光、
    // 陆地城市带明亮）。挑「夜侧增益响应最大」的经度，是为了让潜在的叠加式实现在昼侧
    // 产生的误差最大化——即刻意选对错误实现最不利的窗口，提高本用例的证伪能力，
    // 而不是挑一个容易通过的窗口。
    const candidates = [40, -78]
    let bestLon = candidates[0]
    let bestResponse = -Infinity
    for (const lon of candidates) {
      const response = (await lumAt(-1, lon, G_HIGH)) - (await lumAt(-1, lon, G_LOW))
      if (response > bestResponse) {
        bestResponse = response
        bestLon = lon
      }
    }

    // ① 夜侧对照组：t = -1（深夜半球，远低于 SPEC-3.2 过渡带下界 -0.1），
    //    像素必须随 uNightGain 变化——证明采样仪器确实能测出增益引起的变化
    const nightLow = await lumAt(-1, bestLon, G_LOW)
    const nightHigh = await lumAt(-1, bestLon, G_HIGH)
    const nightDelta = nightHigh - nightLow
    expect(nightDelta).toBeGreaterThan(NIGHT_RESPONSE_MIN)

    // ② 昼半球内部取两个 t：0.3（为 SPEC-3.2 过渡带上界 +0.1 的 3 倍，已明显在带外）
    //    与 1.0（太阳直下，纯昼端点）。两处像素都不得随 uNightGain 变化（SPEC-3.3 第二句）
    for (const t of [0.3, 1.0]) {
      const dayLow = await lumAt(t, bestLon, G_LOW)
      const dayHigh = await lumAt(t, bestLon, G_HIGH)
      const dayDelta = Math.abs(dayHigh - dayLow)
      expect(
        dayDelta,
        `昼侧 t=${t}（lon=${bestLon}）像素随 uNightGain 变化了 ${dayDelta.toFixed(2)}：` +
          `SPEC-3.3 要求昼半球不显示灯光，灯光项权重应为 0`,
      ).toBeLessThanOrEqual(DAY_INVARIANCE_TOLERANCE)
      // 昼侧变化量必须远小于夜侧变化量：把判定表达为同一仪器下的相对比较，
      // 使结论不依赖跨环境的绝对像素值（REV-003 §4 R-1 的缓解要求）
      expect(dayDelta * 4).toBeLessThan(nightDelta)
    }
  })

  test('取样点由真实时刻驱动的当前 uSunDir 反算时同一不变性成立（SPEC-4.5 + SPEC-3.3）', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await page.bringToFront()
    await page.goto('/?style=satellite')
    await waitForGlobeDebug(page)
    await waitForRealEarthTexture(page)

    const cam = await sampleCamera(page)
    expect(cam.z).toBeCloseTo(3.2, 3)

    const { width, height } = await canvasBufferSize(page)
    const cx = width / 2
    const cy = height / 2

    // 本用例全程不注入 sunDir，直接用 SPEC-4.5 真实时刻驱动的当前值反算取样点：
    // 赤道上模型空间经度 L 的点法线为 (sin L, 0, cos L)，
    //   t(L) = sx·sin L + sz·cos L = h·cos(L − atan2(sx, sz))，h = sqrt(sx² + sz²)
    // 故 t 在 L_day = atan2(sx, sz) 取最大值 +h、在 L_day+180° 取最小值 −h。
    // 由 SPEC-4.1「δ = 23.44°·sin(...)」得 |sy| ≤ sin23.44° ⇒ h ≥ cos23.44° ≈ 0.917，
    // 即无论当前时刻为何，赤道上恒存在 t ≥ 0.917 的深昼点与 t ≤ −0.917 的深夜点，
    // 二者都远在 SPEC-3.2 过渡带 [-0.1, +0.1] 之外。把该经度转到画布中心即可取样，
    // 从而不必写死取样点、也不受「可见半球可能全为夜侧」影响。
    const sun0 = await readSunDir(page)
    const h0 = Math.hypot(sun0.x, sun0.z)
    expect(
      h0,
      'sunDir 水平分量应 ≥ cos(23.44°)：SPEC-4.1 限定太阳赤纬幅度 ≤23.44°',
    ).toBeGreaterThan(0.9)

    /** 每次采样都重读当前 uSunDir（SPEC-4.5 每帧更新、可降频至 1 次/分钟，用例期间可能刷新一次）
     *  并据此重算取样经度，避免用陈旧的太阳方向定位取样点 */
    async function lumAtSunRelative(side: 'day' | 'night', gain: number): Promise<number> {
      await page.mouse.click(CLICK_X, CLICK_Y)
      const sun = await readSunDir(page)
      const lonRad = Math.atan2(sun.x, sun.z) + (side === 'day' ? 0 : Math.PI)
      await setEarthRotationY(page, -lonRad)
      await setNightGain(page, gain)
      await page.waitForTimeout(120)
      await waitNextFrame(page)
      return luminance(await samplePixelBoxStable(page, cx, cy, 3))
    }

    // 夜侧对照组：像素随增益变化（仪器有效性）
    const nightLow = await lumAtSunRelative('night', G_LOW)
    const nightHigh = await lumAtSunRelative('night', G_HIGH)
    const nightDelta = nightHigh - nightLow
    expect(nightDelta).toBeGreaterThan(NIGHT_RESPONSE_MIN)

    // 昼侧（t ≥ 0.917，远大于 SPEC-3.2 过渡带上界 +0.1）：像素不随增益变化（SPEC-3.3 第二句）
    const dayLow = await lumAtSunRelative('day', G_LOW)
    const dayHigh = await lumAtSunRelative('day', G_HIGH)
    const dayDelta = Math.abs(dayHigh - dayLow)
    expect(
      dayDelta,
      `昼侧（由真实 uSunDir 反算的直下点经度）像素随 uNightGain 变化了 ${dayDelta.toFixed(2)}`,
    ).toBeLessThanOrEqual(DAY_INVARIANCE_TOLERANCE)
    expect(dayDelta * 4).toBeLessThan(nightDelta)

    // 归档截图（非机械判据，供人工复核）：昼区居中、分别在 G_LOW / G_HIGH 下各出一张，
    // 两张的昼半球应看不出差别，夜侧月牙区（若在画面内）则可见亮度差异
    await lumAtSunRelative('day', G_LOW)
    await page.screenshot({ path: 'test-results/day-side-gain-1_5.png' })
    await lumAtSunRelative('day', G_HIGH)
    await page.screenshot({ path: 'test-results/day-side-gain-6_0.png' })
  })
})
