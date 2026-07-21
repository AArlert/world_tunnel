import type { Page } from '@playwright/test'
import type { GeoEvent } from '../src/data'

/**
 * GlobeScene 的 DEV-only 调试钩子（`window.__globeDebug`，锁在 import.meta.env.DEV
 * 分支，生产构建不含，见 src/globe/GlobeScene.ts）对外暴露结构中，本文件测试用到的
 * 最小字段集合。只做黑盒读取，不依赖其内部实现细节。
 */
export type DebugHook = {
  globe: {
    camera: { fov: number; position: { x: number; y: number; z: number } }
    markerRoot: {
      rotation: { y: number }
      children: { geometry?: { type: string; parameters: Record<string, number> } }[]
    }
    /** GlobeScene.scene（挂星空的场景根，SPEC-3.5：星空不受地球自转影响），
     * 本文件目前只用它来定位星空对象、读取其 type/rotation/position 做黑盒不变量校验。 */
    scene: {
      children: {
        type: string
        rotation: { x: number; y: number; z: number }
        position: { x: number; y: number; z: number }
      }[]
    }
  }
}

export type Sample = {
  x: number
  y: number
  z: number
  fov: number
  earthRotY: number
}

/**
 * 等待 GlobeScene 构造完成、`window.__globeDebug` 就绪。
 * React StrictMode 下 App 的 effect 会挂载两次（mount→unmount→remount），
 * 多等一小段真实时间让最终存活的实例稳定下来，避免读到中途被 dispose 的实例。
 */
export async function waitForGlobeDebug(page: Page) {
  await page.waitForFunction(() =>
    Boolean((window as unknown as { __globeDebug?: unknown }).__globeDebug),
  )
  await page.waitForTimeout(150)
}

/** 等待至少经过一次渲染帧，确保 window.__globeDebug 暴露的 camera 反映最新的拖拽/惯性状态
 * （GlobeScene 的相机位姿在 requestAnimationFrame 回调里才从 controls 状态同步到 camera 对象，
 * 而 pointermove 处理是同步的——这里用双重 rAF 兜底，避免读到上一帧的陈旧位置导致测试误判）。 */
export async function waitNextFrame(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )
}

export async function sampleCamera(page: Page): Promise<Sample> {
  return page.evaluate(() => {
    const dbg = (window as unknown as { __globeDebug: DebugHook }).__globeDebug
    const p = dbg.globe.camera.position
    return {
      x: p.x,
      y: p.y,
      z: p.z,
      fov: dbg.globe.camera.fov,
      earthRotY: dbg.globe.markerRoot.rotation.y,
    }
  })
}

export type Object3DSample = {
  type: string
  rotation: { x: number; y: number; z: number }
  position: { x: number; y: number; z: number }
}

/** 在 scene.children 中按 three.js 内建 `type` 字段定位星空对象（THREE.Points 唯一实例，
 * 见 src/globe/starfield.ts createStarfield() 返回值类型），读取其姿态用于验证
 * 「空闲自转作用于地球本体，星空不动」（SPEC-7.3 / SPEC-3.5）的黑盒不变量，
 * 不依赖星空内部实现（点数、分布半径等）。 */
export async function sampleStarfieldPose(page: Page): Promise<Object3DSample> {
  return page.evaluate(() => {
    const dbg = (window as unknown as { __globeDebug: DebugHook }).__globeDebug
    const starfield = dbg.globe.scene.children.find((c) => c.type === 'Points')
    if (!starfield) throw new Error('星空对象（THREE.Points）未在 scene.children 中找到')
    return {
      type: starfield.type,
      rotation: { x: starfield.rotation.x, y: starfield.rotation.y, z: starfield.rotation.z },
      position: { x: starfield.position.x, y: starfield.position.y, z: starfield.position.z },
    }
  })
}

export async function sampleEarthGeometry(page: Page) {
  return page.evaluate(() => {
    const dbg = (window as unknown as { __globeDebug: DebugHook }).__globeDebug
    const earthMesh = dbg.globe.markerRoot.children.find(
      (c) => c.geometry?.type === 'SphereGeometry',
    )
    return {
      radius: earthMesh?.geometry?.parameters.radius,
      widthSegments: earthMesh?.geometry?.parameters.widthSegments,
      heightSegments: earthMesh?.geometry?.parameters.heightSegments,
    }
  })
}

export type Vec3 = { x: number; y: number; z: number }

/**
 * M1-05/M1-14 共用的校准仪器：直接改写地球材质的 `uSunDir` uniform（SPEC-4.5 定义的
 * 太阳方向向量）。SPEC-3.6 原文即注明"M1 校准场景验证"允许注入已知 sunDir 排除真实
 * 时刻偶发把校准点置于夜半球的问题；本函数只对已知 uniform 名赋值，不解析/移植
 * fragment shader 的混合公式。定位地球网格的方式与 sampleEarthGeometry 一致
 * （markerRoot.children 中找 SphereGeometry 网格），material 是 THREE.Mesh 的公开
 * 属性（不涉及读取 GlobeScene 的私有字段）。
 */
export async function setSunDir(page: Page, dir: Vec3) {
  await page.evaluate((d) => {
    const dbg = (window as unknown as { __globeDebug: DebugHook }).__globeDebug
    const earth = dbg.globe.markerRoot.children.find(
      (c) => c.geometry?.type === 'SphereGeometry',
    ) as unknown as
      | { material: { uniforms: { uSunDir: { value: Vec3 & { set(x: number, y: number, z: number): void } } } } }
      | undefined
    if (!earth) throw new Error('地球网格（SphereGeometry）未在 markerRoot.children 中找到')
    earth.material.uniforms.uSunDir.value.set(d.x, d.y, d.z)
  }, dir)
}

/**
 * 矢量默认风格专用（SPEC-3.2②）的 setSunDir：矢量地球由三个独立 ShaderMaterial 组成
 * （底面 base + 海岸线 coast + 网格 grid，见 src/globe/vectorEarth.ts），各自持有独立的
 * `uSunDir` uniform 对象——base 直接是 markerRoot.children 中的 SphereGeometry 网格，
 * coast/grid 是该网格的子节点（LineSegments）。M1 沿用的 `setSunDir` 只对 base 网格自身
 * 赋值（卫星风格 src/globe/earth.ts 只有单一材质，够用），矢量风格下若只调用它，
 * coast/grid 的 uSunDir 不受控、仍由 GlobeScene 每 60s 用真实时刻写入（SPEC-4.5），
 * 与 base 的注入值不同步。本函数在 base 网格的基础上再递归遍历其子节点，把同一 dir
 * 写入每个含 uSunDir uniform 的材质——与 setSunDir 同样只对已知 uniform 名赋值，
 * 不解析/移植 fragment shader 的混合公式。
 */
type SunDirTarget = {
  material?: { uniforms?: { uSunDir?: { value: Vec3 & { set(x: number, y: number, z: number): void } } } }
  children?: SunDirTarget[]
}

export async function setSunDirVector(page: Page, dir: Vec3) {
  await page.evaluate((d) => {
    const dbg = (window as unknown as { __globeDebug: DebugHook }).__globeDebug
    const earth = dbg.globe.markerRoot.children.find(
      (c) => c.geometry?.type === 'SphereGeometry',
    ) as unknown as SunDirTarget | undefined
    if (!earth) throw new Error('地球网格（SphereGeometry）未在 markerRoot.children 中找到')
    const targets: SunDirTarget[] = [earth, ...(earth.children ?? [])]
    for (const obj of targets) {
      const uniform = obj.material?.uniforms?.uSunDir
      if (uniform) uniform.value.set(d.x, d.y, d.z)
    }
  }, dir)
}

/**
 * 读回地球材质当前的 `uSunDir`（SPEC-4.5：由真实时刻驱动，GlobeScene 每 60s 更新一次）。
 * M1-14 用它把取样点由「写死坐标」改为「从当前太阳方向反算」——直下点全天扫过所有经度，
 * 可见半球存在全为夜侧的时刻，写死取样点必出偶发红。只读一个已知 uniform 的值，
 * 不解析/移植 fragment shader 的混合公式。
 */
export async function readSunDir(page: Page): Promise<Vec3> {
  return page.evaluate(() => {
    const dbg = (window as unknown as { __globeDebug: DebugHook }).__globeDebug
    const earth = dbg.globe.markerRoot.children.find(
      (c) => c.geometry?.type === 'SphereGeometry',
    ) as unknown as { material: { uniforms: { uSunDir: { value: Vec3 } } } } | undefined
    if (!earth) throw new Error('地球网格（SphereGeometry）未在 markerRoot.children 中找到')
    const v = earth.material.uniforms.uSunDir.value
    return { x: v.x, y: v.y, z: v.z }
  })
}

/**
 * 改写地球材质的 `uNightGain` uniform（SPEC-3.3 的夜景亮度增益）。M1-14 的自变量：
 * 同一取样点、只改这一个 uniform，比较渲染结果变/不变。与 setSunDir 同样只对已知
 * uniform 名赋值，不读取/移植 shader 源码。传入值须自身满足 SPEC-3.3 的 ≥1.5 约束
 * （调用方保证），本函数不做校验。
 */
export async function setNightGain(page: Page, gain: number) {
  await page.evaluate((g) => {
    const dbg = (window as unknown as { __globeDebug: DebugHook }).__globeDebug
    const earth = dbg.globe.markerRoot.children.find(
      (c) => c.geometry?.type === 'SphereGeometry',
    ) as unknown as { material: { uniforms: { uNightGain: { value: number } } } } | undefined
    if (!earth) throw new Error('地球网格（SphereGeometry）未在 markerRoot.children 中找到')
    earth.material.uniforms.uNightGain.value = g
  }, gain)
}

/**
 * 直接写地球本体（markerRoot）的 rotation.y——与 SPEC-7.3 空闲自转施加增量的字段
 * 完全同一个属性，此处只是测试内一次性赋绝对值，不解析/移植自转实现。用于把指定经度
 * （模型空间，SPEC-6.2 约定）转到相机默认视角正对的画布几何中心，从而不必逐点计算
 * 透视投影就能在同一像素采样任意经度（推导见 day-night-calibration.spec.ts 头注）。
 */
export async function setEarthRotationY(page: Page, rad: number) {
  await page.evaluate((r) => {
    const dbg = (window as unknown as { __globeDebug: DebugHook }).__globeDebug
    dbg.globe.markerRoot.rotation.y = r
  }, rad)
}

/** 等待地球昼/夜纹理从占位 1x1 DataTexture 替换为真实素材（SPEC-3.2：纹理就绪前占位、
 * 就绪后直接替换）。只读 `isDataTexture` 标志判断纹理种类，不依赖具体像素/尺寸。 */
export async function waitForRealEarthTexture(page: Page) {
  await page.waitForFunction(() => {
    const dbg = (window as unknown as { __globeDebug?: DebugHook }).__globeDebug
    if (!dbg) return false
    const earth = dbg.globe.markerRoot.children.find(
      (c) => c.geometry?.type === 'SphereGeometry',
    ) as unknown as
      | { material?: { uniforms?: { uDayMap?: { value?: { isDataTexture?: boolean } } } } }
      | undefined
    const value = earth?.material?.uniforms?.uDayMap?.value
    if (!value) return false
    return value.isDataTexture !== true
  })
}

/**
 * 风格无关的渲染稳定门：等待地表材质的 `uSunDir` uniform 已挂载真实向量值。
 * 与 `waitForRealEarthTexture` 的区别——那个门读卫星专属的 `uDayMap`（矢量默认风格下
 * 该 uniform 恒不存在，等待永不 resolve，见 BUG-020）；`uSunDir` 则是 SPEC-3.2① 定义的
 * 跨风格昼夜数学的共同输入，矢量（src/globe/vectorEarth.ts）与卫星（src/globe/earth.ts）
 * 两条路径的地表材质都在 GlobeScene 构造函数内、`window.__globeDebug` 挂载之前同步赋值
 * 该 uniform（各自的 createVectorEarth/createEarth 均在 earthGroup.add 之后才设置调试钩子）。
 * 用于与底图风格无关的场景（如 SPEC-3.4 大气辉光，覆盖对象是大气本身、不依赖地表纹理
 * 是否为真实卫星图像）的显式渲染就绪判定，不写死等待时长。
 */
export async function waitForSurfaceReady(page: Page) {
  await page.waitForFunction(() => {
    const dbg = (window as unknown as { __globeDebug?: DebugHook }).__globeDebug
    if (!dbg) return false
    const earth = dbg.globe.markerRoot.children.find(
      (c) => c.geometry?.type === 'SphereGeometry',
    ) as unknown as { material?: { uniforms?: { uSunDir?: { value?: unknown } } } } | undefined
    return Boolean(earth?.material?.uniforms?.uSunDir?.value)
  })
}

/**
 * M2-10/M2-11 用：经调试钩子驱动 GlobeScene.setEvents（公开方法，见
 * src/globe/GlobeScene.ts），以构造数据确定性注入标记层，不依赖真实网络轮询
 * （任务卡明确要求：事件注入用构造数据经 debug 钩子/setEvents 驱动）。
 * `window.__globeDebug.globe` 在 GlobeScene 构造函数里被赋值为 `this`（GlobeScene 实例
 * 本身），故除 DebugHook 类型窄化暴露的字段外，其公开方法（含 setEvents）在运行时同样
 * 可达；此处仅为 page.evaluate 内的调用补一个局部类型断言，不改 src/。
 */
export async function setDebugEvents(page: Page, events: GeoEvent[]) {
  await page.evaluate((evts) => {
    const dbg = (
      window as unknown as { __globeDebug: { globe: { setEvents(e: GeoEvent[]): void } } }
    ).__globeDebug
    dbg.globe.setEvents(evts)
  }, events)
}

/** 地球 canvas 实际 WebGL 绘图缓冲尺寸（设备像素，已含 devicePixelRatio 缩放）。 */
export async function canvasBufferSize(page: Page): Promise<{ width: number; height: number }> {
  return page.evaluate(() => {
    const canvas = document.querySelector('#globe-container canvas') as HTMLCanvasElement
    return { width: canvas.width, height: canvas.height }
  })
}

/**
 * samplePixelBox 的稳定版：重复采样直到连续两次读数足够接近（判定为渲染已跟上最新一次
 * uniform/状态更新），而不是像 waitNextFrame 那样赌固定帧数。全量回归下多个 e2e worker
 * 并发占满 GPU 时，固定帧数等待偶发不足，读到上一次状态渲染结果的陈旧帧（已实测复现：
 * 期望值随之明显偏离）；轮询到稳定为止对系统负载的适应性更好。达到最大尝试次数仍不稳定
 * 时返回最后一次读数，交由调用方自身的断言容差把关。
 */
export async function samplePixelBoxStable(
  page: Page,
  x: number,
  y: number,
  size = 1,
  maxAttempts = 14,
): Promise<[number, number, number]> {
  let prev = await samplePixelBox(page, x, y, size)
  let stableStreak = 0
  for (let i = 1; i < maxAttempts; i++) {
    await page.waitForTimeout(90)
    const cur = await samplePixelBox(page, x, y, size)
    const stable = Math.abs(cur[0] - prev[0]) <= 1 && Math.abs(cur[1] - prev[1]) <= 1 && Math.abs(cur[2] - prev[2]) <= 1
    prev = cur
    // 连续两次都判定为"稳定"才采信：只看一次相邻匹配无法排除"长期卡在同一陈旧帧、
    // 每次都恰好读到同一个值"的情形（那种情形第一次比较也会误判为稳定）
    stableStreak = stable ? stableStreak + 1 : 0
    if (stableStreak >= 2) break
  }
  return prev
}

/**
 * 直接从 `<canvas>` 元素本身回读像素（drawImage 到离屏 2D 画布再 getImageData），
 * 不经页面截图合成——不受同页其它 DOM 覆盖层（如 SPEC-2.2 的 side-panel）影响。
 * GlobeScene 的 WebGLRenderer 未开启 preserveDrawingBuffer（合理的生产配置，本文件
 * 不要求 src 为测试改动），绘图缓冲在下一次合成后即可能被清空，因此必须在
 * requestAnimationFrame 回调内同步完成 drawImage+getImageData——GlobeScene 自身的
 * animate() 循环持续用 requestAnimationFrame 重渲染，此处注册的回调会排在同一帧内
 * 其渲染之后执行，读到的是刚渲染完、尚未被合成清空的内容（已用独立调试脚本核实：
 * 帧外读取恒为 (0,0,0,0)，帧内读取能取到真实像素）。坐标为设备像素（与
 * canvasBufferSize 返回的宽高同一坐标系）。size>1 时返回以 (x,y) 为中心的正方形
 * 取样框内平均色，用于抑制单像素噪声（如背景星点、抗锯齿边缘）。
 */
export async function samplePixelBox(
  page: Page,
  x: number,
  y: number,
  size = 1,
): Promise<[number, number, number]> {
  return page.evaluate(
    ({ x, y, size }) =>
      new Promise<[number, number, number]>((resolve) => {
        requestAnimationFrame(() => {
          const canvas = document.querySelector('#globe-container canvas') as HTMLCanvasElement
          const off = document.createElement('canvas')
          off.width = canvas.width
          off.height = canvas.height
          const ctx = off.getContext('2d')!
          ctx.drawImage(canvas, 0, 0)
          const half = Math.floor(size / 2)
          const sx = Math.min(Math.max(0, Math.round(x) - half), canvas.width - 1)
          const sy = Math.min(Math.max(0, Math.round(y) - half), canvas.height - 1)
          const w = Math.max(1, Math.min(size, canvas.width - sx))
          const h = Math.max(1, Math.min(size, canvas.height - sy))
          const data = ctx.getImageData(sx, sy, w, h).data
          let r = 0
          let g = 0
          let b = 0
          const n = data.length / 4
          for (let i = 0; i < data.length; i += 4) {
            r += data[i]
            g += data[i + 1]
            b += data[i + 2]
          }
          resolve([r / n, g / n, b / n])
        })
      }),
    { x, y, size },
  )
}

/**
 * 在 canvas 指定矩形区域内逐像素扫描，找出颜色落在目标色 ± tolerance（各通道独立）
 * 范围内的像素，返回命中总数与**第一个命中像素**的坐标（设备像素，保证该坐标本身
 * 就是一个命中像素——不用重心/平均坐标，因为对曲线状分布（如海岸线）重心未必落在
 * 曲线上）。返回坐标可直接喂给 samplePixelBox 等函数复测同一像素在其他状态下的颜色。
 * 用于 M2-15：黑盒定位 SPEC-3.2a pin 的某已知色（底面/海岸线/网格昼端色）在画布上的
 * 实际渲染位置，不依赖透视投影计算或经纬度换算，也不解析渲染实现——只是把
 * samplePixelBox 的"读一个像素"换成"读一个区域再按颜色筛选"。帧内同步读取的原因
 * 与 samplePixelBox 一致（见其注释）。
 */
export async function findColorInRegion(
  page: Page,
  region: { x: number; y: number; width: number; height: number },
  target: [number, number, number],
  tolerance: number,
): Promise<{ count: number; x: number; y: number } | null> {
  return page.evaluate(
    ({ region, target, tolerance }) =>
      new Promise<{ count: number; x: number; y: number } | null>((resolve) => {
        requestAnimationFrame(() => {
          const canvas = document.querySelector('#globe-container canvas') as HTMLCanvasElement
          const off = document.createElement('canvas')
          off.width = canvas.width
          off.height = canvas.height
          const ctx = off.getContext('2d')!
          ctx.drawImage(canvas, 0, 0)
          const data = ctx.getImageData(region.x, region.y, region.width, region.height).data
          let count = 0
          let first: { x: number; y: number } | null = null
          for (let py = 0; py < region.height; py++) {
            for (let px = 0; px < region.width; px++) {
              const i = (py * region.width + px) * 4
              const r = data[i]
              const g = data[i + 1]
              const b = data[i + 2]
              if (
                Math.abs(r - target[0]) <= tolerance &&
                Math.abs(g - target[1]) <= tolerance &&
                Math.abs(b - target[2]) <= tolerance
              ) {
                count += 1
                if (!first) first = { x: region.x + px, y: region.y + py }
              }
            }
          }
          resolve(count === 0 || !first ? null : { count, x: first.x, y: first.y })
        })
      }),
    { region, target, tolerance },
  )
}

/**
 * M2-10 用：在 canvas 指定矩形区域内逐像素扫描，找出与给定 `background` 参照色偏差
 * （各通道差之和）超过 `threshold` 的像素，返回其包围盒（设备像素）与命中数。
 * 与 findColorInRegion 的区别——那个函数按「是否落在某个已知目标色附近」筛选，本函数
 * 按「是否明显偏离背景参照色」筛选，不预设脉冲光环实际渲染色的具体数值（脉冲环用
 * AdditiveBlending 与背景混合，混合后的确切颜色属实现细节，不应作为期望值写进断言）。
 * 用途：量测标记 + 脉冲光环的整体像素footprint 包围盒宽度，作为
 * 「标记基础尺寸与脉冲光环幅度随 severity 递增」（SPEC-3.7）的序关系代理——与
 * e2e/atmosphere-glow.spec.ts 用「blueness 偏移量」代替「断言辉光具体颜色值」是同一类
 * 手法。background 参照色由调用方在场景内实测取得（如同一像素在未放置标记前的颜色），
 * 不是从 spec 推导的期望色值。
 */
export async function boundingBoxOfDeviation(
  page: Page,
  region: { x: number; y: number; width: number; height: number },
  background: [number, number, number],
  threshold: number,
): Promise<{ minX: number; maxX: number; minY: number; maxY: number; count: number } | null> {
  return page.evaluate(
    ({ region, background, threshold }) =>
      new Promise<{ minX: number; maxX: number; minY: number; maxY: number; count: number } | null>(
        (resolve) => {
          requestAnimationFrame(() => {
            const canvas = document.querySelector('#globe-container canvas') as HTMLCanvasElement
            const off = document.createElement('canvas')
            off.width = canvas.width
            off.height = canvas.height
            const ctx = off.getContext('2d')!
            ctx.drawImage(canvas, 0, 0)
            const data = ctx.getImageData(region.x, region.y, region.width, region.height).data
            let minX = Infinity
            let maxX = -Infinity
            let minY = Infinity
            let maxY = -Infinity
            let count = 0
            for (let py = 0; py < region.height; py++) {
              for (let px = 0; px < region.width; px++) {
                const i = (py * region.width + px) * 4
                const r = data[i]
                const g = data[i + 1]
                const b = data[i + 2]
                const delta =
                  Math.abs(r - background[0]) + Math.abs(g - background[1]) + Math.abs(b - background[2])
                if (delta > threshold) {
                  count += 1
                  const gx = region.x + px
                  const gy = region.y + py
                  if (gx < minX) minX = gx
                  if (gx > maxX) maxX = gx
                  if (gy < minY) minY = gy
                  if (gy > maxY) maxY = gy
                }
              }
            }
            resolve(count === 0 ? null : { minX, maxX, minY, maxY, count })
          })
        },
      ),
    { region, background, threshold },
  )
}

/**
 * M2-13 用：黑盒读取当前标记层已绘制的实例数（= 球面已加载事件标记数），用于比对事件流
 * 面板的列表条目数（SPEC-2.2「事件流面板」定名即事件列表语义）。定位方式与
 * sampleEarthGeometry/sampleStarfieldPose 同一手法——在 markerRoot.children 中按
 * three.js 内建 `type` 字段区分（地表底面是 'Mesh'，标记层根节点是 markers.ts
 * 里的 `readonly object = new THREE.Group()`，type 为 'Group'，全场景仅此一个 Group），
 * 再读其首个子节点（dots，InstancedMesh）的公开 `.count` 属性（渲染实例高水位）。
 * 只读公开的 Object3D 结构与 three.js 标准 InstancedMesh API，不触碰 GlobeScene/
 * MarkerLayer 的私有字段。
 */
export async function sampleMarkerCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const dbg = (window as unknown as { __globeDebug: DebugHook }).__globeDebug
    const markerGroup = dbg.globe.markerRoot.children.find(
      (c) => (c as unknown as { type?: string }).type === 'Group',
    ) as unknown as { children: { count: number }[] } | undefined
    if (!markerGroup) throw new Error('标记层根节点（Group）未在 markerRoot.children 中找到')
    return markerGroup.children[0]?.count ?? 0
  })
}

/**
 * M2-21 用：黑盒读取标记层每个渲染实例的当前透明度（instanceAlpha，dots 自定义 shader
 * 的 per-instance alpha 通道 `gl_FragColor = vec4(vColor, vAlpha)`，即直接决定该标记被
 * 渲染出的可见透明度）与其模型空间平移向量（instanceMatrix 第 12/13/14 元素 = 标记落点
 * 位置，由事件 lat/lon 经 SPEC-6.2 换算得到）。用途：按 lat/lon（SPEC-6.2 换算得的方向）
 * 识别特定标记实例，逐帧采样其 alpha，验证 SPEC-3.11 呼吸式过渡「旧标记渐隐 / 新标记
 * 渐亮 / 既有标记连续可见」的可见状态随时间连续变化。只读 three.js 标准 InstancedMesh
 * 的公开属性（instanceMatrix / geometry attribute），定位方式与 sampleMarkerCount 同一
 * 手法（markerRoot 下唯一 Group 的首个子节点 = dots InstancedMesh），不触碰 MarkerLayer
 * 私有字段、不读取任何实现常量（过渡时长/步长等均不作断言期望值）。
 */
export async function sampleMarkerInstances(
  page: Page,
): Promise<{ alpha: number; tx: number; ty: number; tz: number }[]> {
  return page.evaluate(() => {
    const dbg = (window as unknown as { __globeDebug: DebugHook }).__globeDebug
    const markerGroup = dbg.globe.markerRoot.children.find(
      (c) => (c as unknown as { type?: string }).type === 'Group',
    ) as unknown as
      | {
          children: {
            count: number
            instanceMatrix: { array: ArrayLike<number> }
            geometry: { attributes: { instanceAlpha: { array: ArrayLike<number> } } }
          }[]
        }
      | undefined
    if (!markerGroup) throw new Error('标记层根节点（Group）未在 markerRoot.children 中找到')
    const dots = markerGroup.children[0]
    const mat = dots.instanceMatrix.array
    const alpha = dots.geometry.attributes.instanceAlpha.array
    const out: { alpha: number; tx: number; ty: number; tz: number }[] = []
    for (let i = 0; i < dots.count; i++) {
      out.push({
        alpha: alpha[i],
        tx: mat[i * 16 + 12],
        ty: mat[i * 16 + 13],
        tz: mat[i * 16 + 14],
      })
    }
    return out
  })
}

/**
 * M3-03 用：黑盒读取标记层「环」实例（脉冲/柔光光环层）的当前均匀缩放 scale 与模型空间平移。
 * SPEC-3.7 发光通道分层（sev1 无辉光 / sev2 静态柔光环 / sev3 持续脉冲环）为对外可见硬判据，
 * REV-013 §3.1 明示「发光通道……直接断存在性」。环是否被渲染取决于其实例矩阵的均匀缩放
 * （scale=0 即不可见、无环；scale>0 且恒定 = 静态环；scale>0 且随时间起伏 = 脉冲环）——本函数
 * 只读该 scale 的存在性/时变性，不断言其具体数值（环尺寸/脉冲幅度属实现自由度，SPEC-3.7）。
 *
 * 定位方式与 sampleMarkerInstances 同一手法：markerRoot 下唯一 Group 的**第二个**子节点
 * （dots=children[0] 是标记点、rings=children[1] 是光环层，见 src/globe/markers.ts 两层
 * InstancedMesh 结构），读其 instanceMatrix 公开数组。均匀缩放 = 上左 3×3 首列向量长度
 * `sqrt(m0²+m1²+m2²)`（compose(pos,quat,scale) 下各列长度均等于 scale）；平移取矩阵第
 * 12/13/14 元素（= 标记落点，供按 lat/lon 识别是哪一档 severity 的环）。只读 three.js 标准
 * InstancedMesh API，不触碰 MarkerLayer 私有字段、不读取任何实现常量。
 */
export async function sampleMarkerRings(
  page: Page,
): Promise<{ scale: number; tx: number; ty: number; tz: number }[]> {
  return page.evaluate(() => {
    const dbg = (window as unknown as { __globeDebug: DebugHook }).__globeDebug
    const markerGroup = dbg.globe.markerRoot.children.find(
      (c) => (c as unknown as { type?: string }).type === 'Group',
    ) as unknown as
      | { children: { count: number; instanceMatrix: { array: ArrayLike<number> } }[] }
      | undefined
    if (!markerGroup) throw new Error('标记层根节点（Group）未在 markerRoot.children 中找到')
    const rings = markerGroup.children[1]
    if (!rings) throw new Error('光环层（rings，Group 第二个子节点）未找到')
    const m = rings.instanceMatrix.array
    const out: { scale: number; tx: number; ty: number; tz: number }[] = []
    for (let i = 0; i < rings.count; i++) {
      const m0 = m[i * 16]
      const m1 = m[i * 16 + 1]
      const m2 = m[i * 16 + 2]
      out.push({
        scale: Math.sqrt(m0 * m0 + m1 * m1 + m2 * m2),
        tx: m[i * 16 + 12],
        ty: m[i * 16 + 13],
        tz: m[i * 16 + 14],
      })
    }
    return out
  })
}

/**
 * M2-21 用：黑盒读取标记层根 Group 的直接子节点数。SPEC-3.8「标记用 instancing/点精灵，
 * 不逐事件建 Mesh」——markers.ts 以 dots + rings 两层 InstancedMesh 承载全部标记，子节点
 * 数恒为 2、不随事件数增长。用于验证增删（呼吸过渡）过程中仍保持 instancing、不整表
 * 重建为逐事件 Mesh。只读公开 Object3D 结构，不触碰私有字段。
 */
export async function markerGroupChildCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const dbg = (window as unknown as { __globeDebug: DebugHook }).__globeDebug
    const g = dbg.globe.markerRoot.children.find(
      (c) => (c as unknown as { type?: string }).type === 'Group',
    ) as unknown as { children: unknown[] } | undefined
    if (!g) throw new Error('标记层根节点（Group）未在 markerRoot.children 中找到')
    return g.children.length
  })
}

/**
 * M3-02 用（C-2 量测方法「亮像素排除阈值」）：以 (x,y) 为中心读取 size×size 取样框，逐子像素
 * 计算 **gamma 编码 Rec.709 luma**（`0.2126R'+0.7152G'+0.0722B'`，直接对 0–255 sRGB 值加权、
 * 不线性化，与 aes §0 基线同法、REV-013 C-2 定死的亮度定义），排除 luma 高于 `brightLumaThreshold`
 * 的结构性亮像素（如海岸线/网格/标记），返回剩余像素的平均 sRGB 与被排除数 `excluded`/总数 `total`。
 * 昼夜半球对比的底面采样须排除结构线像素、只量底面本身，此为 C-2「亮像素排除阈值」的落地。
 * 帧内同步读取的原因与 samplePixelBox 一致（见其注释）。阈值取值依据由调用方从量测几何推导、
 * 在测试注释定稿，本函数不预设。
 */
export async function sampleBoxExcludingBright(
  page: Page,
  x: number,
  y: number,
  size: number,
  brightLumaThreshold: number,
): Promise<{ r: number; g: number; b: number; excluded: number; total: number }> {
  return page.evaluate(
    ({ x, y, size, brightLumaThreshold }) =>
      new Promise<{ r: number; g: number; b: number; excluded: number; total: number }>((resolve) => {
        requestAnimationFrame(() => {
          const canvas = document.querySelector('#globe-container canvas') as HTMLCanvasElement
          const off = document.createElement('canvas')
          off.width = canvas.width
          off.height = canvas.height
          const ctx = off.getContext('2d')!
          ctx.drawImage(canvas, 0, 0)
          const half = Math.floor(size / 2)
          const sx = Math.min(Math.max(0, Math.round(x) - half), canvas.width - 1)
          const sy = Math.min(Math.max(0, Math.round(y) - half), canvas.height - 1)
          const w = Math.max(1, Math.min(size, canvas.width - sx))
          const h = Math.max(1, Math.min(size, canvas.height - sy))
          const data = ctx.getImageData(sx, sy, w, h).data
          let r = 0
          let g = 0
          let b = 0
          let kept = 0
          let excluded = 0
          const total = data.length / 4
          for (let i = 0; i < data.length; i += 4) {
            const luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
            if (luma > brightLumaThreshold) {
              excluded += 1
              continue
            }
            r += data[i]
            g += data[i + 1]
            b += data[i + 2]
            kept += 1
          }
          const n = kept > 0 ? kept : 1
          resolve({ r: r / n, g: g / n, b: b / n, excluded, total })
        })
      }),
    { x, y, size, brightLumaThreshold },
  )
}

/**
 * M3-04 用：在 canvas 指定矩形区域内逐像素计算 **gamma 编码 Rec.709 luma**
 * （`0.2126R'+0.7152G'+0.0722B'`，直接对 0-255 sRGB 值加权、不线性化，与
 * day-night-hemisphere-contrast.spec.ts C-2 亮度定义同法），返回区域内最大 luma 值与其
 * 像素坐标（设备像素，供断言失败时定位是哪个像素）。不预设星点具体颜色/位置/数量，只在
 * 给定安全区域内找最亮像素，用于「星最大亮度不高于某已知色」（SPEC-3.5）一类相对上限判据。
 * 帧内同步读取的原因与 samplePixelBox 一致（见其注释）。
 */
export async function maxLumaInRegion(
  page: Page,
  region: { x: number; y: number; width: number; height: number },
): Promise<{ maxLuma: number; x: number; y: number }> {
  return page.evaluate(
    ({ region }) =>
      new Promise<{ maxLuma: number; x: number; y: number }>((resolve) => {
        requestAnimationFrame(() => {
          const canvas = document.querySelector('#globe-container canvas') as HTMLCanvasElement
          const off = document.createElement('canvas')
          off.width = canvas.width
          off.height = canvas.height
          const ctx = off.getContext('2d')!
          ctx.drawImage(canvas, 0, 0)
          const data = ctx.getImageData(region.x, region.y, region.width, region.height).data
          let maxLuma = -1
          let mx = -1
          let my = -1
          for (let py = 0; py < region.height; py++) {
            for (let px = 0; px < region.width; px++) {
              const i = (py * region.width + px) * 4
              const luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
              if (luma > maxLuma) {
                maxLuma = luma
                mx = region.x + px
                my = region.y + py
              }
            }
          }
          resolve({ maxLuma, x: mx, y: my })
        })
      }),
    { region },
  )
}

/**
 * BUG-022 复验用：在 canvas 指定矩形区域内统计"近白/饱和"像素——三通道同时 ≥ minChannel
 * 的像素（即 min(R,G,B) ≥ minChannel）。纯白 (255,255,255) 与近白不属 SPEC-3.7 六分类色
 * 表中任何分类色（该表六色的 min 通道均 ≤ 127），也不属两分类色普通透明混合的结果（红缺
 * 蓝绿、蓝缺红，凸组合无法令三通道同高），故区域内成片出现近白像素即"脉冲环加色混合
 * 饱和成白"缺陷的判别特征。返回近白像素数 `count` 与区域内 min(R,G,B) 的最大值 `peak`
 * （供断言失败时定位实际最白像素的饱和程度）。帧内同步读取的原因与 samplePixelBox 一致
 * （见其注释）。阈值 minChannel 的取值依据由调用方从 SPEC-3.7 推导，本函数不预设。
 */
export async function countNearWhite(
  page: Page,
  region: { x: number; y: number; width: number; height: number },
  minChannel: number,
): Promise<{ count: number; peak: number }> {
  return page.evaluate(
    ({ region, minChannel }) =>
      new Promise<{ count: number; peak: number }>((resolve) => {
        requestAnimationFrame(() => {
          const canvas = document.querySelector('#globe-container canvas') as HTMLCanvasElement
          const off = document.createElement('canvas')
          off.width = canvas.width
          off.height = canvas.height
          const ctx = off.getContext('2d')!
          ctx.drawImage(canvas, 0, 0)
          const data = ctx.getImageData(region.x, region.y, region.width, region.height).data
          let count = 0
          let peak = 0
          for (let i = 0; i < data.length; i += 4) {
            const m = Math.min(data[i], data[i + 1], data[i + 2])
            if (m > peak) peak = m
            if (m >= minChannel) count += 1
          }
          resolve({ count, peak })
        })
      }),
    { region, minChannel },
  )
}
