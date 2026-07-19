import { expect, test } from '@playwright/test'
import { sampleCamera, sampleEarthGeometry, waitForGlobeDebug } from './globeDebug'

// M1-04：地球几何与相机初始参数（SPEC-3.1）。
// 期望值全部取自 doc/spec.md SPEC-3.1：
//   - 球半径 1.0、SphereGeometry 分段 ≥64
//   - 相机 fov=45°、初始距离 3.2
// 通过 DEV-only 调试钩子 window.__globeDebug（锁在 import.meta.env.DEV 分支，生产构建
// 不含，见 GlobeScene.ts）读取运行时场景的 camera 与 markerRoot 对外暴露属性做黑盒断言，
// 不读取 controls.ts / earth.ts 的内部实现常量反推期望值。
test('地球几何与相机初始参数符合 SPEC-3.1', async ({ page }) => {
  await page.goto('/')
  await waitForGlobeDebug(page)

  const cam = await sampleCamera(page)
  const geo = await sampleEarthGeometry(page)

  // 相机 fov=45°（SPEC-3.1）
  expect(cam.fov).toBe(45)

  // 相机初始距离 3.2（SPEC-3.1）——用位置向量模长校验，不对具体朝向分量做断言
  const distance = Math.hypot(cam.x, cam.y, cam.z)
  expect(distance).toBeCloseTo(3.2, 5)

  // 球半径 1.0、SphereGeometry 分段 ≥64（SPEC-3.1）
  expect(geo.radius).toBe(1)
  expect(geo.widthSegments).toBeGreaterThanOrEqual(64)
  expect(geo.heightSegments).toBeGreaterThanOrEqual(64)
})
