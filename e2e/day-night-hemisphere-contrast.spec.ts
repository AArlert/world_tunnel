import { expect, test } from '@playwright/test'
import {
  canvasBufferSize,
  sampleBoxExcludingBright,
  sampleCamera,
  samplePixelBoxStable,
  setEarthRotationY,
  setSunDirVector,
  waitForGlobeDebug,
  waitForSurfaceReady,
  waitNextFrame,
} from './globeDebug'

const DEG = Math.PI / 180

// M3-02：昼夜半球柔和对比（视觉，需附截图；e2e，真实 Chromium + WebGL 渲染）。
//
// 判据出处（断言期望值只从 doc/spec.md 推导，逐条标注 SPEC 条目；对应 doc/testplan.md M3-02
// 行文，量测方法由 REV-013 硬条件 C-2 定死）：
//   - SPEC-3.2a 昼夜半球对比契约（v0.2.13）：① 主判据——晨昏线两侧对称代表性采样点的底面
//     sRGB 亮度比落入 [1.8, 2.6]（< 1.8 判为不可辨/平涂、> 2.6 判为过硬如探照灯）；
//     ② 副判据——昼半球内「次日点亮度 : 近晨昏线昼侧亮度」≥ 1.3 : 1（防经纬网默认隐藏后
//     昼半球「空」）。落值区间为 spec pin，量测方法归 testplan（SPEC-3.10 切分先例）。
//   - SPEC-3.2①：昼半球底面在过渡带之外仍随离日角连续柔和衰减——次日点(t=1)最亮、向晨昏线
//     渐暗，副判据即量测该内部梯度；晨昏软过渡带 t∈[-uTwilight,+uTwilight]（本文件采样点均
//     取在带外，k=1 纯昼/纯夜，避开带内混合）。
//
// C-2 量测方法（REV-013 §7 硬条件 C-2 / REV-013 §3「本仲裁」逐条定死，在此落稿）：
//   ① 亮度定义 = **gamma 编码 Rec.709 luma**：`0.2126R'+0.7152G'+0.0722B'`，直接对 0–255
//      sRGB 值加权、**不线性化**（与 aes §0 基线同法；REV-013 C-2 复算指出落值 [1.8,2.6] 对
//      亮度定义极敏——线性化相对亮度平涂比≈6.13，gamma 编码 luma 平涂峰值比≈2.76，故必须锁定
//      此定义，见下方 gammaLuma()）。
//   ② 采样几何 = 晨昏线两侧**同纬度对称点**、距晨昏线各 ±40°（TERM_OFFSET_DEG）。矢量默认风格
//      底面为**空间均匀**的程序化纯色（无纹理，SPEC-3.2②；底面亮度纯为离日角 t 的函数
//      f(t)，与地理位置无关，见 src/globe/shaders/vectorEarth.ts 底面无 glow）——故「晨昏两侧
//      同纬度对称点」等价于「同一底面点在对称 sunDir 下的两次采样」：把采样点固定在画布几何
//      中心（SPEC-3.1 默认视角正对 lat0/lon0 几内亚湾洋面，纯底面无海岸线），用 sunDirForT(t)
//      令该点法线(0,0,1)与太阳方向夹角余弦恰为 t（推导同 e2e/vector-earth-style.spec.ts、
//      day-night-calibration.spec.ts 头注），即可在同一像素取到任意离日角 t 的底面亮度，不必
//      逐点计算透视投影。对称 ±40°：昼点离日角 = 90°−40° = 50°（t = cos50° = sin40°）、
//      夜点离日角 = 90°+40° = 130°（t = cos130° = −sin40°），故对称 t = ±sin40°。
//   ③ 亮像素排除阈值 = BRIGHT_LUMA_EXCLUDE（见其定义）：底面采样须排除结构线像素（海岸线/
//      网格）只量底面本身；几内亚湾洋面中心无海岸线，实测排除数应为 0（下方 method-sanity 断言
//      在最亮的 t=1 处核验），即整框均为纯底面、平均值为有效底面亮度。
//   ④ 对照基线 = 改造前实测 **1.11 : 1**（aes §0，整球近均匀深色不达标 D24）；契约达成后主判据
//      比值须显著高于该基线（[1.8,2.6] 下界 1.8 已 ≫ 1.11，断言隐含此改善，注释存照不另断）。
//
// 事件注入无关（本场景只测底面，不注入标记）；渲染稳定门用 waitForSurfaceReady（读跨风格
// uSunDir，矢量默认风格适用，见 globeDebug.ts）。全程矢量默认路径（goto('/') 不带 ?style）。

/** gamma 编码 Rec.709 luma（C-2 亮度定义）：对 0–255 sRGB 值直接加权，不线性化。 */
function gammaLuma([r, g, b]: readonly number[]): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// C-2 采样几何常量
const TERM_OFFSET_DEG = 40 // 晨昏线两侧对称偏移（同纬度对称点，C-2）
const T_DAY = Math.sin(TERM_OFFSET_DEG * DEG) //  昼侧对称点 离日角 50° → t=cos50°=sin40°≈0.6428
const T_NIGHT = -Math.sin(TERM_OFFSET_DEG * DEG) // 夜侧对称点 离日角 130° → t=cos130°=−sin40°
// 副判据「近晨昏线昼侧」代表点：距晨昏线约 10°（离日角 80°，t=sin10°≈0.1736），落在过渡带
// [-0.1,+0.1] 之外故 k=1 纯昼色、仅受连续衰减压暗（是昼半球内最贴近晨昏线的暗昼点）。
const T_NEAR_TERMINATOR = Math.sin(10 * DEG)
const T_SUBSOLAR = 1.0 // 次日点（昼半球最亮）

// 亮像素排除阈值（C-2③）：矢量底面昼端峰值 gamma luma≈63（#1f4468 全亮），海岸线昼端 #6690b3
// gamma luma≈138——阈值取 90 干净地夹在两者之间：底面任一采样点（≤63）不被误排，海岸线/网格
// （≥110）若混入采样框则被排除。几内亚湾洋面中心无海岸线，实测排除数应为 0。
const BRIGHT_LUMA_EXCLUDE = 90
const SAMPLE_SIZE = 7 // 取样框边长（设备像素）：中心洋面区域远大于此，整框为纯底面

/**
 * sunDir 使画布中心点（法线 N=(0,0,1)）的离日角 dot(N,sunDir)=t（推导见 day-night-calibration
 * .spec.ts 头注：lon=0 时 sunDir=(sqrt(1-t²),0,t)）。只对已知 uniform 名赋值，不移植 shader。
 */
function sunDirForT(t: number): { x: number; y: number; z: number } {
  const s = Math.sqrt(Math.max(0, 1 - t * t))
  return { x: s, y: 0, z: t }
}

test.describe('M3-02 昼夜半球柔和对比（SPEC-3.2a 对比契约 + SPEC-3.2① 连续衰减）', () => {
  test('主判据晨昏两侧 ±40° 底面亮度比∈[1.8,2.6]、副判据次日点:近晨昏≥1.3:1（C-2 量测）', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    // 拦截跨源请求（本机 dev server 放行）：本场景只量底面，屏蔽真实数据层轮询，避免真实标记
    // 偶发落在中心采样点污染底面亮度量测（同 marker-category-severity.spec.ts 的确定性手法），
    // 使量测纯针对矢量底面昼夜梯度、beauty 截图亦为纯底面（M3-02 判据只涉底面对比，与标记无关）。
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url())
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return route.continue()
      return route.abort()
    })
    await page.bringToFront()
    await page.goto('/')
    await waitForGlobeDebug(page)
    await waitForSurfaceReady(page)

    // 前置自检（非 SPEC 判据）：确认 SPEC-3.1 默认视角、地球零自转——否则「屏幕中心=lat0/lon0
    // 洋面、其法线=(0,0,1)」的采样几何前提不成立，sunDirForT(t) 的 t 语义失效
    const cam = await sampleCamera(page)
    expect(cam.x).toBeCloseTo(0, 3)
    expect(cam.y).toBeCloseTo(0, 3)
    expect(cam.z).toBeCloseTo(3.2, 3)
    expect(cam.earthRotY).toBeCloseTo(0, 3)

    const { width, height } = await canvasBufferSize(page)
    const cx = Math.round(width / 2)
    const cy = Math.round(height / 2)

    // 采样一个离日角 t 的底面 gamma luma：重钉零自转（防 SPEC-7.3 空闲自转把中心点转离
    // lat0/lon0，根因见 day-night-calibration.spec.ts 头注）+ 无位移点击重置空闲计时，
    // 注入 sunDirForT(t) 后取稳定的整框平均（samplePixelBoxStable 抑制负载下陈旧帧）。
    async function baseLumaAt(t: number): Promise<number> {
      await page.mouse.click(400, 300) // 无位移点击：重置 SPEC-7.3 空闲自转计时（避开右侧面板）
      await setEarthRotationY(page, 0)
      await setSunDirVector(page, sunDirForT(t))
      await page.waitForTimeout(120)
      await waitNextFrame(page)
      const px = await samplePixelBoxStable(page, cx, cy, SAMPLE_SIZE)
      return gammaLuma(px)
    }

    // --- method-sanity（C-2③）：最亮的 t=1 处核验中心采样框无结构性亮像素（纯底面）---
    await page.mouse.click(400, 300)
    await setEarthRotationY(page, 0)
    await setSunDirVector(page, sunDirForT(T_SUBSOLAR))
    await page.waitForTimeout(120)
    await waitNextFrame(page)
    await samplePixelBoxStable(page, cx, cy, SAMPLE_SIZE) // 先稳门
    const cleanliness = await sampleBoxExcludingBright(page, cx, cy, SAMPLE_SIZE, BRIGHT_LUMA_EXCLUDE)
    expect(
      cleanliness.excluded,
      `中心采样框应为纯底面、无结构性亮像素混入（C-2 亮像素排除阈值 ${BRIGHT_LUMA_EXCLUDE}；` +
        `实测排除 ${cleanliness.excluded}/${cleanliness.total}）`,
    ).toBe(0)

    // --- 主判据：晨昏两侧 ±40° 对称点底面亮度比 ∈ [1.8, 2.6]（SPEC-3.2a 主判据）---
    const lumaDay = await baseLumaAt(T_DAY)
    const lumaNight = await baseLumaAt(T_NIGHT)
    expect(lumaNight, '夜端底面亮度应 > 0（用作比值分母）').toBeGreaterThan(0)
    const mainRatio = lumaDay / lumaNight
    // 边界预警（任务卡②）：若触下界 1.8 失败，属实现落值与量测几何的匹配问题，如实置 ❌ 并
    // 登缺陷，不放宽容差/改判据迁就实现。
    expect(
      mainRatio,
      `晨昏两侧 ±40° 对称点底面 gamma luma 比 = ${lumaDay.toFixed(2)}/${lumaNight.toFixed(2)} = ` +
        `${mainRatio.toFixed(3)}，应 ∈ [1.8, 2.6]（SPEC-3.2a 主判据；对照基线改造前 1.11）`,
    ).toBeGreaterThanOrEqual(1.8)
    expect(
      mainRatio,
      `晨昏两侧 ±40° 对称点底面 gamma luma 比 ${mainRatio.toFixed(3)} 应 ≤ 2.6（> 2.6 过硬如探照灯，SPEC-3.2a）`,
    ).toBeLessThanOrEqual(2.6)

    // --- 副判据：昼半球内「次日点 : 近晨昏线昼侧」≥ 1.3 : 1（SPEC-3.2a 副判据 + SPEC-3.2① 梯度）---
    const lumaSubsolar = await baseLumaAt(T_SUBSOLAR)
    const lumaNearTerm = await baseLumaAt(T_NEAR_TERMINATOR)
    expect(lumaNearTerm, '近晨昏线昼侧底面亮度应 > 0').toBeGreaterThan(0)
    const subRatio = lumaSubsolar / lumaNearTerm
    expect(
      subRatio,
      `昼半球内「次日点 : 近晨昏线昼侧」= ${lumaSubsolar.toFixed(2)}/${lumaNearTerm.toFixed(2)} = ` +
        `${subRatio.toFixed(3)}，应 ≥ 1.3（昼半球须有内部梯度、非平涂空盘，SPEC-3.2a 副判据/SPEC-3.2①）`,
    ).toBeGreaterThanOrEqual(1.3)

    // 前置旁证（从上四点推导，非独立 SPEC 判据）：亮度随离日角单调——次日点 > 昼±40°点 >
    // 近晨昏昼点 > 夜端，坐实「连续柔和衰减」而非阶跃/平涂（SPEC-3.2①）
    expect(lumaSubsolar).toBeGreaterThan(lumaDay)
    expect(lumaDay).toBeGreaterThan(lumaNearTerm)
    expect(lumaNearTerm).toBeGreaterThan(lumaNight)

    // --- 视觉存证（视觉场景须附截图）：斜射太阳使晨昏线横贯可见盘面，人工判读柔和昼夜梯度 ---
    // sunDir 主分量偏 x：次日点移到画面右侧，晨昏线扫过盘面中左，昼半球连续衰减 + 一线夜侧可见。
    await page.mouse.click(400, 300)
    await setEarthRotationY(page, 0)
    const beautyDir = { x: 0.86, y: 0.16, z: 0.48 } // 归一化后主判据无关，仅供人工视觉判读
    await setSunDirVector(page, beautyDir)
    await page.waitForTimeout(150)
    await waitNextFrame(page)
    await samplePixelBoxStable(page, cx, cy, 3) // 稳门后截图
    await page.screenshot({ path: 'test-results/day-night-hemisphere-contrast.png' })
  })
})
