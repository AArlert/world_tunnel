import { expect, test } from '@playwright/test'

// M2-18：顶栏品牌名与 UTC 时钟（e2e）。
// 期望值出处（断言期望值只从 doc/spec.md 推导，逐条标注 SPEC 条目）：
//   - SPEC-2.1「顶栏（48px）：品牌名『Worlens』（M2）… UTC 时钟（M2，实时刷新，格式 HH:MM:SS UTC）」。
// 加密行情 ticker 属 M3（SPEC-2.1 + SPEC-5.7），不入本场景判据。
// 说明：class 选择器仅用于「定位」顶栏元素（读 src/App.tsx 导出结构做对接），
// 不把实现取值当期望——文本「Worlens」、高度 48、时钟格式均从 SPEC-2.1 推导。

test('顶栏渲染品牌名文本「Worlens」（SPEC-2.1）', async ({ page }) => {
  await page.goto('/')
  const brand = page.locator('.brand')
  await expect(brand).toBeVisible()
  await expect(brand).toHaveText('Worlens') // SPEC-2.1「品牌名『Worlens』」
})

test('顶栏高度为 48px（SPEC-2.1）', async ({ page }) => {
  await page.goto('/')
  const topbar = page.locator('.topbar')
  await expect(topbar).toBeVisible()
  const box = await topbar.boundingBox()
  if (!box) throw new Error('.topbar 未找到或不可见')
  expect(Math.round(box.height)).toBe(48) // SPEC-2.1「顶栏（48px）」
})

test('顶栏 UTC 时钟文本格式为 HH:MM:SS UTC（SPEC-2.1）', async ({ page }) => {
  await page.goto('/')
  const clock = page.locator('.topbar__clock')
  await expect(clock).toBeVisible()

  const text = (await clock.innerText()).trim()
  // SPEC-2.1「格式 HH:MM:SS UTC」：两位小时:两位分钟:两位秒 + 空格 + UTC 后缀
  expect(text).toMatch(/^\d{2}:\d{2}:\d{2} UTC$/)

  // SPEC-2.1「UTC 时钟」：显示的确为 UTC 而非本地时（与浏览器同一时刻的 UTC 时分秒比对）。
  // 在同一 page.evaluate 内同步取时钟文本与 UTC「当日秒数」，二者最多相差约一个刷新间隔；
  // 用 ±10s 容差并按 86400 环绕取最小差，覆盖跨零点回绕，仍能区分 UTC（正确）与本地时（时区非 0 时差整小时）。
  const m = text.match(/^(\d{2}):(\d{2}):(\d{2}) UTC$/)!
  const displayedSod = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
  const utcSod = await page.evaluate(() => {
    const d = new Date()
    return d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds()
  })
  const diff = Math.abs(displayedSod - utcSod)
  const wrapped = Math.min(diff, 86400 - diff)
  expect(wrapped).toBeLessThanOrEqual(10)
})

test('UTC 时钟实时刷新——间隔 >1s 两次采样取值不同（SPEC-2.1）', async ({ page }) => {
  await page.goto('/')
  const clock = page.locator('.topbar__clock')
  await expect(clock).toBeVisible()

  const t1 = (await clock.innerText()).trim()
  expect(t1).toMatch(/^\d{2}:\d{2}:\d{2} UTC$/)

  // 真实时间推进 >1s（不 mock 时钟绕过，SPEC-2.1「实时刷新」）：>1s 必跨至少一次秒进位
  await page.waitForTimeout(1500)

  const t2 = (await clock.innerText()).trim()
  expect(t2).toMatch(/^\d{2}:\d{2}:\d{2} UTC$/)
  expect(t2).not.toBe(t1) // 两次取值不同，证明随真实时间推进而非静态占位文本
})
