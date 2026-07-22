import { expect, test, type Page } from '@playwright/test'
import { bootWithGdacsEvents, type GdacsFixtureInput } from './eventPanelFixture'
import {
  canvasBufferSize,
  findColorInRegion,
  sampleCamera,
  sampleMarkerCount,
  waitForGlobeDebug,
  waitForSurfaceReady,
  waitNextFrame,
} from './globeDebug'

// M2-14：列表↔标记高亮双向联动（e2e）。判据出处（全部只从 doc/spec.md 推导，注释逐条标注
// SPEC 条目）：
//   - SPEC-7.4「列表 hover/选中与球面标记高亮双向联动」，M2 范围取全双向
//     （REV-010 §2.4 裁准，见 doc/review/REV-010-M2-globe-gate.md，doc/spec.md 修改记录 v0.2.4）。
//   点击触发的相机飞行与详情卡弹出不属本场景（已拆挂 M3 FM-14）。
//
// 事件注入手法同 M2-13（e2e/event-panel.spec.ts）：走真实 dataLayer 链路（GDACS 信源 mock），
// 不用绕过 React state 的 setDebugEvents，因面板与标记层都要真实联动。

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

const DISASTER_RGB = hexToRgb(0xff4d4f) // SPEC-3.7

async function assertDefaultCameraPose(page: Page) {
  // 前置自检（非 SPEC 判据）：projectLatLon 与 page.mouse 换算假设相机位于 (0,0,3.2)、
  // 地球零自转（SPEC-3.1），若前置态偏离，后续投影坐标全部失效
  const cam = await sampleCamera(page)
  expect(cam.x).toBeCloseTo(0, 3)
  expect(cam.y).toBeCloseTo(0, 3)
  expect(cam.z).toBeCloseTo(3.2, 3)
  expect(cam.earthRotY).toBeCloseTo(0, 3)
}

// 见 e2e/marker-category-severity.spec.ts 头注同一手法：模拟一次不产生位移的点击，落在
// 明显偏离本文件全部标记投影坐标的画布左下角，重置 SPEC-7.3 空闲计时，避免累计真实等待
// 触发空闲自转、使固定 lat/lon → 固定屏幕坐标的前提失效。
const IDLE_RESET_X = 80
const IDLE_RESET_Y = 650

async function resetIdleTimer(page: Page) {
  await page.mouse.click(IDLE_RESET_X, IDLE_RESET_Y)
}

/** 设备像素坐标 → 页面（CSS）坐标：page.mouse 系列 API 用 CSS 像素，而标记的世界坐标投影
 * 与像素采样（findColorInRegion）用的是 canvas 的设备像素缓冲坐标系，两者需按 canvas 的
 * CSS 尺寸与设备像素尺寸的比例换算（与 e2e/marker-category-severity.spec.ts 截图 clip 换算同一手法）。 */
function toPagePoint(
  box: { x: number; y: number; width: number; height: number },
  bufferW: number,
  bufferH: number,
  devicePt: { x: number; y: number },
) {
  return {
    x: box.x + (devicePt.x / bufferW) * box.width,
    y: box.y + (devicePt.y / bufferH) * box.height,
  }
}

test('list→marker：面板选中列表行使对应标记高亮态放大（SPEC-7.4）', async ({ page }) => {
  test.setTimeout(60_000)
  const SPOT = { lat: -15, lon: -10 } // 与 marker-category-severity.spec.ts 同一验证过的净空坐标
  await bootWithGdacsEvents(page, [
    {
      eventid: 'm2-14-list-to-marker',
      name: 'List To Marker Event',
      alertlevel: 'Orange', // severity 2
      lat: SPOT.lat,
      lon: SPOT.lon,
      datemodifiedMs: Date.now(),
    },
  ])
  await waitForGlobeDebug(page)
  await waitForSurfaceReady(page)
  await assertDefaultCameraPose(page)

  const { width, height } = await canvasBufferSize(page)
  const { x, y } = projectLatLon(SPOT.lat, SPOT.lon, width, height)
  const HALF = 50
  const region = {
    x: Math.max(0, Math.round(x - HALF)),
    y: Math.max(0, Math.round(y - HALF)),
    width: Math.min(width, HALF * 2),
    height: Math.min(height, HALF * 2),
  }

  async function measureDotPixelCount(): Promise<number> {
    const hit = await findColorInRegion(page, region, DISASTER_RGB, 20)
    return hit?.count ?? 0
  }

  // 基线：未联动前的标记像素面积（分类实色，容差窄）。光柱标记切片①无独立环/脉冲层
  // （DP M3-marker-pillar §3.2：rings InstancedMesh 已删；SPEC-3.7 常驻态无脉冲），
  // 像素采样不受环带/脉冲相位干扰。
  // 标记经真实 dataLayer 链路（GDACS mock→store→GlobeScene.setEvents→渲染）**异步**上屏，
  // waitForSurfaceReady 只保底面材质就绪、不保标记已渲染；8-worker 高负载下该链路可能滞后于
  // 像素采样、令基线读到 0（BUG-010 负载稳健化）。此处轮询到 dot 像素可见为止（等渲染追上），
  // 不改判据——仍要求联动前后像素面积的因果关系（SPEC-7.4）；真渲染不出则轮询耗尽照常失败。
  let baselineMax = 0
  for (let i = 0; i < 25 && baselineMax === 0; i++) {
    baselineMax = Math.max(await measureDotPixelCount(), await measureDotPixelCount())
    if (baselineMax === 0) await page.waitForTimeout(100)
  }
  expect(baselineMax).toBeGreaterThan(0) // 前置自检：确实在采样窗口内找到了该标记

  const row = page.locator('.event-row')
  await expect(row).toHaveCount(1)
  await row.click() // 选中（SPEC-7.4「列表……选中」），选中态不随鼠标移开而清除，便于后续多次采样
  await expect(page.locator('.event-row--active')).toHaveCount(1)
  await waitNextFrame(page)
  await waitNextFrame(page)

  // 联动高亮态下光柱像素放大（DP §4.4 高亮=尺寸微升的静态强调，非动画）；多次采样取最大值，
  // 规避渲染/合成时序偶发抖动的采样噪声（光柱切片①静止无脉冲，SPEC-3.7）
  const highlightedSamples: number[] = []
  for (let i = 0; i < 4; i++) {
    await resetIdleTimer(page)
    await page.waitForTimeout(200)
    highlightedSamples.push(await measureDotPixelCount())
  }
  const highlightedMax = Math.max(...highlightedSamples)

  // 断因果（选中导致标记放大），不断言像素细节：期望有显著、非噪声量级的增长
  expect(highlightedMax).toBeGreaterThan(baselineMax * 1.5)

  // 反向验证：取消选中后标记应收缩回基线量级（因果可逆）。row.click() 本身会先移动真实鼠标
  // 到该行（天然触发 onMouseEnter/hoveredId），仅第二次点击切换 selectedId 还不够——若鼠标仍停留
  // 在行上，hoveredId 会继续撑住强调态；额外挪开鼠标（借用 resetIdleTimer 的画布落点）才能让
  // hoveredId 与 selectedId 同时清空，验证的是选中态本身被取消，而非仍被 hover 掩盖
  await row.click()
  await resetIdleTimer(page)
  await expect(page.locator('.event-row--active')).toHaveCount(0)
  await waitNextFrame(page)
  await waitNextFrame(page)
  const revertedSamples = [await measureDotPixelCount(), await measureDotPixelCount()]
  const revertedMax = Math.max(...revertedSamples)
  expect(revertedMax).toBeLessThan(highlightedMax)
})

test('marker→list：hover 球面标记使面板对应列表行进入强调态，具体对应且可逆（SPEC-7.4）', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const SPOT_A = { lat: 25, lon: -30, title: 'Marker Hover Event A' }
  const SPOT_B = { lat: -25, lon: 30, title: 'Marker Hover Event B' }
  await bootWithGdacsEvents(page, [
    {
      eventid: 'm2-14-marker-a',
      name: SPOT_A.title,
      alertlevel: 'Red', // severity 3，拾取目标更大更稳
      lat: SPOT_A.lat,
      lon: SPOT_A.lon,
      datemodifiedMs: Date.now(),
    },
    {
      eventid: 'm2-14-marker-b',
      name: SPOT_B.title,
      alertlevel: 'Red',
      lat: SPOT_B.lat,
      lon: SPOT_B.lon,
      datemodifiedMs: Date.now() - 1000,
    },
  ])
  await waitForGlobeDebug(page)
  await waitForSurfaceReady(page)
  await assertDefaultCameraPose(page)

  await expect(page.locator('.event-row')).toHaveCount(2)

  const { width, height } = await canvasBufferSize(page)
  const canvasBox = await page.locator('#globe-container canvas').boundingBox()
  if (!canvasBox) throw new Error('canvas 未找到或不可见')

  const deviceA = projectLatLon(SPOT_A.lat, SPOT_A.lon, width, height)
  const deviceB = projectLatLon(SPOT_B.lat, SPOT_B.lon, width, height)
  const pageA = toPagePoint(canvasBox, width, height, deviceA)
  const pageB = toPagePoint(canvasBox, width, height, deviceB)

  const activeRow = page.locator('.event-row--active')

  // hover 标记 A → 面板对应行（且仅该行）进入强调态（确定性信号：等待 DOM 状态收敛，不用裸 sleep）
  await page.mouse.move(pageA.x, pageA.y)
  await expect(activeRow).toHaveCount(1)
  await expect(activeRow.locator('.event-row__title')).toHaveText(SPOT_A.title)

  // hover 标记 B → 强调态切换到 B（证明具体对应关系随 hover 目标变化，非卡死状态）
  await page.mouse.move(pageB.x, pageB.y)
  await expect(activeRow.locator('.event-row__title')).toHaveText(SPOT_B.title)

  // 移出画布（topbar 区域，明显不与标记重叠）→ 强调态清除（因果可逆）
  await page.mouse.move(5, 5)
  await expect(activeRow).toHaveCount(0)
})

// BUG-021 复验边界：markers.ts 的 INITIAL_CAPACITY=256（实现细节、不作期望值）超出后
// ensureCapacity() 会整体重建 dots（InstancedMesh 实例替换），验证该扩容路径下
// marker→list 拾取（SPEC-7.4）仍正确——SPEC-3.8「标记 ≥200 个时用 instancing」界定了
// ≥200 规模是被 spec 认可的正常使用场景，本用例把事件数推过 256 这一实现内部边界，
// 属该规模场景下对 SPEC-7.4 判据的补充验证，而非新增判据。
test('扩容路径（事件数越过 256，SPEC-3.8 规模场景）后 marker→list 拾取仍正确（SPEC-7.4）', async ({
  page,
}) => {
  test.setTimeout(90_000)
  // 目标标记刻意选在明显偏离 10°/4° 网格填充点、且位于相机默认朝向前半球（pz>0）的坐标，
  // 避免与填充标记的屏幕投影重叠导致拾取判读混淆（前半球判据同本文件 projectLatLon 换算）
  const TARGET = { lat: 23.4, lon: 52.7, title: 'Capacity Expansion Target' }
  const FILLER_COUNT = 260 // 260 + 1 target = 261 > 256，确保触发一次 ensureCapacity 扩容重建

  // 填充标记全部放在后半球（|lon|>90 时 cos(lon)<0，故 pz=cos(lat)*cos(lon) 恒为负，
  // 与相机默认位置 (0,0,3.2) 反向，SPEC-3.1），与前半球的 TARGET 在几何上明显分离，
  // 排除任何射线拾取歧义，只需保证数量越过 256 这一扩容边界即可
  const fillers: GdacsFixtureInput[] = []
  outer: for (let latI = -80; latI <= 80; latI += 10) {
    for (let lonI = 95; lonI <= 179; lonI += 4) {
      if (fillers.length >= FILLER_COUNT) break outer
      fillers.push({
        eventid: `filler-${fillers.length}`,
        name: `Filler ${fillers.length}`,
        lat: latI,
        lon: lonI,
        datemodifiedMs: Date.now() - fillers.length * 1000,
      })
    }
  }
  expect(fillers.length).toBe(FILLER_COUNT) // 前置自检：网格确实产出了预期数量的填充标记

  await bootWithGdacsEvents(page, [
    ...fillers,
    {
      eventid: 'm2-14-capacity-target',
      name: TARGET.title,
      alertlevel: 'Red',
      lat: TARGET.lat,
      lon: TARGET.lon,
      datemodifiedMs: Date.now(),
    },
  ])
  await waitForGlobeDebug(page)
  await waitForSurfaceReady(page)
  await assertDefaultCameraPose(page)

  const totalEvents = fillers.length + 1
  await expect(page.locator('.event-row')).toHaveCount(totalEvents)
  // 标记层已绘制实例数与列表条目数一致（同 M2-13 手法）、且确实越过 256，
  // 证明本次 setEvents() 已推动 ensureCapacity() 完成一次扩容重建（BUG-021 的第二条路径）
  const markerCount = await sampleMarkerCount(page)
  expect(markerCount).toBe(totalEvents)
  expect(markerCount).toBeGreaterThan(256)

  const { width, height } = await canvasBufferSize(page)
  const canvasBox = await page.locator('#globe-container canvas').boundingBox()
  if (!canvasBox) throw new Error('canvas 未找到或不可见')
  const device = projectLatLon(TARGET.lat, TARGET.lon, width, height)
  const pagePt = toPagePoint(canvasBox, width, height, device)

  const activeRow = page.locator('.event-row--active')
  await page.mouse.move(pagePt.x, pagePt.y)
  await expect(activeRow).toHaveCount(1)
  await expect(activeRow.locator('.event-row__title')).toHaveText(TARGET.title)

  // 移出画布 → 强调态清除（因果可逆，同上一测试）
  await page.mouse.move(5, 5)
  await expect(activeRow).toHaveCount(0)
})
