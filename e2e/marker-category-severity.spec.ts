import { expect, test } from '@playwright/test'
import type { GeoEvent } from '../src/data'
import {
  boundingBoxOfDeviation,
  canvasBufferSize,
  findColorInRegion,
  sampleCamera,
  samplePixelBoxStable,
  setDebugEvents,
  waitForGlobeDebug,
  waitForSurfaceReady,
  waitNextFrame,
} from './globeDebug'

// M2-10：事件标记分类色表 + severity 分级视觉判据（e2e，需附截图）。
// 判据出处（全部只从 doc/spec.md 推导，注释逐条标注 SPEC 条目；单测部分见
// tests/markers.test.ts）：
//   - SPEC-3.7 六分类色表：disaster #ff4d4f、conflict #ff7a45、humanitarian #ffc53d、
//     news #40a9ff、launch #b37feb、flight #5cdbd3。
//   - SPEC-3.7「severity ∈ {1,2,3}：标记基础尺寸与脉冲光环幅度随级别递增；
//     severity 3 必须有持续脉冲环」。
//
// 事件注入（任务卡要求）：经 window.__globeDebug 调用 GlobeScene.setEvents（公开方法）
// 用构造数据确定性驱动，不依赖真实网络轮询（见 e2e/globeDebug.ts 的 setDebugEvents 头注）。
//
// 定位标记的投影几何（仅用于计算「去哪采样」，不构成断言期望值本身）：
// SPEC-3.1 默认相机位于 (0,0,3.2)、看向球心、上方向 +Y、fov=45°（垂直）；
// SPEC-6.2 约定 lat/lon → 模型空间 (cos(lat)sin(lon), sin(lat), cos(lat)cos(lon))。
// 用标准透视投影公式把已知 lat/lon（球半径取 SPEC-3.1 的 1.0，标记实际落点半径 1.02
// 只比 1.0 高 2%，对投影像素位置的影响在下面留出的采样窗口容差内可忽略）反推屏幕像素
// 坐标，从而知道去画布哪个区域找标记，不依赖读取 markers.ts 内部实现。
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

let seq = 0
function makeEvent(
  overrides: Pick<GeoEvent, 'category' | 'severity' | 'lat' | 'lon'>,
): GeoEvent {
  seq += 1
  return {
    id: `m2-10:${seq}`,
    title: 'synthetic',
    summary: '',
    urls: [],
    ts: Date.now(),
    source: 'usgs',
    ...overrides,
  }
}

// 根因排查记录：App.tsx 挂载时会启动真实数据层轮询（dataLayer.start()），其
// store.subscribe 回调会用真实网络拉取结果调用 GlobeScene.setEvents，与本文件经调试
// 钩子注入的构造事件共用同一个公开方法——若不加干预，真实轮询会在注入后的几百毫秒内
// 用真实（甚至为空）数据覆盖测试构造的事件（已用独立诊断脚本实测复现：标记在约 700ms~
// 1s 后从画布上彻底消失）。这正是任务卡与 dev 交付汇报警示的"e2e 联网非确定性"。
// 修复（只改 e2e/，不改 src/）：拦截所有跨源请求（本机 dev server 自身的 5173/HMR 请求
// 放行），使数据层的 scheduler 轮询全部失败、不产生 onResult 回调（src/data/scheduler.ts
// 「仅 ok 且非空时回调」），store 也不会被真实数据二次覆盖；Playwright 每个 test 使用
// 独立浏览器 context，IndexedDB 缓存为空，cache.load() 早期异步回填同样因空数组被
// 「cached.length > 0」判定跳过，不构成二次覆盖来源。
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
  // 前置自检（非 SPEC 判据）：确认仍是 SPEC-3.1 默认视角——本文件的 projectLatLon
  // 换算假设相机位于 (0,0,3.2)、地球零自转，若前置态偏离，后续采样坐标全部失效
  const cam = await sampleCamera(page)
  expect(cam.x).toBeCloseTo(0, 3)
  expect(cam.y).toBeCloseTo(0, 3)
  expect(cam.z).toBeCloseTo(3.2, 3)
  expect(cam.earthRotY).toBeCloseTo(0, 3)
}

// 根因排查记录（与 e2e/day-night-calibration.spec.ts 头注同一问题）：本文件的
// severity 量测测试含数十次真实时间等待（三档 × 7 采样 + 4 帧持续脉冲截图），累计
// 真实耗时会逼近/超过 SPEC-7.3 的 10s 空闲自转阈值——一旦触发，markerRoot.rotation.y
// 会被空闲自转逐帧改写，使固定 lat/lon → 固定屏幕像素的投影前提失效（已实测复现：
// 某一档 severity 的全部/尾部采样宽度归零，即标记已被转出预计算的采样窗口）。
// 用同一手法修复：模拟一次不产生位移的点击（down+up 落在同一坐标）令 SPEC-7.3 的
// 输入打断逻辑（markInput()）重置空闲计时。点击点选在画布左下角，明显偏离本文件
// 用到的全部标记投影坐标（均落在画布中心偏右上/偏右下区域），避免误触发 hover 拾取
// （SPEC-7.4）联动高亮而干扰像素量测。
const IDLE_RESET_X = 80
const IDLE_RESET_Y = 650

async function resetIdleTimer(page: import('@playwright/test').Page) {
  await page.mouse.click(IDLE_RESET_X, IDLE_RESET_Y)
}

// SPEC-3.7 六分类色表，逐字照抄条目正文
const SPEC_3_7_COLORS: [GeoEvent['category'], number][] = [
  ['disaster', 0xff4d4f],
  ['conflict', 0xff7a45],
  ['humanitarian', 0xffc53d],
  ['news', 0x40a9ff],
  ['launch', 0xb37feb],
  ['flight', 0x5cdbd3],
]

// 六个标记分两行布局（纬度 ±25°、经度 -30/0/30），行内列间距与行间距都远大于下方
// 采样窗口半径（65px），互不重叠；同时避开画布正中心（lat0/lon0，SPEC-3.6 校准点，
// 恰落在赤道经纬网格线与西非海岸线附近，颜色采样易与网格/海岸线蓝色混淆）。
const COLOR_LAYOUT: { lat: number; lon: number }[] = [
  { lat: 25, lon: -30 },
  { lat: 25, lon: 0 },
  { lat: 25, lon: 30 },
  { lat: -25, lon: -30 },
  { lat: -25, lon: 0 },
  { lat: -25, lon: 30 },
]

test('六分类标记颜色精确匹配 SPEC-3.7 色表（截图存证）', async ({ page }) => {
  test.setTimeout(60_000)
  await goToIdleGlobe(page)

  const events = SPEC_3_7_COLORS.map(([category], i) =>
    makeEvent({ category, severity: 3, lat: COLOR_LAYOUT[i].lat, lon: COLOR_LAYOUT[i].lon }),
  )
  await setDebugEvents(page, events)
  await waitNextFrame(page)
  await waitNextFrame(page)

  const { width, height } = await canvasBufferSize(page)

  await page.screenshot({ path: 'test-results/marker-category-colors.png' })

  const HALF = 65 // 采样窗口半径（px，设备像素）；severity 3 标记直径远小于此，窗口留足定位容差
  for (let i = 0; i < SPEC_3_7_COLORS.length; i++) {
    const [category, hex] = SPEC_3_7_COLORS[i]
    const { lat, lon } = COLOR_LAYOUT[i]
    const { x, y } = projectLatLon(lat, lon, width, height)
    const region = {
      x: Math.max(0, Math.round(x - HALF)),
      y: Math.max(0, Math.round(y - HALF)),
      width: Math.min(width, HALF * 2),
      height: Math.min(height, HALF * 2),
    }
    const target = hexToRgb(hex)
    // 容差 20：既能吸收 sRGB 往返编解码的量化误差，又明显小于 SPEC-3.7 六色两两间的
    // 通道差距（六色彼此在至少一个通道上相差 ≥60），不会与相邻分类色混淆
    const hit = await findColorInRegion(page, region, target, 20)
    expect(hit, `category=${category} 在其标记位置附近未找到匹配色`).not.toBeNull()
    // 命中像素数须达到一定规模（severity 3 标记实心圆直径约 18px，面积约 260px²），
    // 排除"偶然一两个噪声像素落入容差"的误判（如附近网格线/海岸线的偶然邻近色）
    expect(hit!.count).toBeGreaterThanOrEqual(40)
  }
})

// 自动量测用固定采样点（lat -15, lon -10）：实测与最近经纬网格线（每 30° 一条，
// SPEC-3.2a）的投影像素距离 ≥60px（水平）/≥85px（垂直），明显大于下方采样窗口半径
// （HALF=50），避免网格线像素混入 footprint 量测、干扰 severity 之间的尺寸对比。
// 三档 severity 在此**同一坐标**逐一放置（非同时并排），确保三次量测的背景/网格干扰
// 完全一致，量测差异只来自标记本身。
const MEASURE_SPOT = { lat: -15, lon: -10 }

// 三档并排视觉对比布局（仅用于人工截图判读，不参与自动断言，故不要求网格线净空）：
// 同一分类（news）、同一纬线、不同经度顺次排列。
const VISUAL_LAYOUT: { lat: number; lon: number; severity: 1 | 2 | 3 }[] = [
  { lat: -25, lon: -40, severity: 1 },
  { lat: -25, lon: 0, severity: 2 },
  { lat: -25, lon: 40, severity: 3 },
]

test('severity 1/2/3 标记尺寸与脉冲光环幅度依级递增，severity 3 呈持续脉冲环（SPEC-3.7，截图存证）', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await goToIdleGlobe(page)
  const { width, height } = await canvasBufferSize(page)

  // ---- 判据①②：基础尺寸 + 脉冲幅度随 severity 递增（自动量测，单标记逐一放置）----
  // 背景参照色：清空事件后在固定采样点实测一次（避免用 spec 推导值假设背景色——矢量
  // 默认风格背景色随昼夜混合变化，实测更可靠；三档 severity 复用同一参照，见上方
  // MEASURE_SPOT 头注）
  await setDebugEvents(page, [])
  await waitNextFrame(page)
  await waitNextFrame(page)

  const HALF = 50 // 采样窗口半径：MEASURE_SPOT 处最近网格线净空 ≥60px，留有余量
  const DELTA_THRESHOLD = 40 // 明显偏离背景视为"标记/光环覆盖"，见 boundingBoxOfDeviation 头注

  const { x: mx, y: my } = projectLatLon(MEASURE_SPOT.lat, MEASURE_SPOT.lon, width, height)
  const measureRegion = {
    x: Math.max(0, Math.round(mx - HALF)),
    y: Math.max(0, Math.round(my - HALF)),
    width: Math.min(width, HALF * 2),
    height: Math.min(height, HALF * 2),
  }
  const background = await samplePixelBoxStable(page, mx, my, 3)

  async function measureFootprintSeries(severity: 1 | 2 | 3): Promise<number[]> {
    await setDebugEvents(page, [makeEvent({ category: 'news', severity, ...MEASURE_SPOT })])
    await waitNextFrame(page)
    await waitNextFrame(page)

    // 覆盖一个完整脉冲周期（PULSE_PERIOD_MS 属实现细节，不在此处引用；1600ms 量级见
    // markers.ts 头注，取 7 个采样点跨约 1.6s，无论起始相位如何都能覆盖到峰值与谷值附近）
    const widths: number[] = []
    for (let i = 0; i < 7; i++) {
      await resetIdleTimer(page) // 见上方头注：防止累计真实等待触发 SPEC-7.3 空闲自转
      await page.waitForTimeout(230)
      const bbox = await boundingBoxOfDeviation(page, measureRegion, background, DELTA_THRESHOLD)
      widths.push(bbox ? bbox.maxX - bbox.minX : 0)
    }
    await setDebugEvents(page, [])
    await waitNextFrame(page)
    return widths
  }

  const widthsBySeverity: Record<1 | 2 | 3, number[]> = {
    1: await measureFootprintSeries(1),
    2: await measureFootprintSeries(2),
    3: await measureFootprintSeries(3),
  }

  const maxW = { 1: Math.max(...widthsBySeverity[1]), 2: Math.max(...widthsBySeverity[2]), 3: Math.max(...widthsBySeverity[3]) }
  const minW = { 1: Math.min(...widthsBySeverity[1]), 2: Math.min(...widthsBySeverity[2]), 3: Math.min(...widthsBySeverity[3]) }

  // ①「标记基础尺寸……随级别递增」：脉冲谷值时刻的最小 footprint 最贴近"基础尺寸"
  // （脉冲幅度最弱时），三档应严格递增（SPEC-3.7）
  expect(minW[1]).toBeLessThan(minW[2])
  expect(minW[2]).toBeLessThan(minW[3])

  // ②「脉冲光环幅度……随级别递增」：以周期内最大 footprint（脉冲峰值）代理光环幅度，
  // 三档同样应严格递增（SPEC-3.7）
  expect(maxW[1]).toBeLessThan(maxW[2])
  expect(maxW[2]).toBeLessThan(maxW[3])

  // ---- 判据③：severity 3 必须有持续脉冲环（连续多帧截图对比光环状态变化）----
  await setDebugEvents(page, [makeEvent({ category: 'news', severity: 3, ...MEASURE_SPOT })])
  await waitNextFrame(page)
  await waitNextFrame(page)

  const { x: sx, y: sy } = projectLatLon(MEASURE_SPOT.lat, MEASURE_SPOT.lon, width, height)
  const box = await page.locator('#globe-container canvas').boundingBox()
  if (!box) throw new Error('canvas 未找到或不可见')
  // page.screenshot 的 clip 用 CSS 像素，需按 canvas 的 CSS 尺寸与设备像素尺寸的比例换算
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
    await resetIdleTimer(page) // 见上方头注：防止累计真实等待触发 SPEC-7.3 空闲自转
    await page.waitForTimeout(400) // 约 1/4 脉冲周期量级间隔，见 markers.ts 头注 1600ms
  }

  // 持续脉冲：4 帧截图中至少存在两帧不同（若光环是静态图形，4 帧应逐字节相同）
  const distinct = new Set(frames.map((f) => f.toString('base64'))).size
  expect(distinct).toBeGreaterThan(1)

  // 留存首末两帧供人工对照光环状态变化（BUG-008 视觉场景截图存证要求；
  // testplan M2-10「连续两帧截图对比光环状态变化」）
  const { writeFileSync } = await import('node:fs')
  writeFileSync('test-results/marker-severity-pulse-frame1.png', frames[0])
  writeFileSync('test-results/marker-severity-pulse-frame2.png', frames[frames.length - 1])

  // 三档并排整体截图（人工视觉对比尺寸递增，SPEC-3.7）
  await setDebugEvents(
    page,
    VISUAL_LAYOUT.map(({ lat, lon, severity }) => makeEvent({ category: 'news', severity, lat, lon })),
  )
  await waitNextFrame(page)
  await waitNextFrame(page)
  await page.screenshot({ path: 'test-results/marker-severity-sizes.png' })
})
