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

/** severity 基础尺寸（世界半径），随级别递增（SPEC-3.7）；具体数值属实现自由度。 */
export const SEVERITY_BASE_SIZE: Record<1 | 2 | 3, number> = { 1: 0.012, 2: 0.017, 3: 0.023 }

/** severity 脉冲光环幅度（相对基准张缩比例），随级别递增（SPEC-3.7）；具体数值属实现自由度。 */
export const SEVERITY_PULSE_AMP: Record<1 | 2 | 3, number> = { 1: 0.2, 2: 0.45, 3: 0.8 }

const MARKER_R = 1.02 // 标记落点半径：浮于底面(1.0)/海岸线(1.001)之上，在大气壳前方可见（SPEC-3.4）
const RING_SCALE = 2.4 // 脉冲环相对标记基础尺寸的倍率（光环包住标记）
const HIGHLIGHT_SCALE = 1.8 // 联动高亮：标记放大（中性信号，不引入新色彩语义，DP §2.4）
const PULSE_PERIOD_MS = 1600 // 脉冲周期；按累加真实毫秒驱动，跨帧率等效（SPEC-7.5）
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
  private capacity = 0

  // 槽位状态（大小 = capacity）：severity=0 表示空槽
  private slotId: (string | null)[] = []
  private slotSeverity = new Uint8Array(0)
  private slotPos = new Float32Array(0)
  private slotQuat = new Float32Array(0)
  private slotColor = new Float32Array(0)

  private readonly indexOf = new Map<string, number>()
  private readonly free: number[] = []
  private count = 0 // 高水位（= mesh.count 绘制数），空槽零缩放隐藏
  private highlightedId: string | null = null
  private timeMs = 0

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

    // 移除：现有 id 不在本次快照 → 释放槽位（零缩放 + 回收 index），不整表重建（SPEC-3.11/DP §2.2）
    for (const [id, i] of this.indexOf) {
      if (!incoming.has(id)) this.freeSlot(id, i)
    }
    // 扩容：目标活跃数 = events.length（store 保证 id 唯一），确保容量足够（SPEC-3.8）
    this.ensureCapacity(events.length)
    // 增/改：新增分配槽；已存在原地改写位置/severity/颜色（this.count 由分配时高水位维护）
    for (const e of events) this.upsertEvent(e)

    this.dots.count = this.count
    this.rings.count = this.count
    this.dots.instanceMatrix.needsUpdate = true
    this.rings.instanceMatrix.needsUpdate = true
    this.dots.instanceColor!.needsUpdate = true
    this.rings.instanceColor!.needsUpdate = true
    // 使 dots 的包围球缓存失效（BUG-021）：three.js 的 InstancedMesh.raycast()/渲染器 sortObjects
    // 均为「boundingSphere===null 才重算」的懒加载，不随 instanceMatrix/count 变化自动失效；
    // 首帧 count=0 时会被渲染器抢先算出并缓存一个空球体，此后 pick() 恒命中该陈旧空球提前返回。
    // 此处置 null（不在此处同步重算），下一次 raycast()/render 会按当前 instance 数据懒重算出正确球体，
    // 覆盖首帧空球场景，也覆盖 ensureCapacity 扩容重建后 this.dots 已替换为新实例的场景（SPEC-7.4）。
    this.dots.boundingSphere = null
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
      if (idx == null || this.slotSeverity[idx] === 0) continue // 空槽零缩放，通常不产生命中
      return this.slotId[idx] ?? null
    }
    return null
  }

  tick(elapsedMs: number): void {
    this.timeMs += Math.max(0, elapsedMs)
    const pulse01 = 0.5 + 0.5 * Math.sin((this.timeMs / PULSE_PERIOD_MS) * Math.PI * 2)
    for (let i = 0; i < this.count; i++) {
      const sev = this.slotSeverity[i]
      if (sev === 0) continue
      const size = this.ringBase(sev) * (1 + SEVERITY_PULSE_AMP[sev as 1 | 2 | 3] * pulse01)
      this.writeRingMatrix(i, size)
    }
    this.rings.instanceMatrix.needsUpdate = true
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
    this.dotGeometry.setAttribute(
      'instanceAlpha',
      new THREE.InstancedBufferAttribute(new Float32Array(capacity).fill(1), 1),
    )
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
    this.slotSeverity = sev
    this.slotPos = pos
    this.slotQuat = quat
    this.slotColor = col
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
      this.writeDotMatrix(i, this.dotSize(i))
      this.writeRingMatrix(i, this.ringBase(sev))
    }
    this.dots.count = this.count
    this.rings.count = this.count
    this.dots.instanceMatrix.needsUpdate = true
    this.rings.instanceMatrix.needsUpdate = true
    this.dots.instanceColor!.needsUpdate = true
    this.rings.instanceColor!.needsUpdate = true
  }

  private upsertEvent(e: GeoEvent): void {
    let i = this.indexOf.get(e.id)
    if (i === undefined) {
      i = this.free.length > 0 ? this.free.pop()! : this.count++
      this.indexOf.set(e.id, i)
    }
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
    // 分类色（SPEC-3.7）
    _color.set(CATEGORY_COLORS[e.category])
    this.slotColor[i * 3] = _color.r
    this.slotColor[i * 3 + 1] = _color.g
    this.slotColor[i * 3 + 2] = _color.b
    this.dots.setColorAt(i, _color)
    this.rings.setColorAt(i, _color)

    this.writeDotMatrix(i, this.dotSize(i))
    this.writeRingMatrix(i, this.ringBase(e.severity)) // pulse=0 基准，tick 每帧覆盖
  }

  private freeSlot(id: string, i: number): void {
    this.indexOf.delete(id)
    this.slotSeverity[i] = 0
    this.slotId[i] = null
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
