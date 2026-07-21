import { expect, test } from '@playwright/test'
import type { GeoEvent } from '../src/data'
import {
  boundingBoxOfDeviation,
  canvasBufferSize,
  countNearWhite,
  findColorInRegion,
  sampleCamera,
  samplePixelBoxStable,
  setDebugEvents,
  waitForGlobeDebug,
  waitForSurfaceReady,
  waitNextFrame,
} from './globeDebug'

// BUG-022 复验（e2e，需附截图）：脉冲环密集重叠不得饱和成白，重叠结果须恒可归属 SPEC-3.7
// 分类色。
//
// 判据出处（全部只从 doc/spec.md 推导，不采信实现的实际渲染行为作期望值）：
//   - SPEC-3.7 事件标记分类色表：disaster `#ff4d4f`、news `#40a9ff`。A 点同分类簇用 disaster
//     并精确匹配其色值；B 点跨分类对照混入 news 作另一分量，只断言"不趋白"、不单独匹配其色值。
//     该表是标记的**唯一色语义**——不在表内的颜色（尤其纯白/近白 255,255,255）不构成任何
//     分类，重叠区若出现近白即引入了表外的第三种色语义，违背"分类色为唯一色语义"契约。
//   - SPEC-3.7 六分类色的通道构成决定了"重叠恒可归属分类色"的可判定性：六色的 min 通道
//     均 ≤ 127（disaster 77 / conflict 69 / humanitarian 61 / news 64 / launch 127 /
//     flight 92）；两色（如 disaster×news）在球面上的普通透明混合，其结果落在两色与深色
//     背景构成的凸包内——红色缺蓝绿、蓝色缺红，凸组合无法令 R、G、B 三通道同时逼近 255。
//     因此"区域内 min(R,G,B) 逼近 255"只可能由加色混合的无上界累加（越出分类色域趋白）
//     产生，是本缺陷的判别特征。据此取近白阈值 NEAR_WHITE_MIN=190：明显高于上述任何合法
//     混合能达到的 min 通道（≤ ~135），又明显低于纯白的 255，两端各留 ≥55 余量。
//
// 事件注入（任务卡要求，与 e2e/marker-category-severity.spec.ts 同法）：经
// window.__globeDebug 调 GlobeScene.setEvents（公开方法）以构造数据确定性注入，不依赖真实
// 网络轮询（见 e2e/globeDebug.ts 的 setDebugEvents 头注）。
//
// 定位投影几何（仅用于算"去哪采样"，不构成断言期望值本身）：SPEC-3.1 默认相机位于
// (0,0,3.2)、看向球心、上方向 +Y、fov=45°（垂直）；SPEC-6.2 约定
// lat/lon → (cos(lat)sin(lon), sin(lat), cos(lat)cos(lon))。用标准透视投影把已知 lat/lon
// 反推屏幕像素，从而知道去画布哪个区域找标记，不读 markers.ts 内部实现。
const DEG = Math.PI / 180
const HALF_FOV_Y = 22.5 * DEG // SPEC-3.1 fov 45°

function projectLatLon(latDeg: number, lonDeg: number, width: number, height: number) {
  const lat = latDeg * DEG
  const lon = lonDeg * DEG
  const px = Math.cos(lat) * Math.sin(lon)
  const py = Math.sin(lat)
  const pz = Math.cos(lat) * Math.cos(lon)
  const camZ = pz - 3.2 // 相机位置 (0,0,3.2)，SPEC-3.1
  const negCamZ = -camZ
  const aspect = width / height
  const ndcX = px / (negCamZ * Math.tan(HALF_FOV_Y) * aspect)
  const ndcY = py / (negCamZ * Math.tan(HALF_FOV_Y))
  return { x: ((ndcX + 1) / 2) * width, y: ((1 - ndcY) / 2) * height }
}

function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff]
}

// SPEC-3.7 disaster 分类色（逐字照抄条目正文）；A 点同分类簇按此精确匹配。
// news(#40a9ff) 仅作为 B 点跨分类混合的另一分量参与（下方 clusterB 用 category:'news'
// 驱动，标记层自行取 SPEC-3.7 色，本文件不单独断言其色值），故此处不另立常量。
const DISASTER = 0xff4d4f

// 近白判别阈值：推导见文件头注（六分类色 min 通道 ≤127，两色普通混合 min 通道 ≤ ~135，
// 纯白 255；190 落在两者之间且各留 ≥55 余量）。区域内 min(R,G,B) ≥ 此值的像素视为"近白"。
const NEAR_WHITE_MIN = 190

let seq = 0
function makeEvent(
  overrides: Pick<GeoEvent, 'category' | 'severity' | 'lat' | 'lon'>,
): GeoEvent {
  seq += 1
  return {
    id: `bug022:${seq}`,
    title: 'synthetic',
    summary: '',
    urls: [],
    ts: Date.now(),
    source: 'usgs',
    ...overrides,
  }
}

// 网络拦截手法与理由同 e2e/marker-category-severity.spec.ts 的 goToIdleGlobe 头注：拦截
// 全部跨源请求（放行本机 dev server），使真实数据层轮询不产生 onResult 回调，避免真实
// （或为空的）网络数据在注入后覆盖本文件构造的事件。
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
  // 前置自检（非 SPEC 判据）：确认仍是 SPEC-3.1 默认视角，否则投影换算失效
  const cam = await sampleCamera(page)
  expect(cam.x).toBeCloseTo(0, 3)
  expect(cam.y).toBeCloseTo(0, 3)
  expect(cam.z).toBeCloseTo(3.2, 3)
  expect(cam.earthRotY).toBeCloseTo(0, 3)
}

// 模拟一次不产生位移的点击（画布左下角空区，明显偏离本文件全部标记投影坐标），令
// SPEC-7.3 空闲自转的输入打断逻辑重置计时——防止累计真实等待触发自转、使固定 lat/lon →
// 固定像素的投影前提失效（同 e2e/marker-category-severity.spec.ts 的 resetIdleTimer）。
async function resetIdleTimer(page: import('@playwright/test').Page) {
  await page.mouse.click(80, 650)
}

// 两个重叠点均置于可见半球中部、远离球缘（避开 SPEC-3.4 大气辉光与画布外星点，防止近白
// 误判来自星点而非标记）：
//   - A 点（同分类密集重叠）：lat -15, lon -10——沿用 marker-category-severity.spec.ts 实测
//     确认净空的采样点。
//   - B 点（跨分类重叠对照）：lat 15, lon 15——位于经/纬网格线（每 30°，SPEC-3.2a）之间
//     的格心，与 A 点相距远大于采样窗口，两区域不重叠。
const SPOT_A = { lat: -15, lon: -10 }
const SPOT_B = { lat: 15, lon: 15 }

// 密集重叠事件数：任务卡要求 ≥8 同点位，取 12 留足余量（加色缺陷下 8 环即足以令三通道
// 饱和至 255，12 环更彻底）。severity 取 3 以最大化脉冲环尺寸、放大重叠足迹（severity 不
// 影响混合模式，只影响环大小，属放大观测目标的测试自由度，非 SPEC 期望值）。
const N_OVERLAP = 12

test('同分类密集重叠（≥8 同点位）重叠区收敛分类色、无白饱和 + 跨分类重叠不产生白饱和（BUG-022 / SPEC-3.7，截图存证）', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await goToIdleGlobe(page)
  const { width, height } = await canvasBufferSize(page)

  const a = projectLatLon(SPOT_A.lat, SPOT_A.lon, width, height)
  const b = projectLatLon(SPOT_B.lat, SPOT_B.lon, width, height)

  // B 点背景参照色：注入前在空场景实测一次（用于确认对照簇确已渲染，而非空区域令无白断言
  // 平凡成立；不作为分类色期望值来源——见 boundingBoxOfDeviation 头注）
  const bgB = await samplePixelBoxStable(page, b.x, b.y, 3)

  // A：12 个 disaster 同点位（exactly co-located）；B：12 个 disaster/news 交替同点位
  const clusterA = Array.from({ length: N_OVERLAP }, () =>
    makeEvent({ category: 'disaster', severity: 3, ...SPOT_A }),
  )
  const clusterB = Array.from({ length: N_OVERLAP }, (_, i) =>
    makeEvent({ category: i % 2 === 0 ? 'disaster' : 'news', severity: 3, ...SPOT_B }),
  )
  await setDebugEvents(page, [...clusterA, ...clusterB])
  await waitNextFrame(page)
  await waitNextFrame(page)
  await resetIdleTimer(page)

  // 视觉存证（BUG-008 视觉场景截图要求）：整屏截图应见两个重叠簇均为其分类色团、无白斑
  await page.screenshot({ path: 'test-results/marker-overlap-blending.png' })

  // 采样窗口半径（设备像素）：远大于 severity 3 脉冲环全相位足迹（外径峰值约 40px），
  // 完整覆盖叠环区；近白误判不会来自合法元素（网格/海岸线/夜辉光 min 通道均 ≤127 < 190），
  // 故窗口略大无害。
  const HALF = 90

  const regionA = {
    x: Math.max(0, Math.round(a.x - HALF)),
    y: Math.max(0, Math.round(a.y - HALF)),
    width: Math.min(width, HALF * 2),
    height: Math.min(height, HALF * 2),
  }
  const regionB = {
    x: Math.max(0, Math.round(b.x - HALF)),
    y: Math.max(0, Math.round(b.y - HALF)),
    width: Math.min(width, HALF * 2),
    height: Math.min(height, HALF * 2),
  }

  // ---- A 点：同分类密集重叠 ----
  // ① 重叠中心像素不为白/近白（SPEC-3.7：白不属分类色表）
  const centerA = await samplePixelBoxStable(page, a.x, a.y, 5)
  expect(
    Math.min(...centerA),
    `A 点重叠中心像素 min(R,G,B) 已逼近白（应远低于 ${NEAR_WHITE_MIN}）：${centerA.map(Math.round)}`,
  ).toBeLessThan(NEAR_WHITE_MIN)

  // ② 中心色相可归属 disaster 分类色（SPEC-3.7 disaster=#ff4d4f）：中心小窗内存在成规模的
  //    与 disaster 色逐通道相近的像素（容差 30，明显小于六分类色两两间的通道差 ≥60）
  const centerRegionA = {
    x: Math.max(0, Math.round(a.x - 30)),
    y: Math.max(0, Math.round(a.y - 30)),
    width: 60,
    height: 60,
  }
  const disasterHit = await findColorInRegion(page, centerRegionA, hexToRgb(DISASTER), 30)
  expect(disasterHit, 'A 点重叠中心未找到可归属 disaster(#ff4d4f) 的像素').not.toBeNull()
  expect(disasterHit!.count, 'A 点 disaster 色像素规模过小，重叠中心未收敛为分类色').toBeGreaterThanOrEqual(40)

  // ③ 叠环区无成片近白（本条即缺陷判别：加色混合下 12 环相叠三通道饱和至 255）
  const whiteA = await countNearWhite(page, regionA, NEAR_WHITE_MIN)
  expect(
    whiteA.count,
    `A 点叠环区出现 ${whiteA.count} 个近白像素（peak min 通道=${whiteA.peak}）——脉冲环叠色饱和成白，BUG-022 复现`,
  ).toBeLessThan(10)

  // ---- B 点：跨分类重叠对照 ----
  // ① 确认对照簇确已渲染（足迹明显偏离背景），使下面的无白断言非平凡
  const footprintB = await boundingBoxOfDeviation(page, regionB, bgB, 40)
  expect(footprintB, 'B 点跨分类重叠簇未渲染（无偏离背景的像素）').not.toBeNull()
  expect(footprintB!.count, 'B 点重叠足迹过小，簇可能未成功注入').toBeGreaterThanOrEqual(100)

  // ② 跨分类重叠不出现白饱和（SPEC-3.7：disaster×news 普通混合得两色间中间色，不趋白）
  const whiteB = await countNearWhite(page, regionB, NEAR_WHITE_MIN)
  expect(
    whiteB.count,
    `B 点跨分类重叠区出现 ${whiteB.count} 个近白像素（peak min 通道=${whiteB.peak}）——跨分类加色饱和成白，BUG-022 复现`,
  ).toBeLessThan(10)
})
