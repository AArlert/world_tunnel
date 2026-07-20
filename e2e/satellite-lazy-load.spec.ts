import { expect, test } from '@playwright/test'
import { waitForGlobeDebug, waitForRealEarthTexture, waitForSurfaceReady } from './globeDebug'

// M2-17：卫星昼夜底图退出默认加载路径。
//
// 判据出处（只从 doc/spec.md 推导）：
//   - SPEC-3.2③「卫星昼夜底图退出默认加载：昼纹理 earth_day.jpg、夜纹理 earth_night.jpg
//     ……并入付费天气风格包（SPEC-3.9）」。
//   - SPEC-3.9「风格包资源懒加载：未解锁/未选用不下载，不计入首包」。
//
// 判定法（黑盒网络断言，不读实现内部调用了哪个函数）：监听 Playwright 的 request 事件，
// 判断浏览器是否实际对 earth_day.jpg / earth_night.jpg（src/globe/textures.ts 的
// DAY_URL/NIGHT_URL）发出过 HTTP 请求。默认（矢量）启动不应发出；DEV-only 的
// `?style=satellite` 钩子（src/App.tsx，BUG-020 方案 a）作为「仅用户显式切换才触发加载」
// 判据的可操作代理——本场景不实现真实的风格切换 UI（那是 M4 FM-18），钩子路径证明
// 卫星资源确实被保留、可被触发加载，而非被误删。

function isSatelliteTextureRequest(url: string) {
  return url.includes('earth_day.jpg') || url.includes('earth_night.jpg')
}

test.describe('M2-17 卫星昼夜底图退出默认加载路径', () => {
  test('默认（矢量）启动不请求卫星昼/夜纹理（SPEC-3.2③ + SPEC-3.9）', async ({ page }) => {
    const requests: string[] = []
    page.on('request', (req) => {
      if (isSatelliteTextureRequest(req.url())) requests.push(req.url())
    })

    await page.goto('/')
    await waitForGlobeDebug(page)
    await waitForSurfaceReady(page)
    // 给异步加载器一个可观测窗口：若默认路径误触发了卫星纹理加载，请求会在此期间发出
    await page.waitForTimeout(1000)

    expect(requests).toEqual([])
  })

  test('?style=satellite 时钩子有效——卫星纹理照常请求并加载完成（SPEC-3.2③「仅显式切换才触发加载」的可操作代理）', async ({
    page,
  }) => {
    const requests: string[] = []
    page.on('request', (req) => {
      if (isSatelliteTextureRequest(req.url())) requests.push(req.url())
    })

    await page.goto('/?style=satellite')
    await waitForGlobeDebug(page)
    await waitForRealEarthTexture(page)

    expect(requests.some((u) => u.includes('earth_day.jpg'))).toBe(true)
    expect(requests.some((u) => u.includes('earth_night.jpg'))).toBe(true)
  })
})
