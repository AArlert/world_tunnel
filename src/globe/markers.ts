import * as THREE from 'three'
import type { Category, GeoEvent } from '../data'
import { latLonToVector3 } from './geo'

/**
 * 六分类色表，逐字照 SPEC-3.7。唯一事实源：标记 instanceColor 与面板分类色圆点
 * （SPEC-2.2a①）均取此表，DEV 不得另立色值（行为泄漏禁区）。
 */
export const CATEGORY_COLORS: Record<Category, number> = {
  disaster: 0xff4d4f,
  conflict: 0xff7a45,
  humanitarian: 0xffc53d,
  news: 0x40a9ff,
  launch: 0xb37feb,
  flight: 0x5cdbd3,
}

/**
 * severity 明度/饱和三通道分层的 HSL 乘子（SPEC-3.7，乘子规则为权威契约）：
 * sev3 = 分类 pin 色本身；sev2 = S×0.82/L×0.93；sev1 = S×0.60/L×0.82（色相不动）。
 * spec 六类分级值为按此规则派生，故此处只存乘子、从 CATEGORY_COLORS 计算，不硬编码 hex。
 */
const SEVERITY_HSL_MUL: Record<1 | 2 | 3, { s: number; l: number }> = {
  3: { s: 1.0, l: 1.0 },
  2: { s: 0.82, l: 0.93 },
  1: { s: 0.6, l: 0.82 },
}

const _deriveHsl = { h: 0, s: 0, l: 0 }
const _cssColor = new THREE.Color()

/**
 * 派生 severity 分级色写入 out（HSL 变换在 sRGB 空间进行，与 spec 派生参考值一致）：
 * 色相恒为分类色相不随 severity 变（SPEC-3.7），仅明度/饱和按乘子降。out 存 linear rgb 供 instanceColor。
 */
export function deriveSeverityColor(out: THREE.Color, category: Category, severity: 1 | 2 | 3): THREE.Color {
  out.set(CATEGORY_COLORS[category]) // sev3 = 分类 pin 色本身
  if (severity === 3) return out
  const m = SEVERITY_HSL_MUL[severity]
  out.getHSL(_deriveHsl, THREE.SRGBColorSpace)
  out.setHSL(_deriveHsl.h, _deriveHsl.s * m.s, _deriveHsl.l * m.l, THREE.SRGBColorSpace)
  return out
}

/** severity 分级色的 sRGB hex 字符串：供事件流面板行首点镜像球面标记（SPEC-2.2a，同一乘子契约）。 */
export function severityCategoryCss(category: Category, severity: 1 | 2 | 3): string {
  return '#' + deriveSeverityColor(_cssColor, category, severity).getHexString(THREE.SRGBColorSpace)
}

/** severity 基础尺寸（世界半径），随级别递增（SPEC-3.7）；具体数值属实现自由度。 */
export const SEVERITY_BASE_SIZE: Record<1 | 2 | 3, number> = { 1: 0.012, 2: 0.017, 3: 0.023 }

/** severity 脉冲光环幅度（相对基准张缩比例），随级别递增（SPEC-3.7）；具体数值属实现自由度。 */
export const SEVERITY_PULSE_AMP: Record<1 | 2 | 3, number> = { 1: 0.2, 2: 0.45, 3: 0.8 }

const MARKER_R = 1.02 // 标记落点半径：浮于底面(1.0)/海岸线(1.001)之上，在大气壳前方可见（SPEC-3.4）
const RING_SCALE = 2.4 // 脉冲环相对标记基础尺寸的倍率（光环包住标记）
const HIGHLIGHT_SCALE = 1.8 // 联动高亮：标记放大（中性信号，不引入新色彩语义，DP §2.4）
const PULSE_PERIOD_MS = 1600 // 脉冲周期；按累加真实毫秒驱动，跨帧率等效（SPEC-7.5）
const FADE_DURATION_MS = 500 // 呼吸过渡时长：alpha 0↔1 全程用时；按真实毫秒推进，取值克制（D3 宁静，SPEC-3.11/7.5）
const INITIAL_CAPACITY = 256 // instancing 初始容量，超出翻倍扩容（SPEC-3.8）
const RENDER_ORDER = 10 // 晚于大气壳绘制，保证标记不被大气遮挡（SPEC-3.4）

// 标记点自定义 shader：per-instance 颜色 + 预留 per-instance 透明度通道（FM-09 呼吸过渡，DP §2.2）。
// three 为 InstancedMesh 自动声明 instanceMatrix / instanceColor，此处仅补 instanceAlpha 与手工变换。
const dotVertexShader = /* glsl */ `
attribute float instanceAlpha;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = instanceColor;
  vAlpha = instanceAlpha;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`
const dotFragmentShader = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  gl_FragColor = vec4(vColor, vAlpha);
  #include <colorspace_fragment>
}
`

// 复用的临时对象，避免每帧/每实例分配（单线程 JS 安全复用）
const _pos = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _identityQuat = new THREE.Quaternion()
const _color = new THREE.Color()
const _mat = new THREE.Matrix4()
const _scale = new THREE.Vector3()
const _normal = new THREE.Vector3()
const RING_LOCAL_NORMAL = new THREE.Vector3(0, 0, 1) // RingGeometry 默认法线 +Z

export interface MarkerLayer {
  readonly object: THREE.Object3D
  /** 全量事件 → 标记；按 id diff 增删改，不整表重建（SPEC-3.7/3.8；为 FM-09 呼吸预留 §2.2/2.4） */
  setEvents(events: readonly GeoEvent[]): void
  /** 列表→标记：高亮某事件（null=清除）（SPEC-7.4） */
  setHighlight(id: string | null): void
  /** 标记→列表：raycaster 命中最近标记的事件 id，未命中 null（SPEC-7.4；仅高亮，不触发动作） */
  pick(raycaster: THREE.Raycaster): string | null
  /** 脉冲动画推进（sev3 持续脉冲环，SPEC-3.7）；RAF 内每帧调用，elapsedMs 为帧间隔，内部累加（SPEC-7.5） */
  tick(elapsedMs: number): void
  dispose(): void
}

export function createMarkerLayer(): MarkerLayer {
  return new MarkerLayerImpl()
}

/**
 * 事件标记 instancing 层：dots（分类色 + severity 基础尺寸 + 联动高亮 + 拾取目标）
 * 与 rings（脉冲光环，幅度随 severity 递增、sev3 持续脉冲）两层 InstancedMesh，
 * 共用一份 id→槽位映射；子节点数恒为 2、不随事件数增长（SPEC-3.8）。
 */
class MarkerLayerImpl implements MarkerLayer {
  readonly object = new THREE.Group()

  private readonly dotMaterial: THREE.ShaderMaterial
  private readonly ringMaterial: THREE.MeshBasicMaterial

  private dots!: THREE.InstancedMesh
  private rings!: THREE.InstancedMesh
  private dotGeometry!: THREE.BufferGeometry
  private ringGeometry!: THREE.BufferGeometry
  private dotAlphaAttr!: THREE.InstancedBufferAttribute // dots 的 per-instance 透明度（呼吸过渡，SPEC-3.11）
  private capacity = 0

  // 槽位状态（大小 = capacity）：severity=0 表示空槽
  private slotId: (string | null)[] = []
  private slotSeverity = new Uint8Array(0)
  private slotPos = new Float32Array(0)
  private slotQuat = new Float32Array(0)
  private slotColor = new Float32Array(0)
  private slotAlpha = new Float32Array(0) // 逐槽当前透明度，tick 按真实毫秒推向 slotTarget（SPEC-3.11）
  private slotTarget = new Uint8Array(0) // 逐槽目标透明度：1=活跃/淡入，0=淡出（到 0 释放）/空槽

  private readonly indexOf = new Map<string, number>()
  private readonly fadingId = new Map<string, number>() // 淡出中的 id→槽：尚未释放，供复活与容量核算
  private readonly free: number[] = []
  private count = 0 // 高水位（= mesh.count 绘制数），空槽零缩放隐藏
  private highlightedId: string | null = null
  private timeMs = 0
  private hasPopulated = false // 首个非空快照即时上屏（冷启动缓存不淡入），此后新增才呼吸淡入（SPEC-3.11）

  constructor() {
    this.dotMaterial = new THREE.ShaderMaterial({
      vertexShader: dotVertexShader,
      fragmentShader: dotFragmentShader,
      transparent: true, // 承载 per-instance alpha 通道；alpha 恒 1 时呈不透明
      depthWrite: false, // 不写深度，避免小标记互相 z-fight；depthTest 仍开，球体正常遮挡背面标记
    })
    this.ringMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      // 普通透明混合（BUG-022）：加色混合下密集区多环叠加会各通道累加饱和成白，
      // 白不属 SPEC-3.7 分类色表，破坏「分类色为唯一色语义」。普通混合的叠加结果
      // 收敛于该分类色本身、绝不越过其色域趋白；近黑球面背景下单环观感与加色几乎等同。
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    })
    this.buildMeshes(INITIAL_CAPACITY)
  }

  setEvents(events: readonly GeoEvent[]): void {
    const incoming = new Set<string>()
    for (const e of events) incoming.add(e.id)

    // 移除：现有 id 不在本次快照 → 转入淡出（保留渲染，tick 将 alpha 推向 0 后释放槽位），
    // 不整表重建、不立即回收槽（SPEC-3.11「旧标记渐隐熄灭」/DP §2.2）
    for (const [id, i] of this.indexOf) {
      if (!incoming.has(id)) {
        this.indexOf.delete(id)
        this.fadingId.set(id, i)
        this.slotTarget[i] = 0
      }
    }
    // 扩容：活跃(events.length) + 淡出中(fadingId)槽仍各占一位，取上界确保容量足够（SPEC-3.8）
    this.ensureCapacity(events.length + this.fadingId.size)
    // 增/改：新增分配槽；已存在原地改写位置/severity/颜色（this.count 由分配时高水位维护）
    for (const e of events) this.upsertEvent(e)

    this.dots.count = this.count
    this.rings.count = this.count
    this.dots.instanceMatrix.needsUpdate = true
    this.rings.instanceMatrix.needsUpdate = true
    this.dots.instanceColor!.needsUpdate = true
    this.rings.instanceColor!.needsUpdate = true
    this.dotAlphaAttr.needsUpdate = true // 新增/复活槽的 alpha 初值下发
    // 使 dots 的包围球缓存失效（BUG-021）：three.js 的 InstancedMesh.raycast()/渲染器 sortObjects
    // 均为「boundingSphere===null 才重算」的懒加载，不随 instanceMatrix/count 变化自动失效；
    // 首帧 count=0 时会被渲染器抢先算出并缓存一个空球体，此后 pick() 恒命中该陈旧空球提前返回。
    // 此处置 null（不在此处同步重算），下一次 raycast()/render 会按当前 instance 数据懒重算出正确球体，
    // 覆盖首帧空球场景，也覆盖 ensureCapacity 扩容重建后 this.dots 已替换为新实例的场景（SPEC-7.4）。
    this.dots.boundingSphere = null

    // 首个非空快照即视为已上屏：其后新增标记才呼吸淡入（冷启动缓存即时可见，SPEC-3.11）
    if (events.length > 0) this.hasPopulated = true
  }

  setHighlight(id: string | null): void {
    if (id === this.highlightedId) return
    const prev = this.highlightedId
    this.highlightedId = id
    // 仅重算受影响的两个槽的 dot 矩阵（放大/复位），无需触碰其他实例
    for (const target of [prev, id]) {
      if (target === null) continue
      const i = this.indexOf.get(target)
      if (i !== undefined) this.writeDotMatrix(i, this.dotSize(i))
    }
    this.dots.instanceMatrix.needsUpdate = true
  }

  pick(raycaster: THREE.Raycaster): string | null {
    const hits = raycaster.intersectObject(this.dots, false)
    for (const h of hits) {
      const idx = h.instanceId
      // 空槽零缩放通常不命中；淡出中(target=0)标记虽仍在渐隐渲染，但已不属活跃集，不可拾取（SPEC-7.4）
      if (idx == null || this.slotSeverity[idx] === 0 || this.slotTarget[idx] === 0) continue
      return this.slotId[idx] ?? null
    }
    return null
  }

  tick(elapsedMs: number): void {
    const dt = Math.max(0, elapsedMs)
    this.timeMs += dt
    const pulse01 = 0.5 + 0.5 * Math.sin((this.timeMs / PULSE_PERIOD_MS) * Math.PI * 2)
    // 呼吸过渡步长：按真实毫秒推进，跨帧率等效（SPEC-7.5 同款纪律）
    const fadeStep = FADE_DURATION_MS > 0 ? dt / FADE_DURATION_MS : 1
    let alphaChanged = false
    let dotMatrixChanged = false
    for (let i = 0; i < this.count; i++) {
      const sev = this.slotSeverity[i]
      if (sev === 0) continue
      let alpha = this.slotAlpha[i]
      const target = this.slotTarget[i]
      if (alpha !== target) {
        // 逐槽把 alpha 线性推向目标：淡入(→1) / 淡出(→0)（SPEC-3.11 呼吸过渡）
        alpha =
          target > alpha ? Math.min(target, alpha + fadeStep) : Math.max(target, alpha - fadeStep)
        this.slotAlpha[i] = alpha
        this.dotAlphaAttr.setX(i, alpha)
        alphaChanged = true
        if (target === 0 && alpha === 0) {
          // 淡出到 0 → 熄灭并释放槽位（SPEC-3.11 终态）；本帧不再写脉冲
          this.releaseSlot(i)
          dotMatrixChanged = true
          continue
        }
      }
      // 环尺寸按 severity 分层（sev1 无环 / sev2 静态 / sev3 脉冲），并乘 alpha 与 dot 一同呼吸
      this.writeRingMatrix(i, this.ringSize(sev, alpha, pulse01))
    }
    this.rings.instanceMatrix.needsUpdate = true
    if (alphaChanged) this.dotAlphaAttr.needsUpdate = true
    if (dotMatrixChanged) this.dots.instanceMatrix.needsUpdate = true
  }

  dispose(): void {
    this.object.remove(this.dots, this.rings)
    this.dots.dispose()
    this.rings.dispose()
    this.dotGeometry.dispose()
    this.ringGeometry.dispose()
    this.dotMaterial.dispose()
    this.ringMaterial.dispose()
  }

  // ---- 内部 ----

  private buildMeshes(capacity: number): void {
    this.dotGeometry = new THREE.SphereGeometry(1, 8, 8)
    // 呼吸过渡透明度通道：默认 1（不透明）；DynamicDrawUsage 因 tick 每帧推进 alpha（SPEC-3.11/7.5）
    this.dotAlphaAttr = new THREE.InstancedBufferAttribute(new Float32Array(capacity).fill(1), 1)
    this.dotAlphaAttr.setUsage(THREE.DynamicDrawUsage)
    this.dotGeometry.setAttribute('instanceAlpha', this.dotAlphaAttr)
    this.dots = new THREE.InstancedMesh(this.dotGeometry, this.dotMaterial, capacity)
    this.dots.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3)

    this.ringGeometry = new THREE.RingGeometry(0.6, 1, 20)
    this.rings = new THREE.InstancedMesh(this.ringGeometry, this.ringMaterial, capacity)
    this.rings.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3)
    this.rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage) // ring 矩阵每帧更新

    for (const mesh of [this.dots, this.rings]) {
      mesh.frustumCulled = false // 实例散布全球，统一底面包围球会误剔除
      mesh.renderOrder = RENDER_ORDER
      mesh.count = this.count
    }
    this.object.add(this.dots, this.rings)
    this.capacity = capacity

    // 扩容槽位状态数组并保留原值
    this.growSlotArrays(capacity)
  }

  private growSlotArrays(capacity: number): void {
    const sev = new Uint8Array(capacity)
    sev.set(this.slotSeverity)
    const pos = new Float32Array(capacity * 3)
    pos.set(this.slotPos)
    const quat = new Float32Array(capacity * 4)
    quat.set(this.slotQuat)
    const col = new Float32Array(capacity * 3)
    col.set(this.slotColor)
    const alpha = new Float32Array(capacity)
    alpha.set(this.slotAlpha)
    const target = new Uint8Array(capacity)
    target.set(this.slotTarget)
    this.slotSeverity = sev
    this.slotPos = pos
    this.slotQuat = quat
    this.slotColor = col
    this.slotAlpha = alpha
    this.slotTarget = target
    this.slotId.length = capacity
  }

  private ensureCapacity(n: number): void {
    if (n <= this.capacity) return
    let cap = this.capacity
    while (cap < n) cap *= 2
    // 扩容：保留全部现存槽数据，重建更大的 instanced 网格（摊还，非逐更新重建，DP §2.2/4.2）
    const oldDots = this.dots
    const oldRings = this.rings
    const oldDotGeo = this.dotGeometry
    const oldRingGeo = this.ringGeometry
    this.object.remove(oldDots, oldRings)

    this.buildMeshes(cap) // 置换 dots/rings/geometry/capacity，并扩容槽位数组
    this.refillAllSlots() // 依 metadata 回写全部槽

    oldDots.dispose() // 释放旧 instanceMatrix/instanceColor GPU 缓冲
    oldRings.dispose()
    oldDotGeo.dispose()
    oldRingGeo.dispose()
  }

  private refillAllSlots(): void {
    for (let i = 0; i < this.count; i++) {
      const sev = this.slotSeverity[i]
      if (sev === 0) {
        this.writeDotMatrix(i, 0)
        this.writeRingMatrix(i, 0)
        continue
      }
      _color.setRGB(this.slotColor[i * 3], this.slotColor[i * 3 + 1], this.slotColor[i * 3 + 2])
      this.dots.setColorAt(i, _color)
      this.rings.setColorAt(i, _color)
      this.dotAlphaAttr.setX(i, this.slotAlpha[i]) // 保留呼吸过渡进度，扩容重建不打断（SPEC-3.11）
      this.writeDotMatrix(i, this.dotSize(i))
      this.writeRingMatrix(i, this.ringSize(sev, this.slotAlpha[i], 0))
    }
    this.dots.count = this.count
    this.rings.count = this.count
    this.dots.instanceMatrix.needsUpdate = true
    this.rings.instanceMatrix.needsUpdate = true
    this.dots.instanceColor!.needsUpdate = true
    this.rings.instanceColor!.needsUpdate = true
    this.dotAlphaAttr.needsUpdate = true
  }

  private upsertEvent(e: GeoEvent): void {
    let i = this.indexOf.get(e.id)
    if (i === undefined) {
      const reviving = this.fadingId.get(e.id)
      if (reviving !== undefined) {
        // 淡出中的同 id 重现：复活原槽，alpha 从当前值回升、不闪断（SPEC-3.11）
        this.fadingId.delete(e.id)
        i = reviving
      } else {
        i = this.free.length > 0 ? this.free.pop()! : this.count++
        // 冷启动缓存首屏即时可见（alpha=1）；已上屏后新增标记呼吸淡入（alpha 从 0 起，SPEC-3.11）
        this.slotAlpha[i] = this.hasPopulated ? 0 : 1
      }
      this.indexOf.set(e.id, i)
    }
    this.slotTarget[i] = 1 // 目标不透明（新增淡入 / 复活回升 / 活跃保持）
    this.slotId[i] = e.id
    this.slotSeverity[i] = e.severity

    // 位置（模型空间，随 markerRoot 自转并与晨昏线对齐，SPEC-6.2）
    const p = latLonToVector3(e.lat, e.lon, MARKER_R)
    this.slotPos[i * 3] = p.x
    this.slotPos[i * 3 + 1] = p.y
    this.slotPos[i * 3 + 2] = p.z
    // 脉冲环径向朝外的朝向（贴合球面切平面）
    _normal.copy(p).normalize()
    _quat.setFromUnitVectors(RING_LOCAL_NORMAL, _normal)
    this.slotQuat[i * 4] = _quat.x
    this.slotQuat[i * 4 + 1] = _quat.y
    this.slotQuat[i * 4 + 2] = _quat.z
    this.slotQuat[i * 4 + 3] = _quat.w
    // severity 三通道分级色（SPEC-3.7 乘子规则；色相=分类不随 severity 变）
    deriveSeverityColor(_color, e.category, e.severity)
    this.slotColor[i * 3] = _color.r
    this.slotColor[i * 3 + 1] = _color.g
    this.slotColor[i * 3 + 2] = _color.b
    this.dots.setColorAt(i, _color)
    this.rings.setColorAt(i, _color)
    this.dotAlphaAttr.setX(i, this.slotAlpha[i]) // 下发当前呼吸 alpha

    this.writeDotMatrix(i, this.dotSize(i)) // dot 尺寸与 alpha 无关：淡入淡出只调透明度不缩放
    this.writeRingMatrix(i, this.ringSize(e.severity, this.slotAlpha[i], 0)) // 基准；sev3 tick 每帧覆盖脉冲
  }

  /** 淡出到 0 后释放槽位：退出淡出登记、零缩放隐藏、回收槽供复用（SPEC-3.11「熄灭」终态） */
  private releaseSlot(i: number): void {
    const id = this.slotId[i]
    if (id !== null) this.fadingId.delete(id)
    this.slotSeverity[i] = 0
    this.slotId[i] = null
    this.slotAlpha[i] = 0
    this.slotTarget[i] = 0
    this.free.push(i)
    this.writeDotMatrix(i, 0) // 零缩放隐藏
    this.writeRingMatrix(i, 0)
  }

  private dotSize(i: number): number {
    const base = SEVERITY_BASE_SIZE[this.slotSeverity[i] as 1 | 2 | 3]
    return this.slotId[i] === this.highlightedId ? base * HIGHLIGHT_SCALE : base
  }

  private ringBase(sev: number): number {
    return SEVERITY_BASE_SIZE[sev as 1 | 2 | 3] * RING_SCALE
  }

  /**
   * severity 分层的环尺寸（SPEC-3.7 发光通道）：sev1 无辉光（0）、sev2 静态柔光环（无脉冲）、
   * sev3 持续脉冲环（pulse01 驱动，脉冲机制维持现状）。乘 alpha 与 dot 一同呼吸（SPEC-3.11）。
   */
  private ringSize(sev: number, alpha: number, pulse01: number): number {
    if (sev === 1) return 0
    if (sev === 3) return this.ringBase(sev) * (1 + SEVERITY_PULSE_AMP[3] * pulse01) * alpha
    return this.ringBase(sev) * alpha // sev2 静态柔光环
  }

  private writeDotMatrix(i: number, size: number): void {
    _pos.fromArray(this.slotPos, i * 3)
    _mat.compose(_pos, _identityQuat, _scale.setScalar(size))
    this.dots.setMatrixAt(i, _mat)
  }

  private writeRingMatrix(i: number, size: number): void {
    _pos.fromArray(this.slotPos, i * 3)
    _quat.fromArray(this.slotQuat, i * 4)
    _mat.compose(_pos, _quat, _scale.setScalar(size))
    this.rings.setMatrixAt(i, _mat)
  }
}
