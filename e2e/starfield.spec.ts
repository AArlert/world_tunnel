import { expect, test } from '@playwright/test'
import { sampleCamera, waitForGlobeDebug, waitNextFrame } from './globeDebug'

// M1-08（e2e/视觉部分）：星空随相机旋转、不随地球自转（SPEC-3.5）。
// 期望值只从 doc/spec.md 推导：
//   - SPEC-3.5「程序化点星…随相机旋转（不随地球自转）」。
// 判据设计说明（对比两组截图，而非只读 Object3D 姿态）：
// 星空对象本身固定挂在 scene 根、姿态从不改变（这是 M1-11 已验证的黑盒不变量）；
// 相机绕球心转动时之所以"看起来"星空随之运动，是相机朝向/位置变化导致的渲染结果，
// 只有真实渲染像素能体现——故本文件按 testplan M1-08 的登记，用截图对比验证。
//
// 安全采样区选取（避免把地球/大气误判为"星空"）：
// 只截取画布左侧一个窄条（宽度取画布宽度的 20%，取满高度），不覆盖地球与大气辉光。
// 依据：相机 fov=45°、初始距离 3.2、球半径 1（SPEC-3.1，与本文件 M1-08 无关但坐标几何
// 通用）——球面半张角 asin(1/3.2)≈18.2°，明显小于半 FOV 22.5°；即便在更宽的画布宽高比下
// （水平半 FOV 大于纵向半 FOV），球体轮廓在水平方向占据画布中心到左右各约 30% 的范围，
// 左侧 20% 宽度的窄条留有安全余量，不会被球体或其边缘辉光覆盖；同时该区域在页面右侧
// 的 side-panel 覆盖范围之外（side-panel 只贴右边），不受面板重绘影响。

const CX = 400
const CY = 300

async function starZoneClip(page: import('@playwright/test').Page) {
  const canvas = page.locator('#globe-container canvas')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('canvas 未找到或不可见')
  return { x: box.x, y: box.y, width: box.width * 0.2, height: box.height }
}

test('相机旋转时星空区域像素随之变化（SPEC-3.5）', async ({ page }) => {
  await page.goto('/')
  await waitForGlobeDebug(page)

  const clip = await starZoneClip(page)
  const before = await page.screenshot({ clip })

  // 大幅拖拽使相机绕球心转动一个明显角度（拖拽换算比例属实现自由度，
  // 只用较大像素位移确保相机确实转动了可观测的角度，不对换算比例本身做断言）
  const camBefore = await sampleCamera(page)
  await page.mouse.move(CX, CY)
  await page.mouse.down()
  await page.mouse.move(CX + 300, CY, { steps: 10 })
  await page.mouse.up()
  await waitNextFrame(page)
  const camAfter = await sampleCamera(page)
  // 前置自检（非 SPEC 判据）：确认相机确实转动了，否则后续像素对比无意义
  expect(camAfter.x).not.toBeCloseTo(camBefore.x, 3)

  const after = await page.screenshot({ clip })
  expect(Buffer.compare(before, after)).not.toBe(0)
})

test('地球自转（空闲自转）期间星空区域像素不随之变化（SPEC-3.5，需附截图）', async ({ page }) => {
  test.setTimeout(60_000)
  await page.bringToFront()
  await page.goto('/')
  await waitForGlobeDebug(page)
  expect(await page.evaluate(() => document.visibilityState)).toBe('visible')

  // 越过 SPEC-7.3 的 10s 空闲阈值，进入地球本体自转状态
  await page.waitForTimeout(11000)
  const clip = await starZoneClip(page)
  const rot0 = (await sampleCamera(page)).earthRotY
  const shotA = await page.screenshot({ clip })

  // 再等待一段真实时间，确认地球本体确实持续转动了可观测角度
  await page.waitForTimeout(3000)
  const rot1 = (await sampleCamera(page)).earthRotY
  expect(Math.abs(rot1 - rot0)).toBeGreaterThan(0)

  const shotB = await page.screenshot({ clip })
  // 地球本体在此期间转动，但星空区域像素保持不变（SPEC-3.5：星空不随地球自转）
  expect(Buffer.compare(shotA, shotB)).toBe(0)

  // 视觉判据留证：附完整画布截图（testplan M1-08 含"视觉"字样，须附截图，见 BUG-008）
  await page.screenshot({ path: 'test-results/starfield.png' })
})
