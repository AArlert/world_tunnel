import { expect, test } from '@playwright/test'
import {
  canvasBufferSize,
  sampleCamera,
  samplePixelBox,
  setSunDir,
  waitForGlobeDebug,
  waitForSurfaceReady,
  waitNextFrame,
} from './globeDebug'

// M1-07：大气菲涅尔辉光——球缘可见主色 #4a90d9 的辉光，由球缘向外衰减（SPEC-3.4，
// 截图判据）。
//
// 风格无关性说明（BUG-020 观察扩充）：SPEC-3.4 断言的对象是大气辉光壳本身，与底图风格
// （矢量默认 SPEC-3.2②/卫星 SPEC-3.2③）无关——大气材质/geometry 不因风格切换而改变
// （design-prompt M2-globe.md §1 R-8 声明：FM-07/FM-08 均不改 atmosphere.ts）。故本文件
// 不追加 ?style=satellite，走应用默认（矢量）路径，验证默认路径下大气仍达标；渲染稳定门
// 也相应换成风格无关的 waitForSurfaceReady（读 uSunDir，矢量/卫星两条路径均有），不再用
// 卫星专属的 waitForRealEarthTexture（读 uDayMap，矢量默认下该 uniform 恒不存在，见
// BUG-020 根因）。
//
// 背景（REV-003 裁决，doc/review/REV-003.md §1）：本场景此前曾以
// `uPower>0 && uIntensity>0`（见 tests/atmosphere.test.ts）充当"衰减"判据被置 ✅，
// 经 rev 认定该断言无区分力（shader 改成向内增强、甚至不读这两个 uniform 仍会全绿），
// 裁定不得计入衰减判据的覆盖，退回重登记。本文件用真实渲染像素采样弥补该缺口，
// 不再依赖 uniform 取值断言衰减方向。
// 主色断言（uColor === #4a90d9）与"不遮挡标记"材质代理断言仍在 tests/atmosphere.test.ts
// （该文件覆盖范围如实写明，REV-003 认定"达标"/"部分覆盖"的部分本文件不重复）。
//
// 采样设计：
// - 注入 sunDir 使画布正中方向（相机默认视角正对的 (lat0,lon0)，SPEC-3.1）落在深夜
//   （t=-1），令可见半球全部呈暗色地表——这样球缘处的加法混合蓝色辉光（SPEC-3.4）不会
//   与昼纹理本身的蓝色海洋混淆，孤立出辉光信号。
// - 沿画布水平中心行，从中心向左侧背景采样一列像素（往左是为了避开 SPEC-2.2 的
//   右侧悬浮 side-panel；不过 samplePixelBox 直接从 <canvas> 元素本身 drawImage 回读，
//   本就不受该 DOM 覆盖层影响，往左只是与 e2e/starfield.spec.ts 的既有约定保持一致）。
// - 用 "blueness = B - max(R,G)" 衡量辉光信号强度：加法混合的蓝色辉光会显著推高蓝
//   通道超过红/绿通道；深色地表与纯黑/星点背景的 blueness 都接近 0，不会与辉光混淆。
// - 相机距球心 3.2、球半径 1（SPEC-3.1）：球体自身轮廓的视线半张角
//   arccos(1/3.2)≈71.8°对应的屏幕位置远在中心与画布边缘之间，采样区间（中心到左侧
//   90% 半宽处）留有充分余量同时覆盖球体轮廓与其外侧背景，不依赖精确的相机投影换算。

test('球缘菲涅尔辉光主色偏蓝且强度沿径向向外单调衰减（SPEC-3.4）', async ({ page }) => {
  // 本用例含 80 次像素回读往返，全量回归下多 e2e worker 并发占满 GPU 时单次往返
  // 明显变慢，默认 30s 测试超时余量不足，参照 e2e/starfield.spec.ts 已有的
  // test.setTimeout 用法放宽
  test.setTimeout(60_000)
  await page.bringToFront()
  await page.goto('/')
  await waitForGlobeDebug(page)
  await waitForSurfaceReady(page)

  // 前置自检（非 SPEC 判据）：确认相机仍是 SPEC-3.1 默认视角，采样行取画布竖直中心
  const cam = await sampleCamera(page)
  expect(cam.x).toBeCloseTo(0, 3)
  expect(cam.y).toBeCloseTo(0, 3)
  expect(cam.z).toBeCloseTo(3.2, 3)
  expect(cam.earthRotY).toBeCloseTo(0, 3)

  // 令可见半球全部为深夜（t 从 -1 到约 -0.31，均在 SPEC-3.2 的 [-0.1,+0.1] band 之外），
  // 孤立辉光信号，不与昼纹理的蓝色海洋混淆
  await setSunDir(page, { x: 0, y: 0, z: -1 })
  // 连续两次双重 rAF：全量回归下多 e2e worker 并发占满 GPU/CPU 时，单次 waitNextFrame
  // 曾观测到读到 sunDir 更新前陈旧帧的情形，加倍等待帧数留出更充分的渲染余量
  await waitNextFrame(page)
  await waitNextFrame(page)

  const { width, height } = await canvasBufferSize(page)
  const cx = width / 2
  const cy = height / 2

  const N = 80
  const colors: [number, number, number][] = []
  for (let i = 0; i < N; i++) {
    const frac = i / (N - 1) // 0（中心）→ 1（左侧 90% 半宽处）
    const x = cx - frac * cx * 0.9
    colors.push(await samplePixelBox(page, x, cy, 3))
  }

  const blueness = colors.map(([r, g, b]) => b - Math.max(r, g))

  // 留存完整画布截图供人工判读球缘辉光带（SPEC-3.4 截图判据；BUG-008 要求视觉场景
  // 必须随证据归档截图）
  await page.screenshot({ path: 'test-results/atmosphere-glow.png' })

  // 在球体轮廓与外侧背景的合理区间内找辉光峰值（索引 35%~90%，见文件头注的视线几何
  // 估算，留有充分余量，不依赖精确换算）
  const lo = Math.floor(N * 0.35)
  const hi = Math.floor(N * 0.9)
  let peakIdx = lo
  for (let i = lo; i <= hi; i++) {
    if (blueness[i] > blueness[peakIdx]) peakIdx = i
  }

  // ① 辉光信号本身要足够显著（排除"完全没渲染出辉光"的退化情形）
  expect(blueness[peakIdx]).toBeGreaterThan(12)
  // ② 峰值处主色偏蓝：蓝通道明显高于红/绿（SPEC-3.4 主色 #4a90d9 = R74,G144,B217，
  //   蓝最高、红最低），不要求逐通道等值匹配（避免照抄实现取值）
  const [pr, pg, pb] = colors[peakIdx]
  expect(pb).toBeGreaterThan(pr)
  expect(pb).toBeGreaterThan(pg * 0.9)

  // ③ 由峰值向外（继续远离球心）衰减：多数步进非增（容忍星点噪声导致的少量反例），
  //   且末端（远离球缘的纯背景区）显著低于峰值——这是"由球缘向外衰减"的直接像素证据
  let nonIncreasingSteps = 0
  for (let i = peakIdx + 1; i < N; i++) {
    if (blueness[i] <= blueness[i - 1] + 3) nonIncreasingSteps++
  }
  const totalSteps = N - 1 - peakIdx
  expect(nonIncreasingSteps / totalSteps).toBeGreaterThanOrEqual(0.9)

  const tailAvg =
    colors
      .slice(N - 5)
      .map(([r, g, b]) => b - Math.max(r, g))
      .reduce((a, v) => a + v, 0) / 5
  expect(tailAvg).toBeLessThan(blueness[peakIdx] * 0.3)
})
