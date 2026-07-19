import { expect, test, type Page } from '@playwright/test'
import { sampleCamera, sampleStarfieldPose, waitForGlobeDebug, waitNextFrame } from './globeDebug'

// M1-11：空闲自转与输入打断（SPEC-7.3，时间基准 SPEC-7.5）。
// 期望值只从 doc/spec.md 推导：
//   - SPEC-7.3：无输入 10s 后地球本体开始缓慢自转（绕 SPEC-6.2 的 +Y 轴）；相机与星空不动；
//     任何输入立即停。
//   - SPEC-7.5：SPEC-7.3 中「每帧」表述的常量以 60fps 为基准，但本文件全程用真实墙钟时间
//     （page.waitForTimeout）采样、不假设固定帧率，10s 空闲阈值本身就是墙钟时间不受此影响。
// 前四条用例只断言「10s 后开始转」「作用于地球本体」「相机/星空不动」「任何输入立即停」
// 这四条 SPEC-7.3 明文判据；自转的具体角速度（≈0.02°/帧，折合 SPEC-7.5 时间基准下的
// ≈1.2°/s）由补测的第五条用例覆盖，见文末。
//
// 坑位规避：页面不可见时 requestAnimationFrame 会暂停，导致「一直没自转」的假象；
// 全程用 page.bringToFront() + document.visibilityState 断言页面确实可见/活动。
// 每个用例都需要真实等待 10s+ 的空闲阈值，属性质使然，不缩短等待时长凑快。

const CX = 400
const CY = 300

/** 单次往返读取地球本体自转角（弧度）与浏览器高精度时钟（ms），供速率断言用。
 * 两个值取自同一次 page.evaluate 往返，避免额外 IPC 往返带来的时间戳错位噪声。 */
async function sampleSpinClock(page: Page): Promise<{ earthRotY: number; tMs: number }> {
  return page.evaluate(() => {
    const dbg = (
      window as unknown as { __globeDebug: { globe: { markerRoot: { rotation: { y: number } } } } }
    ).__globeDebug
    return { earthRotY: dbg.globe.markerRoot.rotation.y, tMs: performance.now() }
  })
}

test.describe('空闲自转与输入打断（SPEC-7.3）', () => {
  test('空闲 10s 内不自转，越过阈值后地球本体持续自转，相机与星空全程不动（SPEC-7.3）', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await page.bringToFront()
    await page.goto('/')
    await waitForGlobeDebug(page)
    expect(await page.evaluate(() => document.visibilityState)).toBe('visible')

    const cam0 = await sampleCamera(page)
    const star0 = await sampleStarfieldPose(page)

    // 10s 空闲阈值内（留安全余量，在 6s 处取样）：地球本体不自转，相机不动（SPEC-7.3）
    await page.waitForTimeout(6000)
    const camIdle = await sampleCamera(page)
    const starIdle = await sampleStarfieldPose(page)
    expect(camIdle.earthRotY).toBeCloseTo(cam0.earthRotY, 9)
    expect(camIdle.x).toBeCloseTo(cam0.x, 9)
    expect(camIdle.y).toBeCloseTo(cam0.y, 9)
    expect(camIdle.z).toBeCloseTo(cam0.z, 9)
    expect(starIdle.rotation.y).toBeCloseTo(star0.rotation.y, 9)

    // 越过 10s 阈值（累计约 12s，留安全余量）：地球本体开始自转（SPEC-7.3）
    await page.waitForTimeout(6000)
    const camSpin1 = await sampleCamera(page)

    // 再等待确认是持续自转而非一次性跳变，且方向保持一致
    await page.waitForTimeout(2000)
    const camSpin2 = await sampleCamera(page)
    const star1 = await sampleStarfieldPose(page)

    const d1 = camSpin1.earthRotY - camIdle.earthRotY
    const d2 = camSpin2.earthRotY - camSpin1.earthRotY
    expect(Math.abs(d1)).toBeGreaterThan(0) // 已开始自转（SPEC-7.3）
    expect(Math.abs(d2)).toBeGreaterThan(0) // 持续自转，而非一次性跳变
    expect(Math.sign(d1)).toBe(Math.sign(d2)) // 方向一致——稳定绕 +Y 自转，而非抖动

    // 自转期间相机与星空不动（SPEC-7.3）
    expect(camSpin1.x).toBeCloseTo(cam0.x, 9)
    expect(camSpin1.y).toBeCloseTo(cam0.y, 9)
    expect(camSpin1.z).toBeCloseTo(cam0.z, 9)
    expect(camSpin2.x).toBeCloseTo(cam0.x, 9)
    expect(camSpin2.y).toBeCloseTo(cam0.y, 9)
    expect(camSpin2.z).toBeCloseTo(cam0.z, 9)
    expect(star1.rotation.y).toBeCloseTo(star0.rotation.y, 9)
    expect(star1.position.x).toBeCloseTo(star0.position.x, 9)
    expect(star1.position.y).toBeCloseTo(star0.position.y, 9)
    expect(star1.position.z).toBeCloseTo(star0.position.z, 9)
  })

  test('自转期间的滚轮输入立即使自转停止（SPEC-7.3）', async ({ page }) => {
    test.setTimeout(60_000)
    await page.bringToFront()
    await page.goto('/')
    await waitForGlobeDebug(page)
    expect(await page.evaluate(() => document.visibilityState)).toBe('visible')

    // 越过 10s 空闲阈值，确认已进入自转状态
    await page.waitForTimeout(11000)
    const spinA = await sampleCamera(page)
    await page.waitForTimeout(1500)
    const spinB = await sampleCamera(page)
    expect(Math.abs(spinB.earthRotY - spinA.earthRotY)).toBeGreaterThan(0) // 确认已在自转

    // 施加最小滚轮输入——只用作「输入」触发信号，不关心具体缩放幅度（灵敏度属实现自由度）
    await page.mouse.move(CX, CY)
    await page.mouse.wheel(0, 1)
    await waitNextFrame(page)
    const stoppedAt = await sampleCamera(page)

    // 立即停：打断瞬间起，短时间窗口内地球本体不再转动（SPEC-7.3）
    await page.waitForTimeout(300)
    const after1 = await sampleCamera(page)
    await page.waitForTimeout(600)
    const after2 = await sampleCamera(page)

    expect(after1.earthRotY).toBeCloseTo(stoppedAt.earthRotY, 9)
    expect(after2.earthRotY).toBeCloseTo(stoppedAt.earthRotY, 9)
  })

  test('自转期间的拖拽输入立即使自转停止（SPEC-7.3）', async ({ page }) => {
    test.setTimeout(60_000)
    await page.bringToFront()
    await page.goto('/')
    await waitForGlobeDebug(page)
    expect(await page.evaluate(() => document.visibilityState)).toBe('visible')

    // 越过 10s 空闲阈值，确认已进入自转状态
    await page.waitForTimeout(11000)
    const spinA = await sampleCamera(page)
    await page.waitForTimeout(1500)
    const spinB = await sampleCamera(page)
    expect(Math.abs(spinB.earthRotY - spinA.earthRotY)).toBeGreaterThan(0) // 确认已在自转

    // 施加最小拖拽输入（下压+微移+释放）——只用作「输入」触发信号
    await page.mouse.move(CX, CY)
    await page.mouse.down()
    await page.mouse.move(CX + 5, CY, { steps: 2 })
    await page.mouse.up()
    await waitNextFrame(page)
    const stoppedAt = await sampleCamera(page)

    // 立即停：打断瞬间起，短时间窗口内地球本体不再转动（SPEC-7.3）
    await page.waitForTimeout(300)
    const after1 = await sampleCamera(page)
    await page.waitForTimeout(600)
    const after2 = await sampleCamera(page)

    expect(after1.earthRotY).toBeCloseTo(stoppedAt.earthRotY, 9)
    expect(after2.earthRotY).toBeCloseTo(stoppedAt.earthRotY, 9)
  })

  // 补测：自转角速度（SPEC-7.3「≈0.02°/帧」+ SPEC-7.5「以 60fps 为基准，实际帧率不同时
  // 单位时间内的自转角速度保持一致，不随设备刷新率变化」）。
  // 期望值推导：0.02°/帧 × 60 帧/s（SPEC-7.5 的换算基准）= 1.2°/s，是与实际渲染帧率
  // 无关的时间基准角速度——本用例用真实墙钟时间（performance.now()）而非帧计数来
  // 测量角度变化率，直接验证该「按时间而非按帧计数」的不变量。
  test('空闲自转角速度按真实时间换算 ≈1.2°/s，与 SPEC-7.3 + SPEC-7.5 的时间基准换算一致', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await page.bringToFront()
    await page.goto('/')
    await waitForGlobeDebug(page)
    expect(await page.evaluate(() => document.visibilityState)).toBe('visible')

    // 越过 10s 空闲阈值进入自转状态后再起测——避免把"刚进入自转"的瞬间计入测速窗口
    await page.waitForTimeout(11000)
    const s0 = await sampleSpinClock(page)

    // 测速窗口取 5s 真实墙钟时间：窗口越长，等待/IPC 调度抖动占整体时长的比例越小，
    // 测得速率越接近真实值
    await page.waitForTimeout(5000)
    const s1 = await sampleSpinClock(page)

    const deltaDeg = ((s1.earthRotY - s0.earthRotY) * 180) / Math.PI
    const deltaSec = (s1.tMs - s0.tMs) / 1000
    const degPerSec = Math.abs(deltaDeg / deltaSec) // 方向不在 SPEC-7.3 约束范围内，只测速率大小

    // 容差 ±20%（即 [0.96, 1.44] °/s）依据：① SPEC-7.3 原文用「≈」表述该常量，本身
    // 允许一定近似；② 本文件全程用 page.waitForTimeout 等真实墙钟时间采样，叠加两次
    // page.evaluate 往返与 Playwright 调度的毫秒级抖动。±20% 足以吸收上述噪声，同时仍能
    // 拦截数量级错误（例如把"每帧固定增量"误当成用真实帧数而非真实时间折算，导致在
    // 实际帧率偏离 60fps 的运行环境下速率成倍偏差——这正是 SPEC-7.5 要求验证的不变量）。
    expect(degPerSec).toBeGreaterThan(1.2 * 0.8)
    expect(degPerSec).toBeLessThan(1.2 * 1.2)
  })
})
