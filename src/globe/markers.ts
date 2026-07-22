import * as THREE from 'three'
import type { Category, GeoEvent } from '../data'
import { latLonToVector3 } from './geo'
import { pillarFragmentShader, pillarVertexShader } from './shaders/markers'

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

/** severity 柱高（世界半径 R=1，SPEC-3.7a pin 值）：sev1/sev2/sev3 = 0.05/0.09/0.15 R（比 1:1.8:3.0）。 */
export const SEVERITY_PILLAR_HEIGHT: Record<1 | 2 | 3, number> = { 1: 0.05, 2: 0.09, 3: 0.15 }

const MARKER_R = 1.02 // 标记根落点半径：浮于底面(1.0)/海岸线(1.001)之上，在大气壳前方可见（SPEC-3.4）
const PILLAR_BASE_RADIUS = 0.01 // 根半径 r0：等径、全 severity 恒定（SPEC-3.7a）
const HIGHLIGHT_SCALE = 1.8 // 联动高亮：光柱加宽（中性强调，不改柱高以免与 severity 编码相混，DP §4.4）
const FADE_DURATION_MS = 500 // 呼吸过渡时长：alpha 0↔1 全程用时；按真实毫秒推进，取值克制（D3 宁静，SPEC-3.11/7.5）
const PICK_MARGIN = 0.02 // 拾取代理球相对半高的外扩量（覆盖柱身宽度与手感容差，DP §4.4）
const INITIAL_CAPACITY = 256 // instancing 初始容量，超出翻倍扩容（SPEC-3.8）
const RENDER_ORDER = 10 // 晚于大气壳绘制，保证标记不被大气遮挡（SPEC-3.4）

// 复用的临时对象，避免每帧/每实例分配（单线程 JS 安全复用）
const _pos = new THREE.Vector3()
const _axis = new THREE.Vector3()
const _identityQuat = new THREE.Quaternion()
const _color = new THREE.Color()
const _mat = new THREE.Matrix4()
const _scale = new THREE.Vector3()
const _invWorld = new THREE.Matrix4()
const _ray = new THREE.Ray()
const _pickSphere = new THREE.Sphere()
const _hit = new THREE.Vector3()

export interface MarkerLayer {
  readonly object: THREE.Object3D
  /** 全量事件 → 标记；按 id diff 增删改，不整表重建（SPEC-3.7/3.8；呼吸增量登离场 SPEC-3.11） */
  setEvents(events: readonly GeoEvent[]): void
  /** 列表→标记：高亮某事件（null=清除）（SPEC-7.4） */
  setHighlight(id: string | null): void
  /** 标记→列表：raycaster 命中最近标记的事件 id，未命中 null（SPEC-7.4；仅高亮，不触发动作） */
  pick(raycaster: THREE.Raycaster): string | null
  /**
   * 呼吸过渡推进（登场 alpha 0→1、离场 1→0）；RAF 内每帧调用，elapsedMs 为帧间隔（SPEC-3.11/7.5）。
   * 无进行中的过渡时对 GPU 零写入——稳态两帧无差异（无脉冲/无持续动画，SPEC-3.11a）。
   */
  tick(elapsedMs: number): void
  /** reduced-motion 降级（SPEC-3.11a）：开启时增量呼吸瞬切（登离场瞬时完成）；默认 false */
  setReducedMotion(enabled: boolean): void
  dispose(): void
}

export function createMarkerLayer(): MarkerLayer {
  return new MarkerLayerImpl()
}

/**
 * 事件标记 instancing 层：单个 InstancedMesh——径向站立的等径体积光柱（billboard 软四边面片）。
 * 逐实例携根位置（instanceMatrix 平移列）/柱身分级色（instanceColor）/呼吸 alpha（instanceAlpha）；
 * 子节点恒为 1、不随事件数增长（SPEC-3.7/3.7a/3.8）。柱高按 severity 分层（SPEC-3.7a），
 * 常驻态全静止、无脉冲（SPEC-3.7）；呼吸仅用于增量登离场（SPEC-3.11），reduced-motion 下瞬切（SPEC-3.11a）。
 */
class MarkerLayerImpl implements MarkerLayer {
  readonly object = new THREE.Group()

  private readonly pillarMaterial: THREE.ShaderMaterial

  private pillars!: THREE.InstancedMesh
  private pillarGeometry!: THREE.BufferGeometry
  private pillarAlphaAttr!: THREE.InstancedBufferAttribute // per-instance 呼吸透明度（SPEC-3.11 观测通道）
  private capacity = 0

  // 槽位状态（大小 = capacity）：severity=0 表示空槽
  private slotId: (string | null)[] = []
  private slotSeverity = new Uint8Array(0)
  private slotPos = new Float32Array(0)
  private slotColor = new Float32Array(0)
  private slotAlpha = new Float32Array(0) // 逐槽当前透明度，tick 按真实毫秒推向 slotTarget（SPEC-3.11）
  private slotTarget = new Uint8Array(0) // 逐槽目标透明度：1=活跃/登场，0=离场（到 0 释放）/空槽

  private readonly indexOf = new Map<string, number>()
  private readonly fadingId = new Map<string, number>() // 离场中的 id→槽：尚未释放，供复活与容量核算
  private readonly free: number[] = []
  private count = 0 // 高水位（= mesh.count 绘制数），空槽零缩放隐藏
  private highlightedId: string | null = null
  private hasPopulated = false // 首个非空快照即时上屏（冷启动缓存不淡入），此后新增才呼吸登场（SPEC-3.11）
  private reducedMotion = false // OS reduced-motion：登离场瞬切、不走呼吸过渡（SPEC-3.11a）

  constructor() {
    this.pillarMaterial = new THREE.ShaderMaterial({
      vertexShader: pillarVertexShader,
      fragmentShader: pillarFragmentShader,
      transparent: true, // 承载呼吸 alpha + 径向软边/尖端软消散；常规 alpha 混合（screen 归切片②）
      depthWrite: false, // 不写深度避免柱间 z-fight；depthTest 仍开，球体遮住背面柱（SPEC-3.7a）
      side: THREE.DoubleSide, // billboard 双面可见，免朝向翻转被剔除
    })
    this.buildMeshes(INITIAL_CAPACITY)
  }

  setEvents(events: readonly GeoEvent[]): void {
    const incoming = new Set<string>()
    for (const e of events) incoming.add(e.id)

    // 移除：现有 id 不在本次快照 → reduced-motion 立即熄灭释放；否则转入离场（tick 推 alpha→0 后释放），
    // 不整表重建、不立即回收槽（SPEC-3.11「旧标记渐隐熄灭」；SPEC-3.11a 瞬切）
    for (const [id, i] of this.indexOf) {
      if (!incoming.has(id)) {
        this.indexOf.delete(id)
        if (this.reducedMotion) {
          this.releaseSlot(i) // 瞬切离场：直接熄灭释放（SPEC-3.11a）
        } else {
          this.fadingId.set(id, i)
          this.slotTarget[i] = 0
        }
      }
    }
    // 扩容：活跃(events.length) + 离场中(fadingId)槽仍各占一位，取上界确保容量足够（SPEC-3.8）
    this.ensureCapacity(events.length + this.fadingId.size)
    // 增/改：新增分配槽；已存在原地改写位置/severity/颜色（this.count 由分配时高水位维护）
    for (const e of events) this.upsertEvent(e)

    this.pillars.count = this.count
    this.pillars.instanceMatrix.needsUpdate = true
    this.pillars.instanceColor!.needsUpdate = true
    this.pillarAlphaAttr.needsUpdate = true // 新增/复活/瞬切槽的 alpha 下发
    // 标记数据变更后置空包围球缓存（BUG-021）：本切片 pick 改为手动求交、不依赖它，但保留置空
    // 以防未来回退几何 raycast，并避免渲染器 sort 读到 count=0 首帧缓存的陈旧空球（SPEC-7.4）。
    this.pillars.boundingSphere = null

    // 首个非空快照即视为已上屏：其后新增标记才呼吸登场（冷启动缓存即时可见，SPEC-3.11）
    if (events.length > 0) this.hasPopulated = true
  }

  setHighlight(id: string | null): void {
    if (id === this.highlightedId) return
    const prev = this.highlightedId
    this.highlightedId = id
    // 仅重算受影响的两个槽的光柱矩阵（加宽/复位），无需触碰其他实例
    for (const target of [prev, id]) {
      if (target === null) continue
      const i = this.indexOf.get(target)
      if (i !== undefined) this.writePillarMatrix(i)
    }
    this.pillars.instanceMatrix.needsUpdate = true
  }

  pick(raycaster: THREE.Raycaster): string | null {
    // billboard 细面不适合几何 raycast（DP §4.4）：将世界射线变换到标记模型空间，逐活跃光柱做
    // 包围球（柱身中点、半径≈半高+容差）求交，取最近命中的事件 id（SPEC-7.4）。
    this.object.updateWorldMatrix(true, false)
    _invWorld.copy(this.object.matrixWorld).invert()
    _ray.copy(raycaster.ray).applyMatrix4(_invWorld)
    let bestId: string | null = null
    let bestT = Infinity
    for (let i = 0; i < this.count; i++) {
      const sev = this.slotSeverity[i]
      // 空槽 / 离场中(target=0，已不属活跃集)不可拾取（SPEC-7.4）
      if (sev === 0 || this.slotTarget[i] === 0) continue
      _pos.fromArray(this.slotPos, i * 3)
      const h = SEVERITY_PILLAR_HEIGHT[sev as 1 | 2 | 3]
      _axis.copy(_pos).normalize()
      _pickSphere.center.copy(_pos).addScaledVector(_axis, h * 0.5) // 柱身中点
      _pickSphere.radius = h * 0.5 + PICK_MARGIN
      if (_ray.intersectSphere(_pickSphere, _hit) === null) continue
      const t = _ray.origin.distanceToSquared(_hit)
      if (t < bestT) {
        bestT = t
        bestId = this.slotId[i] ?? null
      }
    }
    return bestId
  }

  tick(elapsedMs: number): void {
    const dt = Math.max(0, elapsedMs)
    // 呼吸过渡步长：按真实毫秒推进，跨帧率等效（SPEC-7.5）；reduced-motion 下步长=1 即瞬切（SPEC-3.11a）
    const fadeStep = this.reducedMotion ? 1 : FADE_DURATION_MS > 0 ? dt / FADE_DURATION_MS : 1
    let alphaChanged = false
    let matrixChanged = false
    for (let i = 0; i < this.count; i++) {
      const sev = this.slotSeverity[i]
      if (sev === 0) continue
      const target = this.slotTarget[i]
      let alpha = this.slotAlpha[i]
      if (alpha === target) continue // 稳态：无过渡则不写，GPU 零写入（SPEC-3.11a）
      // 逐槽把 alpha 线性推向目标：登场(→1) / 离场(→0)（SPEC-3.11 呼吸过渡）
      alpha = target > alpha ? Math.min(target, alpha + fadeStep) : Math.max(target, alpha - fadeStep)
      this.slotAlpha[i] = alpha
      this.pillarAlphaAttr.setX(i, alpha)
      alphaChanged = true
      if (target === 0 && alpha === 0) {
        // 离场到 0 → 熄灭并释放槽位（SPEC-3.11 终态）
        this.releaseSlot(i)
        matrixChanged = true
      }
    }
    if (alphaChanged) this.pillarAlphaAttr.needsUpdate = true
    if (matrixChanged) this.pillars.instanceMatrix.needsUpdate = true
  }

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled
  }

  dispose(): void {
    this.object.remove(this.pillars)
    this.pillars.dispose()
    this.pillarGeometry.dispose()
    this.pillarMaterial.dispose()
  }

  // ---- 内部 ----

  private buildMeshes(capacity: number): void {
    // billboard 用单位平面（XY 面），上移半格使柱高方向 y∈[0,1]（根在 y=0，向径向外延伸）
    this.pillarGeometry = new THREE.PlaneGeometry(1, 1)
    this.pillarGeometry.translate(0, 0.5, 0)
    // 呼吸过渡透明度通道：默认 1（满态）；DynamicDrawUsage 因 tick 逐帧推进 alpha（SPEC-3.11/7.5）
    this.pillarAlphaAttr = new THREE.InstancedBufferAttribute(new Float32Array(capacity).fill(1), 1)
    this.pillarAlphaAttr.setUsage(THREE.DynamicDrawUsage)
    this.pillarGeometry.setAttribute('instanceAlpha', this.pillarAlphaAttr)
    this.pillars = new THREE.InstancedMesh(this.pillarGeometry, this.pillarMaterial, capacity)
    this.pillars.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3)
    this.pillars.frustumCulled = false // 实例散布全球，统一底面包围球会误剔除
    this.pillars.renderOrder = RENDER_ORDER
    this.pillars.count = this.count
    this.object.add(this.pillars) // 唯一子节点：children[0]（DP §3.1 观测契约 (a)）
    this.capacity = capacity

    // 扩容槽位状态数组并保留原值
    this.growSlotArrays(capacity)
  }

  private growSlotArrays(capacity: number): void {
    const sev = new Uint8Array(capacity)
    sev.set(this.slotSeverity)
    const pos = new Float32Array(capacity * 3)
    pos.set(this.slotPos)
    const col = new Float32Array(capacity * 3)
    col.set(this.slotColor)
    const alpha = new Float32Array(capacity)
    alpha.set(this.slotAlpha)
    const target = new Uint8Array(capacity)
    target.set(this.slotTarget)
    this.slotSeverity = sev
    this.slotPos = pos
    this.slotColor = col
    this.slotAlpha = alpha
    this.slotTarget = target
    this.slotId.length = capacity
  }

  private ensureCapacity(n: number): void {
    if (n <= this.capacity) return
    let cap = this.capacity
    while (cap < n) cap *= 2
    // 扩容：保留全部现存槽数据，重建更大的 instanced 网格（摊还，非逐更新重建）
    const oldPillars = this.pillars
    const oldGeo = this.pillarGeometry
    this.object.remove(oldPillars)

    this.buildMeshes(cap) // 置换 pillars/geometry/capacity，并扩容槽位数组
    this.refillAllSlots() // 依 metadata 回写全部槽

    oldPillars.dispose() // 释放旧 instanceMatrix/instanceColor GPU 缓冲
    oldGeo.dispose()
  }

  private refillAllSlots(): void {
    for (let i = 0; i < this.count; i++) {
      if (this.slotSeverity[i] === 0) {
        this.writePillarMatrix(i)
        continue
      }
      _color.setRGB(this.slotColor[i * 3], this.slotColor[i * 3 + 1], this.slotColor[i * 3 + 2])
      this.pillars.setColorAt(i, _color)
      this.pillarAlphaAttr.setX(i, this.slotAlpha[i]) // 保留呼吸过渡进度，扩容重建不打断（SPEC-3.11）
      this.writePillarMatrix(i)
    }
    this.pillars.count = this.count
    this.pillars.instanceMatrix.needsUpdate = true
    this.pillars.instanceColor!.needsUpdate = true
    this.pillarAlphaAttr.needsUpdate = true
  }

  private upsertEvent(e: GeoEvent): void {
    let i = this.indexOf.get(e.id)
    if (i === undefined) {
      const reviving = this.fadingId.get(e.id)
      if (reviving !== undefined) {
        // 离场中的同 id 重现：复活原槽，alpha 从当前值回升、不闪断（SPEC-3.11）
        this.fadingId.delete(e.id)
        i = reviving
      } else {
        i = this.free.length > 0 ? this.free.pop()! : this.count++
        // 首批 snap（冷启动缓存即时可见）或 reduced-motion 瞬切：alpha 直接满态；
        // 已上屏后新增标记才呼吸登场（alpha 从 0 起，SPEC-3.11/3.11a）
        this.slotAlpha[i] = this.hasPopulated && !this.reducedMotion ? 0 : 1
      }
      this.indexOf.set(e.id, i)
    }
    this.slotTarget[i] = 1 // 目标满态（新增登场 / 复活回升 / 活跃保持）
    this.slotId[i] = e.id
    this.slotSeverity[i] = e.severity

    // 根位置（模型空间，随 markerRoot 自转并与晨昏线对齐，SPEC-6.2）
    const p = latLonToVector3(e.lat, e.lon, MARKER_R)
    this.slotPos[i * 3] = p.x
    this.slotPos[i * 3 + 1] = p.y
    this.slotPos[i * 3 + 2] = p.z
    // severity 三通道分级色（SPEC-3.7 乘子规则；色相=分类不随 severity 变）
    deriveSeverityColor(_color, e.category, e.severity)
    this.slotColor[i * 3] = _color.r
    this.slotColor[i * 3 + 1] = _color.g
    this.slotColor[i * 3 + 2] = _color.b
    this.pillars.setColorAt(i, _color)
    this.pillarAlphaAttr.setX(i, this.slotAlpha[i]) // 下发当前呼吸 alpha

    this.writePillarMatrix(i)
  }

  /** 离场到 0 后释放槽位：退出离场登记、零缩放隐藏、回收槽供复用（SPEC-3.11「熄灭」终态） */
  private releaseSlot(i: number): void {
    const id = this.slotId[i]
    if (id !== null) this.fadingId.delete(id)
    this.slotSeverity[i] = 0
    this.slotId[i] = null
    this.slotAlpha[i] = 0
    this.slotTarget[i] = 0
    this.free.push(i)
    this.pillarAlphaAttr.setX(i, 0) // 熄灭：透明度归零（观测通道一致；needsUpdate 由调用方置位）
    this.writePillarMatrix(i) // sev=0 → 零缩放隐藏
  }

  /**
   * 写光柱实例矩阵：平移=根位置（DP §3.1 不变式 (c)，e2e helper 依赖），
   * 缩放 x/z=根半径 r0（联动高亮加宽）、y=柱高 H（SPEC-3.7a）；空/释放槽零缩放隐藏。
   * billboard 顶点着色器按矩阵列长解出宽/高，故径向朝向无需 quat（由根位置在着色器内归一化派生）。
   */
  private writePillarMatrix(i: number): void {
    _pos.fromArray(this.slotPos, i * 3)
    const sev = this.slotSeverity[i]
    if (sev === 0) {
      _scale.setScalar(0) // 空/释放槽：零缩放隐藏
    } else {
      const widen = this.slotId[i] === this.highlightedId ? HIGHLIGHT_SCALE : 1
      _scale.set(PILLAR_BASE_RADIUS * widen, SEVERITY_PILLAR_HEIGHT[sev as 1 | 2 | 3], PILLAR_BASE_RADIUS * widen)
    }
    _mat.compose(_pos, _identityQuat, _scale)
    this.pillars.setMatrixAt(i, _mat)
  }
}
