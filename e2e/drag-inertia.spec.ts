import { expect, test } from '@playwright/test'
import { sampleCamera, waitForGlobeDebug, waitNextFrame, type Sample } from './globeDebug'

// M1-09：拖拽旋转与惯性衰减（SPEC-7.1，时间基准 SPEC-7.5）。
// 期望值只从 doc/spec.md 推导：
//   - SPEC-7.1：拖拽与惯性作用于相机（方位角/仰角），地球本体不因拖拽转动；
//     水平方位角绕 Y 无限制（可累计超 360°）；垂直视角限制在纬度 ±85° 以内不可拖出；
//     释放后惯性按阻尼系数 ≈0.95/帧衰减，逐帧减速趋于停止。
//   - SPEC-7.5：以 60fps 为基准的「每帧」常量，实际按经过的真实时间等效换算，
//     故本文件全程用真实墙钟时间（page.waitForTimeout）采样，不假设固定帧率。
// 像素→角度的换算比例（design-prompt 声明为实现自由度，如 DRAG_SENSITIVITY）一律通过
// 运行时小幅标定拖拽反推，不对其具体数值做任何断言，只用反推结果规划后续拖拽距离/步长。

const CX = 400
const CY = 300

/** 归一化角差到 (-π, π]，用于安全展开跨 ±180° 边界的连续采样 */
function angularDiff(a: number, b: number): number {
  let d = a - b
  while (d > Math.PI) d -= 2 * Math.PI
  while (d <= -Math.PI) d += 2 * Math.PI
  return d
}

function azimuthOf(s: Sample): number {
  return Math.atan2(s.x, s.z)
}

/** 由相机位置反推「纬度」：y = distance·sin(lat)，与 SPEC-6.2 坐标约定
 * （北极 (90,·)→+Y）一致，是通用球面几何关系，非实现细节。 */
function latitudeOf(s: Sample): number {
  const distance = Math.hypot(s.x, s.y, s.z)
  return (Math.asin(s.y / distance) * 180) / Math.PI
}

test('拖拽水平方位角无限制（可累计超 360°），地球本体不因拖拽转动（SPEC-7.1）', async ({ page }) => {
  await page.goto('/')
  await waitForGlobeDebug(page)

  const before = await sampleCamera(page)

  await page.mouse.move(CX, CY)
  await page.mouse.down()

  // 小幅标定：测出「像素→方位角弧度」的经验比例，仅用于规划后续采样步长，不对其数值做断言
  const CALIB_PX = 12
  await page.mouse.move(CX + CALIB_PX, CY, { steps: 3 })
  await waitNextFrame(page)
  const calib = await sampleCamera(page)
  const calibDelta = angularDiff(azimuthOf(calib), azimuthOf(before))
  expect(Math.abs(calibDelta)).toBeGreaterThan(0)
  const radPerPx = calibDelta / CALIB_PX
  const dir = Math.sign(radPerPx)

  // 规划步长：每步目标约 40°（远小于 180° 的安全展开阈值），累计 11 步 ≈ 440° > 360°
  const targetStepRad = (40 * Math.PI) / 180
  const stepPx = Math.min(Math.max(Math.abs(targetStepRad / radPerPx), 1), 2_000_000)

  let lastAz = azimuthOf(calib)
  let unwrapped = calibDelta
  let lastSample = calib
  let cumulativePx = CALIB_PX
  for (let i = 1; i <= 11; i++) {
    cumulativePx += stepPx
    await page.mouse.move(CX + dir * cumulativePx, CY, { steps: 3 })
    await waitNextFrame(page)
    const s = await sampleCamera(page)
    const az = azimuthOf(s)
    const d = angularDiff(az, lastAz)
    // 展开前提自检（测试方法学自检，非 SPEC 判据）：步长规划是否安全
    expect(Math.abs(d)).toBeLessThan(Math.PI)
    unwrapped += d
    lastAz = az
    lastSample = s
  }

  // 水平方位角无限制、可累计超 360°（SPEC-7.1）
  expect(Math.abs(unwrapped)).toBeGreaterThan(2 * Math.PI)

  // 拖拽全程地球本体未被带动转动（SPEC-7.1：拖拽作用于相机，地球本体不因拖拽转动）
  expect(lastSample.earthRotY).toBeCloseTo(before.earthRotY, 10)

  await page.mouse.up()
})

test('垂直仰角限制在纬度 ±85° 以内，不可拖出（SPEC-7.1）', async ({ page }) => {
  await page.goto('/')
  await waitForGlobeDebug(page)

  await page.mouse.move(CX, CY)
  await page.mouse.down()
  await waitNextFrame(page)
  const before = await sampleCamera(page)

  // 小幅标定：测出「像素→纬度度数」的经验比例，仅用于规划推到边界所需的拖拽距离
  const CALIB_PX = 12
  await page.mouse.move(CX, CY - CALIB_PX, { steps: 3 })
  await waitNextFrame(page)
  const calib = await sampleCamera(page)
  const calibDelta = latitudeOf(calib) - latitudeOf(before)
  expect(Math.abs(calibDelta)).toBeGreaterThan(0)
  const degPerPx = calibDelta / CALIB_PX
  const upSign = Math.sign(degPerPx)

  // 150° 覆盖任何可能的边界位置（真实上限不超过 ±90°），确保能推到极限
  const pxFor150Deg = Math.min(Math.max(Math.abs(150 / degPerPx), 1), 2_000_000)

  await page.mouse.move(CX, CY - upSign * pxFor150Deg, { steps: 20 })
  await waitNextFrame(page)
  const northEnd = await sampleCamera(page)
  const latNorth = latitudeOf(northEnd)
  // 未越过 SPEC-7.1 的纬度 ±85° 边界（留 0.5° 浮点/几何换算余量）
  expect(Math.abs(latNorth)).toBeLessThanOrEqual(85.5)
  // 拖拽确实起作用、被推向了边界附近，而非纹丝不动
  expect(Math.abs(latNorth)).toBeGreaterThan(70)

  // 继续同向大幅拖拽，纬度不再变化——证明是被夹紧而非仍在缓慢逼近
  await page.mouse.move(CX, CY - upSign * pxFor150Deg * 2, { steps: 20 })
  await waitNextFrame(page)
  const northHeld = await sampleCamera(page)
  expect(latitudeOf(northHeld)).toBeCloseTo(latNorth, 3)

  // 反向推向另一端（幅度覆盖从当前端点到另一端点的最大可能跨度）
  await page.mouse.move(CX, CY + upSign * pxFor150Deg * 4, { steps: 20 })
  await waitNextFrame(page)
  const southEnd = await sampleCamera(page)
  const latSouth = latitudeOf(southEnd)
  expect(Math.abs(latSouth)).toBeLessThanOrEqual(85.5)
  expect(Math.abs(latSouth)).toBeGreaterThan(70)
  expect(Math.sign(latSouth)).not.toBe(Math.sign(latNorth))

  await page.mouse.up()
})

test('释放拖拽后惯性按真实时间衰减并收敛停止，收敛后无输入相机不再漂移（SPEC-7.1 + SPEC-7.5）', async ({
  page,
}) => {
  await page.bringToFront()
  await page.goto('/')
  await waitForGlobeDebug(page)
  expect(await page.evaluate(() => document.visibilityState)).toBe('visible')

  const before = await sampleCamera(page)

  await page.mouse.move(CX, CY)
  await page.mouse.down()
  // 一段末速度明显非零的拖拽，为释放后的惯性提供初速度
  await page.mouse.move(CX + 300, CY, { steps: 10 })
  await page.mouse.up()
  await waitNextFrame(page)

  const t0 = await sampleCamera(page)
  await page.waitForTimeout(300)
  const t1 = await sampleCamera(page)
  // 阻尼系数 ≈0.95/帧、以 60fps 为基准（SPEC-7.1 + SPEC-7.5）：指数衰减下数秒真实时间
  // 即可让任何合理量级的初速度衰减到可忽略量级；下面几个检查点在累计 4.2s/6.2s/7.2s/8.2s
  // （留出较宽裕的真实时间余量，覆盖不同拖拽初速度与运行环境的时序抖动），
  // 全程仍在 SPEC-7.3 的 10s 空闲阈值内，不与自转场景混叠
  await page.waitForTimeout(3900)
  const t2 = await sampleCamera(page)
  await page.waitForTimeout(2000)
  const t3 = await sampleCamera(page)
  await page.waitForTimeout(1000)
  const t4 = await sampleCamera(page)

  const d1 = Math.abs(angularDiff(azimuthOf(t1), azimuthOf(t0)))
  const dConv1 = Math.abs(angularDiff(azimuthOf(t3), azimuthOf(t2)))
  const dConv2 = Math.abs(angularDiff(azimuthOf(t4), azimuthOf(t3)))

  // 惯性确实存在：释放后一段时间内相机仍在运动（否则谈不上"衰减"）
  expect(d1).toBeGreaterThan(0)
  // 逐帧减速趋于停止（SPEC-7.1）：足够长真实时间之后，相邻采样点之间不再有可观测的变化
  expect(dConv1).toBeLessThan(1e-6)
  expect(dConv2).toBeLessThan(1e-6)

  // 收敛后继续静置，确认无任何输入时相机位姿不再变化（不漂移）——
  // 若此处观察到持续漂移，即违反 SPEC-7.1 的收敛判据
  await page.waitForTimeout(1000)
  const t5 = await sampleCamera(page)
  const d5 = Math.abs(angularDiff(azimuthOf(t5), azimuthOf(t4)))
  expect(d5).toBeLessThan(1e-6)

  // 全程地球本体未被拖拽/惯性带动（SPEC-7.1：作用于相机，地球本体不因拖拽转动）
  expect(t5.earthRotY).toBeCloseTo(before.earthRotY, 10)
})
