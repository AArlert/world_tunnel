import { expect, test } from '@playwright/test'
import type { GeoEvent } from '../src/data'
import {
  canvasBufferSize,
  findColorInRegionStable,
  sampleCamera,
  sampleMarkerRings,
  samplePixelBoxStable,
  setDebugEvents,
  setEarthRotationY,
  waitForGlobeDebug,
  waitForSurfaceReady,
  waitNextFrame,
} from './globeDebug'

// M3-03：标记 severity 明度/饱和/发光三通道分层（视觉，需附截图；e2e，真实 Chromium + WebGL）。
//
// 判据出处（断言期望值只从 doc/spec.md 推导，逐条标注 SPEC 条目；对应 doc/testplan.md M3-03
// 行文，容差口径由 REV-013 §3.1 定死）：
//   - SPEC-3.7 v0.2.13 severity 三通道分层：以 sev3 = 分类 pin 色本身，按 HSL 乘子派生
//     sev2（S×0.82 / L×0.93）、sev1（S×0.60 / L×0.82）——**乘子规则为权威契约**，六类分级
//     hex 为按规则计算的派生参考。发光通道：sev3 持续脉冲光环（bloom）/ sev2 静态柔光环无脉冲
//     / sev1 无辉光。「发光为最强权重杠杆：sev3 发光、sev1 为哑色小点」。
//   - 不变量 A（SPEC-3.7「色相不动，仍取上表分类色」）：色相跨 severity 恒定，允 ±2° 取整漂移。
//
// REV-013 §3.1 容差口径（QA 断言取以下**两等价路径之一**，在此落稿取路径 (b)）：
//   路径 (b)：断渲染标记像素的派生 sRGB 对 SPEC-3.7 六类分级参考表**每通道 ±ε**（ε 建议
//   ±6/255 量级）；并断不变量 A（色相跨 severity 恒定，允 ±2°）与单调方向（sev3>sev2>sev1
//   于 L、S 双通道）。发光通道为对外可见硬判据、**直接断存在性**（sev3 脉冲=环随时间起伏 /
//   sev2 静态=环恒定 / sev1 无环=环缩放 0）。
//   —— 取 (b) 而非 (a) 的理由：矢量标记点 shader 直接输出 vColor（无光照，见 src/globe/
//   markers.ts dotFragmentShader），末尾 colorspace_fragment 转 sRGB，故画布回读的标记中心
//   像素即派生分级色的 sRGB 值，可直接对参考表逐通道比对，无需在页面内反解 HSL 乘子比。
//
// 事件注入（任务卡要求，防真实轮询覆写）：拦截跨源请求使 scheduler 轮询全失败、不产生
// onResult 覆盖，经 window.__globeDebug.setEvents 注入构造事件（见 goToIdleGlobe / M2-10 头注）。

const DEG = Math.PI / 180
const HALF_FOV_Y = 22.5 * DEG // SPEC-3.1 fov 45°

// SPEC-3.7 六类分级参考表（sRGB hex，逐字照条目正文；乘子规则为权威、此为派生参考，路径 (b) 用）。
type Category = GeoEvent['category']
const SEVERITY_HEX: Record<string, Record<1 | 2 | 3, number>> = {
  disaster: { 3: 0xff4d4f, 2: 0xed484a, 1: 0xcf4142 },
  news: { 3: 0x40a9ff, 2: 0x3d9dec, 1: 0x388acd },
  launch: { 3: 0xb37feb, 2: 0xa674dc, 1: 0x9366c3 },
}

// 路径 (b) 每通道容差 ε：矢量标记为无纹理程序化纯色，sRGB round-trip 偏差 ≤1~2；SPEC 派生
// 参考 hex 与实现的 HSL→sRGB 派生同法取整（已按 SPEC-3.7 乘子逐色核算落在同点），ε=6 留足
// 环境/抗锯齿余量，且明显小于相邻 severity 的通道差（六分级各档间通道差 ≥15），仍能鉴别档位。
const EPS = 6
const HUE_TOL_DEG = 2 // 不变量 A：色相跨 severity 允 ±2° 取整漂移（SPEC-3.7）
const HALF = 55 // 颜色采样窗口半径（设备像素）：标记直径远小于此，留足投影定位容差
// 命中像素下限：排除偶发一两个噪声像素落入容差的误判。取 20——最小的 sev1 标记（基础尺寸最小，
// SPEC-3.7 尺寸随级递增）实测命中约 37 像素的实心簇，背景深蓝底面绝无红/蓝/紫分级色像素落入
// ±ε，故 20 远高于噪声量级（0~2 像素）又低于最小标记的实心簇，能确认命中的是标记本体。
const MIN_MATCH_PIXELS = 20

/**
 * 投影几何（仅用于「去画布哪采样」，不构成断言期望值）：SPEC-3.1 默认相机 (0,0,3.2)、fov45°；
 * SPEC-6.2 lat/lon → 模型空间 (cos(lat)sin(lon), sin(lat), cos(lat)cos(lon))。同 M2-10。
 */
function projectLatLon(latDeg: number, lonDeg: number, width: number, height: number) {
  const lat = latDeg * DEG
  const lon = lonDeg * DEG
  const px = Math.cos(lat) * Math.sin(lon)
  const py = Math.sin(lat)
  const pz = Math.cos(lat) * Math.cos(lon)
  const negCamZ = 3.2 - pz
  const aspect = width / height
  const ndcX = px / (negCamZ * Math.tan(HALF_FOV_Y) * aspect)
  const ndcY = py / (negCamZ * Math.tan(HALF_FOV_Y))
  return { x: ((ndcX + 1) / 2) * width, y: ((1 - ndcY) / 2) * height }
}

/** SPEC-6.2 单位方向（用于按 lat/lon 识别是哪档 severity 的环实例，非断言期望值）。 */
function latLonUnitDir(latDeg: number, lonDeg: number): [number, number, number] {
  const lat = latDeg * DEG
  const lon = lonDeg * DEG
  return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)]
}

function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff]
}

/** sRGB(0-255) → HSL（h 度、s/l ∈[0,1]），标准公式；用于不变量 A（色相）与 L/S 单调方向。 */
function rgbToHsl([r, g, b]: readonly number[]): { h: number; s: number; l: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  let s = 0
  if (d > 1e-9) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === rn) h = ((gn - bn) / d) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s, l }
}

/** 色相圆周差（度），处理 0/360 环绕。 */
function hueDiff(a: number, b: number): number {
  const d = Math.abs(a - b)
  return Math.min(d, 360 - d)
}

let seq = 0
function makeEvent(o: Pick<GeoEvent, 'category' | 'severity' | 'lat' | 'lon'>): GeoEvent {
  seq += 1
  return { id: `m3-03:${seq}`, title: 'synthetic', summary: '', urls: [], ts: Date.now(), source: 'usgs', ...o }
}

// 拦截真实轮询、进入零态默认地球（同 M2-10 头注：防数据层 onResult 覆盖注入事件）。
async function goToIdleGlobe(page: import('@playwright/test').Page) {
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return route.continue()
    return route.abort()
  })
  await page.bringToFront()
  await page.goto('/')
  await waitForGlobeDebug(page)
  await waitForSurfaceReady(page)
  const cam = await sampleCamera(page)
  expect(cam.x).toBeCloseTo(0, 3)
  expect(cam.y).toBeCloseTo(0, 3)
  expect(cam.z).toBeCloseTo(3.2, 3)
  expect(cam.earthRotY).toBeCloseTo(0, 3)
}

const IDLE_RESET_X = 80
const IDLE_RESET_Y = 650
async function resetIdleTimer(page: import('@playwright/test').Page) {
  await page.mouse.click(IDLE_RESET_X, IDLE_RESET_Y)
}

// 颜色测试布局：3 分类（暖红/冷蓝/紫，跨色相族验证乘子规则与分类无关）× 3 severity。
// 行=分类（纬度分离），列=severity（经度分离）；行列间距远大于采样窗（HALF=55），互不重叠。
const COLOR_CATS: Category[] = ['disaster', 'news', 'launch']
const ROW_LAT: Record<string, number> = { disaster: 32, news: 0, launch: -32 }
const COL_LON: Record<1 | 2 | 3, number> = { 3: -42, 2: 0, 1: 42 }

test('分级色对 SPEC-3.7 参考表逐通道 ±ε、色相跨 severity 恒定 ±2°、L/S 单调递减（路径 b，截图存证）', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await goToIdleGlobe(page)
  const { width, height } = await canvasBufferSize(page)

  // 同屏注入 3 分类 × 3 severity（首个非空快照即时上屏、alpha=1，SPEC-3.11 无前态 snap）
  const events: GeoEvent[] = []
  for (const cat of COLOR_CATS) {
    for (const sev of [3, 2, 1] as const) {
      events.push(makeEvent({ category: cat, severity: sev, lat: ROW_LAT[cat], lon: COL_LON[sev] }))
    }
  }
  await setDebugEvents(page, events)
  await waitNextFrame(page)
  await waitNextFrame(page)

  await page.screenshot({ path: 'test-results/marker-severity-tri-channel.png' })

  for (const cat of COLOR_CATS) {
    const hsl: Record<number, { h: number; s: number; l: number }> = {}
    for (const sev of [3, 2, 1] as const) {
      // 负载稳健（BUG-010）：本用例 3 分类 × 3 severity = 9 枚采样在 8-worker 高负载下累计
      // 耗时（每枚含 samplePixelBoxStable 轮询）可能越过 SPEC-7.3 的 10s 空闲阈值，一旦触发
      // 空闲自转，markerRoot 逐帧旋转会把标记转离 projectLatLon 依赖的零自转落点，令
      // findColorInRegion/samplePixelBoxStable 读到背景暗像素（即第三轮观察到的通道值 12 对
      // 参考 179 的高并发像素错读）。每枚采样前用不产生位移的点击重置空闲计时（SPEC-7.3
      // markInput）并重钉零自转，保住「默认视角 + 零自转」的投影前提（SPEC-3.1）；不改任何
      // 断言期望值（仍对 SPEC-3.7 参考表逐通道 ±ε）。发光测试（第二个 it）早已同法处理。
      await resetIdleTimer(page)
      await setEarthRotationY(page, 0)
      const { x, y } = projectLatLon(ROW_LAT[cat], COL_LON[sev], width, height)
      const region = {
        x: Math.max(0, Math.round(x - HALF)),
        y: Math.max(0, Math.round(y - HALF)),
        width: Math.min(width, HALF * 2),
        height: Math.min(height, HALF * 2),
      }
      const target = hexToRgb(SEVERITY_HEX[cat][sev])
      // 路径 (b)：渲染标记像素对参考 hex 逐通道 ±ε（各通道独立比对 ≤ε）。用 findColorInRegionStable
      // 重试等渲染追上（BUG-010）：命中/计数下限仍按 SPEC-3.7 判定，真读不到则重试耗尽照常失败。
      const hit = await findColorInRegionStable(page, region, target, EPS, MIN_MATCH_PIXELS)
      expect(
        hit,
        `${cat} sev${sev}：标记位置附近未找到匹配 SPEC-3.7 参考 #${SEVERITY_HEX[cat][sev]
          .toString(16)
          .padStart(6, '0')} ±${EPS} 的像素（路径 b）`,
      ).not.toBeNull()
      expect(hit!.count, `${cat} sev${sev} 命中像素数 ${hit!.count} 应 ≥ ${MIN_MATCH_PIXELS}`).toBeGreaterThanOrEqual(
        MIN_MATCH_PIXELS,
      )
      // 取命中像素的稳定实测色，供不变量 A / L·S 单调分析
      const px = await samplePixelBoxStable(page, hit!.x, hit!.y, 1)
      for (let i = 0; i < 3; i++) {
        expect(
          Math.abs(px[i] - target[i]),
          `${cat} sev${sev} 第 ${i} 通道实测 ${px[i].toFixed(1)} 对参考 ${target[i]} 应 ≤ ±${EPS}`,
        ).toBeLessThanOrEqual(EPS)
      }
      hsl[sev] = rgbToHsl(px)
    }

    // 不变量 A：色相跨 severity 恒定（对 sev3 pin 色相 ±2°，SPEC-3.7 色相不动）
    for (const sev of [2, 1] as const) {
      expect(
        hueDiff(hsl[sev].h, hsl[3].h),
        `${cat} sev${sev} 色相 ${hsl[sev].h.toFixed(1)}° 对 sev3 ${hsl[3].h.toFixed(1)}° 应 ≤ ±${HUE_TOL_DEG}°（不变量 A）`,
      ).toBeLessThanOrEqual(HUE_TOL_DEG)
    }

    // 单调方向：L、S 双通道 sev3 > sev2 > sev1（乘子 L×0.93/0.82、S×0.82/0.60 严格递减，SPEC-3.7）
    expect(hsl[3].l, `${cat} 明度 L 应 sev3>sev2`).toBeGreaterThan(hsl[2].l)
    expect(hsl[2].l, `${cat} 明度 L 应 sev2>sev1`).toBeGreaterThan(hsl[1].l)
    expect(hsl[3].s, `${cat} 饱和 S 应 sev3>sev2`).toBeGreaterThan(hsl[2].s)
    expect(hsl[2].s, `${cat} 饱和 S 应 sev2>sev1`).toBeGreaterThan(hsl[1].s)
  }
})

// 发光测试布局：disaster 三档同屏（发光通道由 severity 驱动、与分类无关，一类足证 SPEC-3.7）。
const GLOW_LAT = 15
const GLOW_LON: Record<1 | 2 | 3, number> = { 3: -40, 2: 0, 1: 40 }

/** 在环实例集中按 lat/lon 单位方向匹配最近的一枚（环平移方向 = 标记落点方向，SPEC-6.2）。 */
function ringScaleAt(
  rings: { scale: number; tx: number; ty: number; tz: number }[],
  latDeg: number,
  lonDeg: number,
): number {
  const [dx, dy, dz] = latLonUnitDir(latDeg, lonDeg)
  let best = -Infinity
  let bestScale = NaN
  for (const r of rings) {
    const len = Math.hypot(r.tx, r.ty, r.tz) || 1
    const dot = (r.tx * dx + r.ty * dy + r.tz * dz) / len
    if (dot > best) {
      best = dot
      bestScale = r.scale
    }
  }
  return bestScale
}

test('发光三通道存在性：sev3 脉冲环随时间起伏 / sev2 静态环恒定 / sev1 无环（SPEC-3.7，截图存证）', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await goToIdleGlobe(page)
  const { width, height } = await canvasBufferSize(page)

  await setDebugEvents(
    page,
    ([3, 2, 1] as const).map((sev) => makeEvent({ category: 'disaster', severity: sev, lat: GLOW_LAT, lon: GLOW_LON[sev] })),
  )
  await waitNextFrame(page)
  await waitNextFrame(page)

  await page.screenshot({ path: 'test-results/marker-severity-glow.png' })

  // 跨 > 1 个脉冲周期（markers.ts 头注 1600ms 量级）读环缩放序列：脉冲由 tick 按累计真实
  // 毫秒推进（非单帧/墙钟锁相，负载下随真实时间前进，规避 BUG-010 家族 flake）。每次读前
  // 重置空闲计时 + 钉零自转，保「lat/lon→环」的方向匹配前提（自转不改环缩放，仅改落点方向）。
  const seriesScale: Record<1 | 2 | 3, number[]> = { 1: [], 2: [], 3: [] }
  for (let i = 0; i < 11; i++) {
    await resetIdleTimer(page)
    await page.evaluate(() => {
      const dbg = (window as unknown as { __globeDebug: { globe: { markerRoot: { rotation: { y: number } } } } })
        .__globeDebug
      dbg.globe.markerRoot.rotation.y = 0
    })
    await page.waitForTimeout(180)
    const rings = await sampleMarkerRings(page)
    expect(rings.length, '应有 3 枚环实例（disaster 三档同屏）').toBe(3)
    for (const sev of [1, 2, 3] as const) seriesScale[sev].push(ringScaleAt(rings, GLOW_LAT, GLOW_LON[sev]))
  }

  const stats = (a: number[]) => {
    const max = Math.max(...a)
    const min = Math.min(...a)
    const mean = a.reduce((s, v) => s + v, 0) / a.length
    return { max, min, mean, range: max - min, rel: mean > 1e-9 ? (max - min) / mean : 0 }
  }
  const s1 = stats(seriesScale[1])
  const s2 = stats(seriesScale[2])
  const s3 = stats(seriesScale[3])

  // sev1 无辉光：环缩放恒 0（SPEC-3.7「sev1 无辉光」；发光=最强权重杠杆，sev1 为哑色小点）
  expect(s1.max, `sev1 环缩放应恒为 0（无辉光），实测 max=${s1.max.toExponential(2)}`).toBeLessThan(1e-4)

  // sev2 静态柔光环、无脉冲：环缩放 >0 且跨全序列近恒定（相对波动 < 3%，SPEC-3.7）
  expect(s2.min, 'sev2 应有静态柔光环（环缩放 >0）').toBeGreaterThan(0)
  expect(
    s2.rel,
    `sev2 环缩放应近恒定无脉冲，实测相对波动 ${(s2.rel * 100).toFixed(1)}% 应 < 3%（min=${s2.min.toFixed(4)} max=${s2.max.toFixed(4)}）`,
  ).toBeLessThan(0.03)

  // sev3 持续脉冲环：环缩放 >0 且跨 >1 周期明显起伏（相对波动 > 15%，SPEC-3.7）
  expect(s3.min, 'sev3 应有脉冲环（环缩放 >0）').toBeGreaterThan(0)
  expect(
    s3.rel,
    `sev3 环缩放应随时间脉冲起伏，实测相对波动 ${(s3.rel * 100).toFixed(1)}% 应 > 15%（min=${s3.min.toFixed(4)} max=${s3.max.toFixed(4)}）`,
  ).toBeGreaterThan(0.15)

  // 像素级旁证 + 视觉存证：sev3 标记连续多帧截图，持续脉冲则至少两帧不同（同 M2-10 手法）
  const { x: sx, y: sy } = projectLatLon(GLOW_LAT, GLOW_LON[3], width, height)
  const box = await page.locator('#globe-container canvas').boundingBox()
  if (!box) throw new Error('canvas 未找到或不可见')
  const scaleX = box.width / width
  const scaleY = box.height / height
  const cropHalfCss = 90 * scaleX
  const clip = {
    x: Math.max(0, box.x + sx * scaleX - cropHalfCss),
    y: Math.max(0, box.y + sy * scaleY - cropHalfCss * (scaleY / scaleX)),
    width: cropHalfCss * 2,
    height: cropHalfCss * 2 * (scaleY / scaleX),
  }
  const frames: Buffer[] = []
  for (let i = 0; i < 4; i++) {
    frames.push(await page.screenshot({ clip }))
    await resetIdleTimer(page)
    await page.waitForTimeout(400)
  }
  const distinct = new Set(frames.map((f) => f.toString('base64'))).size
  expect(distinct, 'sev3 持续脉冲：4 帧截图应至少两帧不同').toBeGreaterThan(1)
})
