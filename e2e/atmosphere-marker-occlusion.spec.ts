import { expect, test } from '@playwright/test'
import type { GeoEvent } from '../src/data'
import {
  canvasBufferSize,
  findColorInRegion,
  sampleCamera,
  samplePixelBox,
  samplePixelBoxStable,
  setDebugEvents,
  setSunDirVector,
  waitForGlobeDebug,
  waitForSurfaceReady,
  waitNextFrame,
} from './globeDebug'

// M2-12：大气不遮挡真实标记 + 辉光峰值机械断言（e2e，真实 WebGL 渲染，禁材质代理）。
// 回补 REV-004 R-1（SPEC-3.4「不遮挡标记」须用真实标记像素断言，不得再用材质属性代理）与
// R-6（M1-07 的辉光峰值判据此前靠人工判读闭合，须机械钉在球缘），出处 REV-005 §1.1 K-2。
//
// 判据出处（全部只从 doc/spec.md 推导，逐条标注 SPEC 条目号）：
//   - SPEC-3.4：「大气：菲涅尔边缘辉光，主色 #4a90d9，从球缘向外衰减；不遮挡标记。」
//
// 两个 test 共用的几何推导：
// SPEC-3.1 默认相机位于 (0,0,3.2)、看向球心、上方向 +Y、fov=45°（垂直半角 22.5°）；球半径 1.0。
// 相机 C=(0,0,d) 到半径 R 球面的视线切点 P 满足「切点处法线 ⊥ 视线方向」，即
// P·(P−C)=0 ⟹（球面上 |P|=R）R²−C·P=0 ⟹ C·P=R²；本文件只取 P 落在 y=0（画布竖直中心）的
// 情形，C·P = d·Pz，故 Pz = R²/d —— 这正是「球缘」（地球自身轮廓，肉眼所见的地球边缘）在
// 视线方向上的精确定义，与 e2e/atmosphere-glow.spec.ts 头注「相机距球心 3.2、球半径 1：
// 视线半张角 arccos(1/3.2)≈71.8°」同一推导。本文件在此基础上进一步把该切点换算成屏幕像素坐标
// （复用 e2e/marker-category-severity.spec.ts 的 projectLatLon 同一透视投影公式），把
// REV-004 R-6 要求的「峰值钉在球缘」从「人工看着像」改成「数值上落在该计算位置附近」。
const DEG = Math.PI / 180
const HALF_FOV_Y = 22.5 * DEG // SPEC-3.1 fov 45°
const CAM_DIST = 3.2 // SPEC-3.1 初始距离
const GLOBE_R = 1.0 // SPEC-3.1 球半径

const limbTheta = Math.acos(GLOBE_R / CAM_DIST) // 球缘切点与视线轴（+Z）夹角，≈71.8°
const limbPxWorld = GLOBE_R * Math.sin(limbTheta)
const limbPzWorld = GLOBE_R * Math.cos(limbTheta)
const limbNegCamZ = CAM_DIST - limbPzWorld

/** 球缘切点在屏幕上相对画布中心的水平像素偏移量。像素/世界单位的比例只取决于纵向 fov 与画布
 * 高度、与宽高比无关（宽高比对水平视野张角与像素密度的影响相互抵消——与 projectLatLon 的
 * ndcX 公式代数等价，展开后 aspect 项相消），因此只需画布高度即可算出，不依赖画布宽度。 */
function limbOffsetPx(height: number): number {
  return (height / 2) * (limbPxWorld / (limbNegCamZ * Math.tan(HALF_FOV_Y)))
}

/** 与 e2e/marker-category-severity.spec.ts 的 projectLatLon 同一投影公式（SPEC-3.1 相机参数 +
 * SPEC-6.2 坐标约定），只用于计算"去画布哪里采样"，不构成断言期望值本身。 */
function projectLatLon(latDeg: number, lonDeg: number, width: number, height: number) {
  const lat = latDeg * DEG
  const lon = lonDeg * DEG
  const px = Math.cos(lat) * Math.sin(lon)
  const py = Math.sin(lat)
  const pz = Math.cos(lat) * Math.cos(lon)
  const negCamZ = CAM_DIST - pz
  const aspect = width / height
  const ndcX = px / (negCamZ * Math.tan(HALF_FOV_Y) * aspect)
  const ndcY = py / (negCamZ * Math.tan(HALF_FOV_Y))
  return { x: ((ndcX + 1) / 2) * width, y: ((1 - ndcY) / 2) * height }
}

function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff]
}

let seq = 0
function makeEvent(overrides: Pick<GeoEvent, 'category' | 'severity' | 'lat' | 'lon'>): GeoEvent {
  seq += 1
  return {
    id: `m2-12:${seq}`,
    title: 'synthetic',
    summary: '',
    urls: [],
    ts: Date.now(),
    source: 'usgs',
    ...overrides,
  }
}

// 与 e2e/marker-category-severity.spec.ts 同一根因排查记录：App 挂载会启动真实数据层轮询，其
// setEvents 回调会用真实（甚至为空）网络结果覆盖本文件经调试钩子注入的构造事件，故拦截跨源请求
// 防止二次覆盖（只改 e2e/，不改 src/）。
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
  // 前置自检（非 SPEC 判据）：确认仍是 SPEC-3.1 默认视角，本文件的投影换算均假设该前提
  const cam = await sampleCamera(page)
  expect(cam.x).toBeCloseTo(0, 3)
  expect(cam.y).toBeCloseTo(0, 3)
  expect(cam.z).toBeCloseTo(CAM_DIST, 3)
  expect(cam.earthRotY).toBeCloseTo(0, 3)
}

// 标记落点：lat 10°/lon 58°——与视线轴（+Z）夹角约 58.5°，明显小于 71.8° 的球缘切角（留安全
// 余量，避免掠射角导致标记自身被地球本体深度裁切一侧），但仍显著进入大气辉光带（见下方 test 2：
// 辉光信号随夹角逼近切角单调增强，58.5° 已接近切角）；lat/lon 均非 30 的整数倍，避开 SPEC-3.2a
// 经纬网格线（每 30° 一条）；lon 取正（东半球），与 test 2 沿画布左侧（西半球）做的径向扫描
// 互不重叠，两个 test 互不干扰各自的采样假设。
const MARKER_LAT = 10
const MARKER_LON = 58
// 高对比分类色：humanitarian #ffc53d（R255,G197,B61）与大气主色 #4a90d9（R74,G144,B217，
// SPEC-3.4）在三个通道上强烈相反（前者高 R 高 G 低 B，后者低 R 中 G 高 B）——若标记像素被大气
// 辉光吞没，采样点会明显偏蓝、偏离该目标色；未被吞没则应能命中该目标色（SPEC-3.7 色表定义该
// hex 值）。
const MARKER_CATEGORY: GeoEvent['category'] = 'humanitarian'
const MARKER_HEX = 0xffc53d

test('球缘大气可见带内的真实标记像素可分辨、未被大气辉光吞没（SPEC-3.4「不遮挡标记」，回补 REV-004 R-1/REV-005 K-2）', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await goToIdleGlobe(page)

  // 令可见半球全部为深夜（t 明显小于 SPEC-3.2 过渡带下界 -0.1），孤立辉光信号、不与地表底色
  // 混淆——与 e2e/atmosphere-glow.spec.ts 同一手法；矢量默认风格（应用当前默认路径）下用
  // setSunDirVector 同步 base/coast/grid 三个材质各自的 uSunDir（见 globeDebug.ts 头注），
  // 避免 coast/grid 仍受真实时刻驱动引入的不确定性。
  await setSunDirVector(page, { x: 0, y: 0, z: -1 })
  await waitNextFrame(page)
  await waitNextFrame(page)

  const { width, height } = await canvasBufferSize(page)
  const { x, y } = projectLatLon(MARKER_LAT, MARKER_LON, width, height)
  const target = hexToRgb(MARKER_HEX)
  const region = {
    x: Math.max(0, Math.round(x - 40)),
    y: Math.max(0, Math.round(y - 40)),
    width: Math.min(width, 80),
    height: Math.min(height, 80),
  }

  // ---- 对照组：无标记时，该位置不应命中标记目标色 ----
  await setDebugEvents(page, [])
  await waitNextFrame(page)
  await waitNextFrame(page)
  const bgMiss = await findColorInRegion(page, region, target, 20)
  expect(
    bgMiss,
    '对照组（无标记）不应在该位置命中标记目标色，否则说明采样点选取有误（该处底色本就偏向标记色）',
  ).toBeNull()

  const [bgR, bgG, bgB] = await samplePixelBoxStable(page, x, y, 3)
  // 该位置落在大气辉光带内（test 2 独立验证该位置几何上邻近球缘切角），无标记时应呈现蓝色主导
  // （SPEC-3.4 主色 #4a90d9 蓝通道最高），佐证该处确为「大气/背景色」而非采样点选取偏差
  expect(bgB, '对照组该处颜色应蓝通道主导（SPEC-3.4 大气主色），佐证采样点确实落在大气可见带').toBeGreaterThan(bgR)
  expect(bgB).toBeGreaterThan(bgG)

  // ---- 处理组：放置标记后，同一位置应能分辨出标记自身分类色 ----
  const events = [makeEvent({ category: MARKER_CATEGORY, severity: 3, lat: MARKER_LAT, lon: MARKER_LON })]
  await setDebugEvents(page, events)
  await waitNextFrame(page)
  await waitNextFrame(page)

  const hit = await findColorInRegion(page, region, target, 20)
  expect(
    hit,
    '放置标记后未在其位置附近找到匹配的分类色，标记像素疑似被大气辉光吞没（SPEC-3.4「不遮挡标记」）',
  ).not.toBeNull()
  expect(hit!.count).toBeGreaterThanOrEqual(15)
})

test('大气辉光强度沿球缘径向衰减，峰值机械钉在球缘切线附近（SPEC-3.4「从球缘向外衰减」，回补 REV-004 R-6）', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await page.bringToFront()
  await page.goto('/')
  await waitForGlobeDebug(page)
  await waitForSurfaceReady(page)

  const cam = await sampleCamera(page)
  expect(cam.x).toBeCloseTo(0, 3)
  expect(cam.y).toBeCloseTo(0, 3)
  expect(cam.z).toBeCloseTo(CAM_DIST, 3)
  expect(cam.earthRotY).toBeCloseTo(0, 3)

  // 深夜孤立辉光信号，理由同上（与 e2e/atmosphere-glow.spec.ts 一致）
  await setSunDirVector(page, { x: 0, y: 0, z: -1 })
  await waitNextFrame(page)
  await waitNextFrame(page)

  const { width, height } = await canvasBufferSize(page)
  const cx = width / 2
  const cy = height / 2
  const limbOffset = limbOffsetPx(height)

  // 沿画布水平中心行、从中心向左侧扫描到明显超出预测球缘偏移量的纯背景区（1.8 倍留出充分余量，
  // 既覆盖预测球缘位置本身，也覆盖大气壳外缘及其外侧衰减到背景的区间；往左避开 SPEC-2.2 右侧
  // 悬浮面板，与 e2e/atmosphere-glow.spec.ts / e2e/starfield.spec.ts 既有约定一致，尽管采样
  // 本身直接从 canvas 回读、不受 DOM 覆盖层影响）
  const N = 60
  const maxOffset = limbOffset * 1.8
  const offsetAt = (i: number) => (i / (N - 1)) * maxOffset
  const colors: [number, number, number][] = []
  for (let i = 0; i < N; i++) {
    colors.push(await samplePixelBox(page, cx - offsetAt(i), cy, 3))
  }
  const blueness = colors.map(([r, g, b]) => b - Math.max(r, g))

  // 「画面内侧」基线参照点：预测球缘偏移量的 30% 处——仍在扫描线上、明显在球体内侧（视线夹角
  // 远小于切角），但刻意不取正中心（offset=0，对应 lat0/lon0，即 SPEC-3.6 校准点几内亚湾附近，
  // 紧邻非洲西岸海岸线，SPEC-3.2a 夜面海岸线自带自发光辉光，正中心像素有小概率采到该辉光而非
  // 地表底色，混淆基线）。实测（见下方 assertion 前的探查）该基线沿整条扫描线在进入辉光带前
  // 保持恒定——这是矢量默认风格夜端地表底色本身自带的蓝色调（SPEC-3.2a 底面昼端色 #0a1a2f，
  // 蓝通道天然高于红/绿），并非大气信号，须先扣除才能看清大气辉光本身贡献的增量。
  let interiorIdx = 0
  let bestDelta = Infinity
  for (let i = 0; i < N; i++) {
    const delta = Math.abs(offsetAt(i) - limbOffset * 0.3)
    if (delta < bestDelta) {
      bestDelta = delta
      interiorIdx = i
    }
  }
  const interiorBlueness = blueness[interiorIdx]

  // 机械定位「球缘」——不预设大气壳自身半径（SPEC 未 pin 该实现细节，只 pin 了地球本体半径
  // 1.0），而是直接从渲染结果里检测「可见内容（地球本体 + 大气壳）与纯背景的分界」：背景区
  // （渲染管线在壳体几何范围外没有任何片元，逐像素落回纯背景色）与壳体范围内（地表基线或辉光）
  // 存在明显阶跃，从扫描尾部向内找「持续跌落至背景阈值以下」的最长连续段，其起点即背景开始处，
  // 前一个采样点即渲染内容的最外缘——这就是本文件对「球缘」的机械操作化定义，比预先猜一个半径
  // 更贴合"边缘"本身的视觉含义，且不依赖任何实现细节（BACKGROUND_EPS 只是像素噪声容差，不是
  // 期望值）。
  const BACKGROUND_EPS = 5
  let backgroundRunLen = 0
  for (let i = N - 1; i >= 0; i--) {
    if (blueness[i] <= BACKGROUND_EPS) backgroundRunLen++
    else break
  }
  const backgroundStartIdx = N - backgroundRunLen
  expect(backgroundStartIdx, '扫描全程未检测到"内容→背景"的分界，径向范围设置或渲染状态异常').toBeLessThan(N)
  const edgeIdx = backgroundStartIdx - 1
  const edgeOffset = offsetAt(edgeIdx)

  // 边缘检测结果本身须落在从 SPEC-3.1（球半径 1.0、相机距离 3.2、fov 45°）几何推导出的合理区间
  // 内（下界 0.9×预测的地球本体球缘偏移量——留一点软过渡容差；上界 1.8×——对应一个半径达地球
  // 1.6 倍、仍可称为"贴着球面"的宽松大气壳上限，见头注 R=1.6 换算），排除检测到的"边缘"其实是
  // 画面里无关位置（如把星空背景的噪声波动误判为边缘）的退化情形
  expect(edgeOffset).toBeGreaterThanOrEqual(limbOffset * 0.9)
  expect(edgeOffset).toBeLessThanOrEqual(limbOffset * 1.8)

  const maxBlueness = Math.max(...blueness)
  const peakIdx = blueness.indexOf(maxBlueness)
  const tailAvg = colors.slice(-5).map(([r, g, b]) => b - Math.max(r, g)).reduce((a, v) => a + v, 0) / 5

  // ①「峰值钉在球缘」（REV-004 R-6 核心回补点）：径向全扫描找到的真实强度最大值所在位置，须
  //   与上面机械检测到的球缘位置本身重合或紧邻（容差 2 个采样步，约等于 2×maxOffset/(N-1) 像素，
  //   吸收抗锯齿/软过渡造成的采样误差）——"哪里最亮"与"哪里是边缘"由两条独立算法各自算出，
  //   不再依赖人工看截图判断"看着像不像"
  expect(Math.abs(peakIdx - edgeIdx)).toBeLessThanOrEqual(2)
  // ② 峰值信号显著高于球体内侧基线，佐证强度确实在球缘附近隆起，而非整条扫描线信号趋同
  //   （否则"哪里最亮"这一比较会失去区分力）
  expect(maxBlueness - interiorBlueness).toBeGreaterThan(15)
  // ③ 由球缘向外衰减：尾部（远超检测到的球缘位置的纯背景区）显著低于峰值（SPEC-3.4「向外衰减」）
  expect(tailAvg).toBeLessThan(maxBlueness * 0.3)

  // 峰值处主色偏蓝：蓝通道明显高于红/绿（SPEC-3.4 主色 #4a90d9 = R74,G144,B217）
  const [pr, pg, pb] = colors[peakIdx]
  expect(pb).toBeGreaterThan(pr)
  expect(pb).toBeGreaterThan(pg * 0.9)
})
