import { expect, test, type Page } from '@playwright/test'
import type { GeoEvent } from '../src/data'
import {
  canvasBufferSize,
  findColorInRegion,
  injectAndRecordBreathing,
  markerGroupChildCount,
  sampleCamera,
  sampleMarkerInstances,
  setDebugEvents,
  waitBreathingTrace,
  waitForGlobeDebug,
  waitForSurfaceReady,
} from './globeDebug'

// M2-21：呼吸式过渡——首轮刷新收敛时旧标记渐隐、新标记渐亮、无整屏闪烁
// （e2e 视觉 + 连续多帧采样，需附截图）。
// 期望值只从 doc/spec.md 推导（断言注释逐条标 SPEC 条目）：
//   - SPEC-3.11「首次刷新完成后以呼吸式过渡收敛：已过期/被替换的旧标记渐隐熄灭、最新
//     事件渐亮，不做整屏重绘闪烁。」
//       ① 旧标记（不再出现于最新结果）：可见状态随时间连续衰减至消失，非单帧瞬灭；
//       ② 新增/更新标记：可见状态随时间连续增长至正常态，非单帧瞬现；
//       ③ 既有（未增减）标记：过渡期间保持连续可见，无全屏级瞬间清空/重绘闪烁。
//   - 补充推导（testplan 判据未含，按任务卡要求补齐并标条目）：
//       SPEC-3.8「标记用 instancing/点精灵，不逐事件建 Mesh」——过渡增删过程中标记层
//         仍保持两层 InstancedMesh（子节点数恒 2），不整表重建为逐事件 Mesh；
//       SPEC-7.5「以『每帧』表述的常量以 60fps 为基准，实际帧率不同时单位时间内的变化
//         比例保持一致」——过渡由真实经过时间驱动（非单帧切换），从注入到旧标记熄灭
//         历经有界的真实墙钟时长（明显 > 单帧、且有限收敛），佐证按真实毫秒推进；不断言
//         实现的具体过渡时长常量。
//
// 本场景走「缓存批上屏 → 刷新收敛」路径：先以一组缓存事件上屏（等其稳定到满态后再开始，
// 不断言首批到达满态的过程），再令刷新返回与缓存有差异的结果。BUG-030（无缓存首批
// snap/淡入 spec 歧义）待仲裁，不在本场景断言范围——不测「全新安装无缓存首批」的过渡性。
//
// 可见状态量测：以 dots 的 per-instance instanceAlpha（自定义 shader
// `gl_FragColor = vec4(vColor, vAlpha)`，即渲染出的可见透明度）逐帧采样为确定性主证据，
// 辅以分类色像素查找（findColorInRegion）与截图作为「视觉」佐证。标记实例按 lat/lon
// 经 SPEC-6.2 换算得的方向识别（不依赖实现内部槽位次序）。

const DEG = Math.PI / 180
const HALF_FOV_Y = 22.5 * DEG // SPEC-3.1 fov 45°（垂直）

// 已知 lat/lon → 屏幕像素（仅用于「去哪找标记」，不构成断言期望值本身）。
// SPEC-3.1 默认相机 (0,0,3.2) 看向球心、上方向 +Y；SPEC-6.2 lat/lon → 模型空间
// (cos(lat)sin(lon), sin(lat), cos(lat)cos(lon))。与 marker-category-severity.spec.ts 同法。
function projectLatLon(latDeg: number, lonDeg: number, width: number, height: number) {
  const lat = latDeg * DEG
  const lon = lonDeg * DEG
  const px = Math.cos(lat) * Math.sin(lon)
  const py = Math.sin(lat)
  const pz = Math.cos(lat) * Math.cos(lon)
  const negCamZ = -(pz - 3.2)
  const aspect = width / height
  const ndcX = px / (negCamZ * Math.tan(HALF_FOV_Y) * aspect)
  const ndcY = py / (negCamZ * Math.tan(HALF_FOV_Y))
  return { x: ((ndcX + 1) / 2) * width, y: ((1 - ndcY) / 2) * height }
}

// 已知 lat/lon → 单位方向向量（SPEC-6.2），用于按 instanceMatrix 平移方向识别标记实例。
function latLonDir(latDeg: number, lonDeg: number): { x: number; y: number; z: number } {
  const lat = latDeg * DEG
  const lon = lonDeg * DEG
  return { x: Math.cos(lat) * Math.sin(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.cos(lon) }
}

function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff]
}

type Instance = { alpha: number; tx: number; ty: number; tz: number }

// 取「平移方向与目标方向点积最大」的实例的 alpha（三枚标记方向两两分离，识别无歧义；
// 熄灭并释放的槽在被复用前仍保留其平移方向，故终态仍可按方向定位到 alpha=0 的旧标记槽）。
function alphaAt(instances: Instance[], dir: { x: number; y: number; z: number }): number {
  let best = -Infinity
  let bestAlpha = Number.NaN
  for (const it of instances) {
    const len = Math.hypot(it.tx, it.ty, it.tz)
    if (len < 1e-6) continue
    const d = (it.tx * dir.x + it.ty * dir.y + it.tz * dir.z) / len
    if (d > best) {
      best = d
      bestAlpha = it.alpha
    }
  }
  return bestAlpha
}

// 三枚标记：各据前半球不同经纬（互不重叠）、各用一种分类色（便于像素佐证按色识别）。
// severity 3：标记实心点 + 脉冲环像素足够大，findColorInRegion 命中数稳定。
const KEEP = { lat: 20, lon: -30, category: 'news' as const, hex: 0x40a9ff } // 既有：全程保留
const OLD = { lat: 20, lon: 30, category: 'disaster' as const, hex: 0xff4d4f } // 旧：刷新后不再返回
const NEW = { lat: -25, lon: 0, category: 'launch' as const, hex: 0xb37feb } // 新：刷新新增

function mk(
  spec: { lat: number; lon: number; category: GeoEvent['category'] },
  id: string,
): GeoEvent {
  return {
    id,
    category: spec.category,
    severity: 3,
    title: id,
    summary: '',
    urls: [],
    lat: spec.lat,
    lon: spec.lon,
    ts: Date.now(),
    source: 'usgs',
  }
}

// 与 marker-category-severity.spec.ts 同一根因规避：App 挂载会启动真实数据层轮询，其
// store 订阅回调会用真实网络结果覆盖经调试钩子注入的构造事件——拦截所有跨源请求使
// scheduler 轮询全部失败、不产生 onResult 回调，注入的事件不被二次覆盖（只改 e2e/）。
async function goToIdleGlobe(page: Page) {
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return route.continue()
    return route.abort()
  })
  await page.bringToFront()
  await page.goto('/')
  await waitForGlobeDebug(page)
  await waitForSurfaceReady(page)
  // 前置自检（非 SPEC 判据）：确认仍是 SPEC-3.1 默认视角、地球零自转——projectLatLon 与
  // latLonDir 均以此为前提，偏离则后续定位失效。
  const cam = await sampleCamera(page)
  expect(cam.x).toBeCloseTo(0, 3)
  expect(cam.y).toBeCloseTo(0, 3)
  expect(cam.z).toBeCloseTo(3.2, 3)
  expect(cam.earthRotY).toBeCloseTo(0, 3)
}

// 空闲计时重置（SPEC-7.3）：不产生位移的点击落在画布左下角（明显偏离三枚标记投影位置），
// 令累计等待不触发空闲自转移动标记、失效 projectLatLon 前提。
async function resetIdleTimer(page: Page) {
  await page.mouse.click(80, 650)
}

function regionOf(
  spec: { lat: number; lon: number },
  width: number,
  height: number,
  half: number,
) {
  const { x, y } = projectLatLon(spec.lat, spec.lon, width, height)
  return {
    x: Math.max(0, Math.round(x - half)),
    y: Math.max(0, Math.round(y - half)),
    width: Math.min(width, half * 2),
    height: Math.min(height, half * 2),
  }
}

test('呼吸式过渡：旧标记渐隐 / 新标记渐亮 / 既有标记连续可见（SPEC-3.11，多帧采样 + 截图）', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await goToIdleGlobe(page)
  await resetIdleTimer(page)

  const { width, height } = await canvasBufferSize(page)
  const dirKeep = latLonDir(KEEP.lat, KEEP.lon)
  const dirOld = latLonDir(OLD.lat, OLD.lon)
  const dirNew = latLonDir(NEW.lat, NEW.lon)
  const HALF = 55 // 采样窗口半径（设备像素）：三枚标记投影两两间距远大于此，互不干扰

  // ---- 阶段一：缓存批上屏（KEEP + OLD），等其稳定到满态 ----
  await setDebugEvents(page, [mk(KEEP, 'keep'), mk(OLD, 'old')])
  // 等 >过渡时长量级，令缓存批稳定到满态（无论首批即时或淡入，本场景不断言该过渡性 →
  // 规避 BUG-030）；此后以「满态可见的既有两枚标记」作为呼吸过渡的确定性起点。
  await page.waitForTimeout(800)
  const p1 = await sampleMarkerInstances(page)
  // 前置：缓存批已上屏并稳定为满态可见（作为过渡起点，非断言其到达满态的过程）
  expect(alphaAt(p1, dirKeep)).toBeGreaterThan(0.95)
  expect(alphaAt(p1, dirOld)).toBeGreaterThan(0.95)
  await page.screenshot({ path: 'test-results/m2-21-phase1-cache.png' })

  // 像素佐证（阶段一满态）：KEEP/OLD 分类色像素可见，NEW 尚未出现。容差 20（吸收 sRGB
  // 往返量化误差，且明显小于 SPEC-3.7 六色两两通道差 ≥60，不与相邻色/海岸线灰蓝混淆）。
  const keepHit1 = await findColorInRegion(
    page,
    regionOf(KEEP, width, height, HALF),
    hexToRgb(KEEP.hex),
    20,
  )
  const oldHit1 = await findColorInRegion(
    page,
    regionOf(OLD, width, height, HALF),
    hexToRgb(OLD.hex),
    20,
  )
  const newHit1 = await findColorInRegion(
    page,
    regionOf(NEW, width, height, HALF),
    hexToRgb(NEW.hex),
    20,
  )
  expect(keepHit1, 'KEEP 阶段一应可见其 news 分类色像素').not.toBeNull()
  expect(oldHit1, 'OLD 阶段一应可见其 disaster 分类色像素').not.toBeNull()
  expect(newHit1?.count ?? 0, 'NEW 阶段一尚未注入，不应出现其 launch 分类色像素').toBeLessThan(10)

  // ---- 阶段二：刷新收敛（KEEP 保留 + NEW 新增；OLD 不再返回）----
  await resetIdleTimer(page)
  // 页面内逐帧记录 alpha 轨迹（BUG-010 负载稳健化，见 globeDebug.injectAndRecordBreathing 头注）：
  // 注入 phase-2 快照与逐帧记录在同一 evaluate 内原子完成，采样密度 = 真实渲染帧率，不再受
  // 外部 page.evaluate 往返延迟拖稀而丢失中间态（原 20 次外部往返采样在 8-worker 负载下曾
  // 只捕获到 1 个中间衰减值）。判据不变（≥2 中间值、单调、终态 0/1 均由 SPEC-3.11 推导）。
  await injectAndRecordBreathing(page, [mk(KEEP, 'keep'), mk(NEW, 'new')], {
    keep: dirKeep,
    old: dirOld,
    new: dirNew,
  })

  // 过渡中途视觉截图（best-effort 视觉证据，不 gate 判据）：记录器在页面内自行逐帧推进，
  // 此处并发抓取两张部分过渡态。呼吸过渡约 500ms，负载下单张截图耗时可能跨过整个过渡，
  // 故为尽力而为——判据由上面的逐帧 alpha 轨迹裁定，截图仅供人工视觉留存（BUG-008 视觉证据）。
  await page.screenshot({ path: 'test-results/m2-21-mid-early.png' })
  await page.screenshot({ path: 'test-results/m2-21-mid-late.png' })

  // 记录器 done 后一次性回读全部逐帧采样（t=注入起的真实毫秒；keep/old/new=三枚标记 alpha）
  const samples = await waitBreathingTrace(page)

  // 收敛后终态
  await page.waitForTimeout(400)
  const pf = await sampleMarkerInstances(page)
  await page.screenshot({ path: 'test-results/m2-21-final.png' })

  const oldSeries = samples.map((s) => s.old)
  const newSeries = samples.map((s) => s.new)
  const keepSeries = samples.map((s) => s.keep)

  // 判据①：旧标记渐隐——存在 ≥2 个中间态采样（0.1<α<0.9），证明连续跨多帧衰减而非
  // 单帧瞬灭；序列单调非增（+0.02 吸收采样噪声）；终态熄灭 α≈0（SPEC-3.11「旧标记渐隐熄灭」）。
  expect(
    oldSeries.filter((a) => a > 0.1 && a < 0.9).length,
    `旧标记应有 ≥2 个中间透明度采样（连续衰减），实测序列=${oldSeries.map((a) => a.toFixed(2)).join(',')}`,
  ).toBeGreaterThanOrEqual(2)
  for (let i = 1; i < oldSeries.length; i++) {
    expect(oldSeries[i]).toBeLessThanOrEqual(oldSeries[i - 1] + 0.02)
  }
  expect(alphaAt(pf, dirOld)).toBeLessThanOrEqual(0.05)

  // 判据②：新标记渐亮——存在 ≥2 个中间态采样，证明连续跨多帧增长而非单帧瞬现；序列
  // 单调非减；终态满亮 α≈1（SPEC-3.11「最新事件渐亮」）。
  expect(
    newSeries.filter((a) => a > 0.1 && a < 0.9).length,
    `新标记应有 ≥2 个中间透明度采样（连续增长），实测序列=${newSeries.map((a) => a.toFixed(2)).join(',')}`,
  ).toBeGreaterThanOrEqual(2)
  for (let i = 1; i < newSeries.length; i++) {
    expect(newSeries[i]).toBeGreaterThanOrEqual(newSeries[i - 1] - 0.02)
  }
  expect(alphaAt(pf, dirNew)).toBeGreaterThan(0.95)

  // 判据③：既有标记全程连续可见——每一采样 α>0.9，不因该轮整体重建出现瞬间清空
  // （SPEC-3.11「不做整屏重绘闪烁」；未增减的既有标记保持连续可见）。
  for (const a of keepSeries) {
    expect(a, `既有标记全程应连续可见（α>0.9），实测=${keepSeries.map((v) => v.toFixed(2)).join(',')}`).toBeGreaterThan(0.9)
  }
  expect(alphaAt(pf, dirKeep)).toBeGreaterThan(0.95)

  // 补充断言 A（SPEC-3.8 不整表重建）：过渡（增 NEW / 删 OLD）过程中标记层子节点恒为
  // 2 层 InstancedMesh（dots + rings），不逐事件建 Mesh、不整表重建。
  expect(await markerGroupChildCount(page)).toBe(2)

  // 补充断言 B（SPEC-7.5 时间基准）：从阶段二注入到旧标记熄灭历经的真实墙钟时长落在有界
  // 区间——明显 > 单帧（>150ms，排除单帧瞬间切换：若瞬灭则首采样 t≈30ms 即 α≈0）、且有限
  // 收敛（<5s）。佐证过渡按真实经过时间推进（SPEC-7.5 跨帧率等效原则）；不断言实现的
  // 具体过渡时长常量。e2e 无法直接变更帧率做严格帧率无关性验证，此为其时间驱动性的代理。
  const extinguished = samples.find((s) => s.old <= 0.05)
  expect(extinguished, '采样窗口内旧标记应完成熄灭').toBeDefined()
  expect(extinguished!.t).toBeGreaterThan(150)
  expect(extinguished!.t).toBeLessThan(5_000)

  // 像素佐证（终态满态）：OLD 分类色像素消失、NEW 出现、KEEP 保留——把 alpha 通道结论
  // 落到实际渲染像素上（视觉证据）。
  await resetIdleTimer(page)
  const camFinal = await sampleCamera(page)
  expect(camFinal.earthRotY, '终态量测前地球仍应零自转，否则投影定位失效').toBeCloseTo(0, 2)
  const keepHitF = await findColorInRegion(
    page,
    regionOf(KEEP, width, height, HALF),
    hexToRgb(KEEP.hex),
    20,
  )
  const oldHitF = await findColorInRegion(
    page,
    regionOf(OLD, width, height, HALF),
    hexToRgb(OLD.hex),
    20,
  )
  const newHitF = await findColorInRegion(
    page,
    regionOf(NEW, width, height, HALF),
    hexToRgb(NEW.hex),
    20,
  )
  expect(keepHitF, 'KEEP 终态应仍可见其分类色像素（既有标记保留）').not.toBeNull()
  expect(oldHitF?.count ?? 0, 'OLD 终态其分类色像素应已消失（旧标记熄灭）').toBeLessThan(10)
  expect(newHitF, 'NEW 终态应可见其分类色像素（新标记已渐亮到满态）').not.toBeNull()
})
