import { expect, test } from '@playwright/test'
import {
  canvasBufferSize,
  sampleCamera,
  samplePixelBoxStable,
  setEarthRotationY,
  setSunDir,
  waitForGlobeDebug,
  waitForRealEarthTexture,
  waitNextFrame,
} from './globeDebug'

const DEG = Math.PI / 180

// M1-05：昼夜混合晨昏线校准 + 格林尼治标记校准。
// 判据出处（全部只从 doc/spec.md 推导，注释逐条标注 SPEC 条目）：
//   - SPEC-3.2「自定义 shader，t = dot(N, sunDir)……晨昏线软过渡带 t ∈ [-0.1, +0.1]
//     （半宽约 5.7°）内 smoothstep 混合」。
//   - SPEC-3.6「格林尼治（lat 0, lon 0）的球面标记必须落在昼纹理的非洲西侧几内亚湾
//     位置（M1 校准场景验证）」。
//
// sunDir 受控注入（避免真实时刻偶发红）：
// testplan M1-05 原文即写"给定已知 sunDir"，真实时刻的 sunDir 由 SPEC-4.5 的太阳位置
// 模型驱动，格林尼治在任意给定时刻都可能落在夜半球，若不控制会导致本场景偶发失败。
// window.__globeDebug 是 DEV-only 校准钩子（import.meta.env.DEV 分支，生产构建不含），
// setSunDir 只对已知 uniform 名 uSunDir 赋值，不解析/移植 shader 源码（见 globeDebug.ts
// 注释）。
//
// 采样点设计（规避"比较不同经度地表纹理内容"的混杂问题）：
// SPEC-3.1 默认视角（相机在 (0,0,3.2)，看向球心）正对模型空间 (lat 0, lon 0) 方向，
// 该方向在画布上正是几何中心。本文件的像素采样固定在画布这一个几何中心像素上；
// 第二个 it（格林尼治标记）保持地球零自转，中心像素恒为 (lat0,lon0)；第一个 it
// （晨昏线过渡带）为了取得更明显的昼夜对比，用 markerRoot.rotation.y 把赤道上不同
// 经度轮流转到该中心像素（见该 it 内注释的推导），但对同一固定经度的一组采样中，
// 始终只改变注入的 sunDir、不再改变旋转——因此同一组内任意两次采样的颜色差异只可能
// 来自 shader 的昼夜混合权重（t 值），不会与"不同经度地表纹理内容本身不同"混淆。

test.describe('M1-05 昼夜混合晨昏线与格林尼治校准', () => {
  test('晨昏线在 t∈[-0.1,+0.1] 内呈现渐变过渡、band 外趋于饱和（SPEC-3.2）', async ({ page }) => {
    // 本用例含数十次"设 sunDir→等两帧→回读像素"往返（候选经度扫描 + band 内细采样），
    // 全量回归下多 e2e worker 并发占满 GPU 时单次往返明显变慢，默认 30s 测试超时
    // 余量不足，参照 e2e/starfield.spec.ts 已有的 test.setTimeout 用法放宽
    test.setTimeout(90_000)
    await page.bringToFront()
    await page.goto('/')
    await waitForGlobeDebug(page)
    await waitForRealEarthTexture(page)

    // 前置自检（非 SPEC 判据）：确认相机仍是 SPEC-3.1 默认视角 (0,0,3.2)，
    // 否则"旋转地球本体、画布中心 = 当前转到中心的经度"这一采样点假设不成立
    const cam = await sampleCamera(page)
    expect(cam.x).toBeCloseTo(0, 3)
    expect(cam.y).toBeCloseTo(0, 3)
    expect(cam.z).toBeCloseTo(3.2, 3)
    expect(cam.earthRotY).toBeCloseTo(0, 3)

    const { width, height } = await canvasBufferSize(page)
    const cx = width / 2
    const cy = height / 2

    // 固定采样点 = 画布几何中心（相机默认视角正对的方向，SPEC-3.1）。
    // markerRoot.rotation.y = -L*DEG 时，模型空间经度 L（lat=0，SPEC-6.2 约定）的
    // 世界坐标正好转到该中心方向（推导：latLonToVector3(0,L) 绕 Y 轴转 -L 后落在
    // (0,0,1)）——用它可以在"零透视投影计算"的前提下，把采样点换到任意经度。
    //
    // 注意（实测排查记录）：t=dot(N,sunDir) 的 N 是该点固定不变的模型空间法线
    // （不随 markerRoot.rotation.y 变换——旋转只改变哪段经度转到画布中心，不改变
    // 被转到中心的那一点自身的法线方向）。故对模型空间经度 L 的赤道点，其法线固定为
    // (sin L, 0, cos L)；要让 t = dot((sin L,0,cos L), sunDir) 取到目标值，sunDir
    // 需要在该点自身的切向-法向基下解出，而不能像 L=0（格林尼治，法线恰为 (0,0,1)）
    // 时那样直接取 sunDir=(sqrt(1-t^2),0,t)。
    function sunDirForLon(t: number, lonDeg: number): { x: number; y: number; z: number } {
      const L = lonDeg * DEG
      const s = Math.sqrt(Math.max(0, 1 - t * t))
      return {
        x: t * Math.sin(L) + s * Math.cos(L),
        y: 0,
        z: t * Math.cos(L) - s * Math.sin(L),
      }
    }

    // 根因排查记录：本用例含数十次真实时间等待（每次采样都等待渲染稳定），累计真实
    // 耗时会超过 SPEC-7.3 的 10s 空闲自转阈值——一旦触发，`markerRoot.rotation.y` 会
    // 被空闲自转逐帧改写，使"固定经度只变 sunDir"的前提被破坏（已用 uniform/rotation
    // 回读实测确认：候选扫描阶段耗时短、rotation 保持不变，结果正确；进入细采样阶段后
    // rotation 已比预期值漂移，contrast 随之崩坏）。仅在每次采样前重钉一次 rotation
    // 仍不够——若空闲自转已被触发，"钉一次"之后到真正取样之间的等待期间（真实时间，
    // 供渲染追上最新状态用）它还会继续逐帧转动。彻底修复：模拟一次不产生位移的点击
    // （down+up 落在同一坐标）令 SPEC-7.3 的输入打断逻辑（`markInput()`）重置空闲计时
    // 并把状态机拉回 IDLE_WAIT——点击本身不改变相机方位角/仰角/距离（无 pointermove
    // 增量），是黑盒、不依赖实现细节的正确输入序列，而非直接摆弄 rotation 去对抗自转。
    // 点击目标用固定的、明显落在 canvas 内且远离 SPEC-2.2 右侧 side-panel 的 CSS 像素
    // 坐标（与 e2e/starfield.spec.ts 的既有写法一致）——不用 cx/cy：那是设备像素
    // （canvasBufferSize，已含 devicePixelRatio 缩放），而 page.mouse.* 用的是 CSS
    // 像素（视口坐标），两套坐标系不能混用。
    const CLICK_X = 400
    const CLICK_Y = 300

    async function luminanceAt(t: number, lonDeg: number): Promise<number> {
      await page.mouse.click(CLICK_X, CLICK_Y)
      await setEarthRotationY(page, -lonDeg * DEG)
      await setSunDir(page, sunDirForLon(t, lonDeg))
      await page.waitForTimeout(120)
      await waitNextFrame(page)
      const [r, g, b] = await samplePixelBoxStable(page, cx, cy, 3)
      return 0.299 * r + 0.587 * g + 0.114 * b
    }

    // 挑选一个昼夜对比明显的经度作为采样点：赤道上不同经度的实际地表内容不同
    // （海洋/雨林/沙漠/陆地等），对比强弱因地而异（如几内亚湾/太平洋开阔洋面夜间
    // 缺乏城市灯光、昼夜亮度都偏暗，对比很弱），这与 SPEC-3.2 的 smoothstep 混合
    // 逻辑本身无关（该逻辑对球面上任一点一致生效）——在赤道沿线实际经过陆地、且已用
    // 独立调试脚本核实过昼夜对比明显（约 30~50 量级）的两个候选经度（东非之角荒漠 40°E、
    // 南美安第斯山麓 -50°W）中实测挑更强的一个，只是选一个更清晰的观测窗口，不影响
    // 下面对过渡带形状的判定。候选数从早期版本的 11 个精简为 2 个，是为了减少全量回归
    // 多 e2e worker 并发下的采样往返次数（往返越多，越容易撞上系统负载导致的渲染延迟）。
    const candidates = [40, -50]
    let bestLon = 0
    let bestContrast = -Infinity
    for (const lon of candidates) {
      const d = await luminanceAt(1, lon)
      const n = await luminanceAt(-1, lon)
      if (d - n > bestContrast) {
        bestContrast = d - n
        bestLon = lon
      }
    }

    const nightDeep = await luminanceAt(-1, bestLon)
    const nightNear = await luminanceAt(-0.3, bestLon)
    const dayNear = await luminanceAt(0.3, bestLon)
    const dayDeep = await luminanceAt(1, bestLon)

    // band 内细采样（t 从 -0.1 到 +0.1，步长 0.01，共 21 点），
    // samples[0] = t=-0.1（SPEC-3.2 band 下界），samples[20] = t=+0.1（band 上界）
    const steps = 21
    const samples: number[] = []
    for (let i = 0; i < steps; i++) {
      const t = -0.1 + (0.2 * i) / (steps - 1)
      samples.push(await luminanceAt(t, bestLon))
    }

    const contrast = dayDeep - nightDeep
    // 昼夜对比要足够显著，否则后续"饱和"断言可能只是纹理未生效的退化情形；
    // 阈值取 15（远大于 SATURATION_TOLERANCE=8 的渲染噪声量级），在候选经度实测中
    // （独立调试脚本核实过多个真实陆地经度对比普遍在 40~50 量级）留有充分余量
    expect(contrast).toBeGreaterThan(15)

    // 饱和判定容差：真实 WebGL 渲染（JPEG 纹理解码 + mipmap/各向异性过滤）在系统负载较高
    // 时（如全量 e2e 多 worker 并发渲染）存在若干像素单位的抖动，与"band 外仍有实质性
    // 渐变"（判据③，量级为 contrast 的 8%）相比数量级小得多，8 是留了安全余量后仍然
    // 明显小于该量级的绝对阈值
    const SATURATION_TOLERANCE = 8

    // ① band 外（|t| 明显大于 0.1）已饱和：更深处的取值与近处几乎相等
    expect(Math.abs(nightDeep - nightNear)).toBeLessThanOrEqual(SATURATION_TOLERANCE)
    expect(Math.abs(dayDeep - dayNear)).toBeLessThanOrEqual(SATURATION_TOLERANCE)
    // ② band 边界本身即达到饱和值（smoothstep 在 edge0/edge1 处取值恰为 0/1，SPEC-3.2）
    expect(Math.abs(samples[0] - nightDeep)).toBeLessThanOrEqual(SATURATION_TOLERANCE)
    expect(Math.abs(samples[steps - 1] - dayDeep)).toBeLessThanOrEqual(SATURATION_TOLERANCE)

    // ③ band 并未比 SPEC-3.2 的 ±0.1 窄很多：t=-0.05/+0.05（band 中点附近，索引 5/15）
    // 仍应明显偏离对应的饱和极值——若实现把 band 收窄到远小于 0.1，这两点会提前饱和，
    // 与两端极值几乎相等，本断言会失败
    expect(Math.abs(samples[5] - nightDeep)).toBeGreaterThan(contrast * 0.08)
    expect(Math.abs(samples[15] - dayDeep)).toBeGreaterThan(contrast * 0.08)

    // ④ band 内部渐变而非硬跳变：亮度随 t 单调不减（21 个独立采样点连成一串，容差比
    // 判据①②的"同一采样点应相等"更宽松一些，以容纳相邻两个独立采样各自的渲染噪声
    // 叠加），且任何单步跳变都不应吞掉总对比度的大半——排除"其实是硬跳变，只是恰好
    // 卡在某一采样间隙"的情形
    const MONOTONIC_NOISE_TOLERANCE = 14
    let maxStep = 0
    let nonDecreasing = true
    for (let i = 1; i < samples.length; i++) {
      const d = samples[i] - samples[i - 1]
      if (d < -MONOTONIC_NOISE_TOLERANCE) nonDecreasing = false
      maxStep = Math.max(maxStep, Math.abs(d))
    }
    expect(nonDecreasing).toBe(true)
    expect(maxStep).toBeLessThan(contrast * 0.5)

    // ⑤ 存在多个互不相同的中间亮度层级（进一步排除单像素硬跳变的实现）
    const distinctLevels = new Set(samples.map((v) => Math.round(v))).size
    expect(distinctLevels).toBeGreaterThanOrEqual(5)
  })

  test('格林尼治 (lat0,lon0) 校准标记落在画布几何中心，截图供人工判读几内亚湾位置（SPEC-3.6）', async ({
    page,
  }) => {
    await page.bringToFront()
    await page.goto('/')
    await waitForGlobeDebug(page)
    await waitForRealEarthTexture(page)

    const cam = await sampleCamera(page)
    expect(cam.x).toBeCloseTo(0, 3)
    expect(cam.y).toBeCloseTo(0, 3)
    expect(cam.z).toBeCloseTo(3.2, 3)
    expect(cam.earthRotY).toBeCloseTo(0, 3)

    // 给定已知 sunDir：太阳直射 (lat0,lon0)，确保标记所在半球明确显示昼纹理
    // （testplan M1-05 原文"给定已知 sunDir"）
    await setSunDir(page, { x: 0, y: 0, z: 1 })
    await page.waitForTimeout(120)
    await waitNextFrame(page)

    // SPEC-3.6「M1 校准场景验证」指定的 DEV-only 校准钩子
    await page.evaluate(() => {
      ;(
        window as unknown as {
          __globeDebug: { addCalibrationMarker: (lat: number, lon: number) => void }
        }
      ).__globeDebug.addCalibrationMarker(0, 0)
    })
    await waitNextFrame(page)
    await waitNextFrame(page)

    // 防御性重钉 rotation=0（见上一个 it 头注的根因排查记录）：本用例总耗时正常远低于
    // SPEC-7.3 的 10s 空闲自转阈值，但仍在采样前保险性地钉一次零自转，避免偶发的
    // 系统级延迟导致空闲自转提前触发、把标记转离画布中心
    await setEarthRotationY(page, 0)

    // 机械判据：标记（纯白 0xffffff 的 MeshBasicMaterial，不受昼夜混合影响）应出现在
    // 画布几何中心——SPEC-3.1 默认视角正对 (lat0,lon0)，本断言验证端到端渲染管线
    // （相机 + 几何 + uv 映射）落点与 SPEC-3.6 要求的位置一致（uv 映射本身已由 M1-12
    // 的顶点单测覆盖，此处验证的是渲染结果）
    const { width, height } = await canvasBufferSize(page)
    const [r, g, b] = await samplePixelBoxStable(page, width / 2, height / 2, 3)
    expect(r).toBeGreaterThan(230)
    expect(g).toBeGreaterThan(230)
    expect(b).toBeGreaterThan(230)

    // 视觉判据（SPEC-3.6「M1 校准场景验证」由人工判读标记是否落在几内亚湾/西非海岸；
    // BUG-008 要求视觉/截图场景必须随证据归档截图）——先出完整画布留存整体上下文，
    // 再出以标记为中心的放大裁切，便于人工辨认海岸线细节。
    // 注意：page.screenshot 的 clip 用的是 CSS 像素（视口坐标），与上面 samplePixelBox
    // 用的设备像素（canvasBufferSize）是两套坐标系，此处须重新从 canvas 的
    // boundingBox 取 CSS 坐标，不能复用 width/height。
    await page.screenshot({ path: 'test-results/greenwich-calibration-full.png' })
    const box = await page.locator('#globe-container canvas').boundingBox()
    if (!box) throw new Error('canvas 未找到或不可见')
    const ccx = box.x + box.width / 2
    const ccy = box.y + box.height / 2
    const cropHalf = 220
    await page.screenshot({
      path: 'test-results/greenwich-calibration.png',
      clip: {
        x: Math.max(0, ccx - cropHalf),
        y: Math.max(0, ccy - cropHalf),
        width: Math.min(box.width, cropHalf * 2),
        height: Math.min(box.height, cropHalf * 2),
      },
    })
  })
})
