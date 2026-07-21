import { expect, test } from '@playwright/test'

// M0-02：骨架冒烟——页面标题含品牌名「Worlens」、canvas 渲染非零尺寸、无页面错误。
// 期望值出处（只从 doc/spec.md 推导）：
//   - SPEC-2.1「品牌名『Worlens』（M2）」：标题须含品牌名 Worlens（原判据「World Tunnel」为
//     M0 期内部代号文案，orch 依 SPEC-2.1 与 REV-011 整改项 2 同步为 Worlens，见 testplan M0-02）。
test('骨架冒烟', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))

  await page.goto('/')
  await expect(page).toHaveTitle(/Worlens/) // SPEC-2.1 品牌名

  const canvas = page.locator('#globe-container canvas')
  await expect(canvas).toBeVisible()
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.width).toBeGreaterThan(0)
  expect(box!.height).toBeGreaterThan(0)

  await page.screenshot({ path: 'test-results/smoke.png' })
  expect(pageErrors).toEqual([])
})
