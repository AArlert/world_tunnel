import { expect, test, type Page } from '@playwright/test'
import { sampleCamera, waitForGlobeDebug, waitNextFrame, type Sample } from './globeDebug'

// M1-10：缩放范围限制（SPEC-7.2）。
// 期望值只从 doc/spec.md 推导：
//   - SPEC-7.2：缩放（滚轮/双指），相机距离 ∈ [1.8, 6]；向内/向外超界输入均不能突破该区间。
// 滚轮步长、捏合灵敏度由 design-prompt 声明为实现自由度，本文件不对其具体数值做任何断言，
// 全程通过运行时小幅标定（方法学同 e2e/drag-inertia.spec.ts）反推「输入符号 → 距离变化方向」，
// 再用远超标定量级的输入把相机推向边界，只断言 SPEC-7.2 的边界夹紧本身。

const CX = 400
const CY = 300
const LOWER = 1.8 // SPEC-7.2
const UPPER = 6 // SPEC-7.2
const BOUND_TOL = 0.05 // 边界附近的浮点/收敛判断余量，非 SPEC 数值

function distanceOf(s: Sample): number {
  return Math.hypot(s.x, s.y, s.z)
}

/** 连续对同一方向施加放大后的滚轮输入，逐次采样相机距离，返回全部采样值 */
async function pushWheel(page: Page, deltaY: number, times: number): Promise<number[]> {
  const distances: number[] = []
  for (let i = 0; i < times; i++) {
    await page.mouse.wheel(0, deltaY)
    await waitNextFrame(page)
    distances.push(distanceOf(await sampleCamera(page)))
  }
  return distances
}

function assertWithinBounds(distances: number[]) {
  for (const d of distances) {
    // 向内/向外超界输入均不能突破 [1.8, 6]（SPEC-7.2）
    expect(d).toBeLessThanOrEqual(UPPER + BOUND_TOL)
    expect(d).toBeGreaterThanOrEqual(LOWER - BOUND_TOL)
  }
}

test('滚轮缩放距离被限制在 [1.8, 6]，向外/向内超界输入均不能突破边界（SPEC-7.2）', async ({
  page,
}) => {
  // 超时预算（BUG-010）：本用例含标定 + 12 次滚轮推挤，每次 page.mouse.wheel + waitNextFrame
  // （双 rAF）在 8-worker 高负载下 rAF 被节流、单次往返墙钟拉长，默认 30s 预算偶发不足而超时。
  // 全部断言均为 SPEC-7.2 的边界夹紧与收敛（与墙钟无关，边界值被实现精确钳到 [1.8,6]），
  // 放宽的只是完成时间预算、不动任何判据。
  test.setTimeout(60_000)
  await page.goto('/')
  await waitForGlobeDebug(page)
  await page.mouse.move(CX, CY)

  const distBefore = distanceOf(await sampleCamera(page))

  // 小幅标定：测出「滚轮 deltaY 符号 → 距离变化方向」的经验关系，仅用于规划后续输入方向，
  // 不对其具体灵敏度数值做断言（灵敏度属实现自由度）
  const CALIB_DELTA = 20
  await page.mouse.wheel(0, CALIB_DELTA)
  await waitNextFrame(page)
  const distCalib = distanceOf(await sampleCamera(page))
  const calibChange = distCalib - distBefore
  expect(Math.abs(calibChange)).toBeGreaterThan(0)
  const dirIncrease = Math.sign(calibChange) // deltaY 为正号时，距离随之变化的方向
  const relRate = Math.abs(calibChange) / distBefore / CALIB_DELTA // 每单位 deltaY 引起的相对距离变化速率（经验值，仅用于规划步长，非断言对象）

  // 放大到足以让距离从任意初始值越过任一边界的量级（目标相对变化 ~20 倍，留足安全余量）
  const bigDeltaY = Math.min(Math.max(20 / relRate, CALIB_DELTA * 10), 1e9)

  // 向外超界：反复施加使距离增大方向的巨量输入
  const upSeries = await pushWheel(page, dirIncrease * bigDeltaY, 6)
  assertWithinBounds(upSeries)
  // 收敛（不再变化）且落在 SPEC-7.2 规定的上界 6
  expect(upSeries[upSeries.length - 1]).toBeCloseTo(upSeries[upSeries.length - 2], 2)
  expect(upSeries[upSeries.length - 1]).toBeCloseTo(UPPER, 1)

  // 向内超界：反向施加同等量级的巨量输入
  const downSeries = await pushWheel(page, -dirIncrease * bigDeltaY, 6)
  assertWithinBounds(downSeries)
  expect(downSeries[downSeries.length - 1]).toBeCloseTo(downSeries[downSeries.length - 2], 2)
  expect(downSeries[downSeries.length - 1]).toBeCloseTo(LOWER, 1)
})

test('双指捏合缩放同样被限制在 [1.8, 6]，向外/向内超界输入均不能突破边界（SPEC-7.2）', async ({
  page,
}) => {
  // 超时预算（BUG-010）：捏合用例额外起 CDP 会话 + 12 次 touch 派发 + waitNextFrame，8-worker
  // 高负载下默认 30s 预算偶发不足而超时；断言均为 SPEC-7.2 边界夹紧与收敛，不动判据（同上）。
  test.setTimeout(60_000)
  await page.goto('/')
  await waitForGlobeDebug(page)

  const client = await page.context().newCDPSession(page)
  const midX = CX
  const midY = CY

  async function touch(type: 'touchStart' | 'touchMove' | 'touchEnd', halfDist: number) {
    await client.send('Input.dispatchTouchEvent', {
      type,
      touchPoints:
        type === 'touchEnd'
          ? []
          : [
              { x: midX - halfDist, y: midY, id: 0 },
              { x: midX + halfDist, y: midY, id: 1 },
            ],
    })
  }

  const distBefore = distanceOf(await sampleCamera(page))

  let halfDist = 40 // 初始两指半间距（像素）
  await touch('touchStart', halfDist)
  await waitNextFrame(page)

  // 小幅标定：两指间距变化的符号 → 相机距离变化方向，仅用于规划后续输入方向，
  // 不对其具体捏合灵敏度数值做断言（属实现自由度）
  const CALIB_STEP = 15
  halfDist += CALIB_STEP
  await touch('touchMove', halfDist)
  await waitNextFrame(page)
  const distCalib = distanceOf(await sampleCamera(page))
  const calibChange = distCalib - distBefore
  expect(Math.abs(calibChange)).toBeGreaterThan(0)
  const widenIncreasesDistance = Math.sign(calibChange) // 双指间距变大（正号）时，相机距离变化的方向
  const relRate = Math.abs(calibChange) / distBefore / CALIB_STEP

  // 放大到足以让距离从任意初始值越过任一边界的量级
  const bigStep = Math.min(Math.max(20 / relRate, CALIB_STEP * 10), 5000)

  async function pushPinch(stepSign: number, times: number): Promise<number[]> {
    const distances: number[] = []
    for (let i = 0; i < times; i++) {
      halfDist = Math.max(halfDist + stepSign * bigStep, 1)
      await touch('touchMove', halfDist)
      await waitNextFrame(page)
      distances.push(distanceOf(await sampleCamera(page)))
    }
    return distances
  }

  // 向外超界：反复把两指间距朝「使相机距离增大」的方向拉伸
  const upSeries = await pushPinch(widenIncreasesDistance, 6)
  assertWithinBounds(upSeries)
  expect(upSeries[upSeries.length - 1]).toBeCloseTo(upSeries[upSeries.length - 2], 2)
  expect(upSeries[upSeries.length - 1]).toBeCloseTo(UPPER, 1)

  // 向内超界：反向收拢两指间距
  const downSeries = await pushPinch(-widenIncreasesDistance, 6)
  assertWithinBounds(downSeries)
  expect(downSeries[downSeries.length - 1]).toBeCloseTo(downSeries[downSeries.length - 2], 2)
  expect(downSeries[downSeries.length - 1]).toBeCloseTo(LOWER, 1)

  await touch('touchEnd', halfDist)
})
