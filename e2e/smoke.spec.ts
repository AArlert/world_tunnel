import { expect, test } from '@playwright/test'

// M0-02：骨架冒烟——标题正确、canvas 渲染非零尺寸、无页面错误
test('骨架冒烟', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))

  await page.goto('/')
  await expect(page).toHaveTitle(/World Tunnel/)

  const canvas = page.locator('#globe-container canvas')
  await expect(canvas).toBeVisible()
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.width).toBeGreaterThan(0)
  expect(box!.height).toBeGreaterThan(0)

  await page.screenshot({ path: 'test-results/smoke.png' })
  expect(pageErrors).toEqual([])
})
