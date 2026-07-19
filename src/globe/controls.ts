const DEG = Math.PI / 180

const MIN_DISTANCE = 1.8 // SPEC-7.2
const MAX_DISTANCE = 6 // SPEC-7.2
const INITIAL_DISTANCE = 3.2 // SPEC-3.1
const MIN_POLAR = 5 * DEG // 仰角 +85°（SPEC-7.1）
const MAX_POLAR = 175 * DEG // 仰角 −85°（SPEC-7.1）
const INITIAL_POLAR = 90 * DEG // 初始视角在赤道面（SPEC-3.1）

const FRAME_MS = 1000 / 60 // 每帧常量的时间基准（SPEC-7.5）
const MAX_FRAME_MS = 100 // dt 上限：切后台/断点恢复后钳位，避免单帧跳变（实现细节）
const DAMPING_PER_FRAME = 0.95 // SPEC-7.1
const SPIN_PER_FRAME = 0.02 * DEG // SPEC-7.3
const IDLE_DELAY_MS = 10000 // SPEC-7.3
const VELOCITY_EPSILON = 1e-5 // 惯性收敛阈值（弧度/帧）

// 手感参数属实现自由度（design-prompt §2.3），spec 不约束
const DRAG_SENSITIVITY = 0.005 // 弧度/像素
const WHEEL_SENSITIVITY = 0.001 // 每单位 deltaY 的相对距离变化

/** 相机球坐标：azimuth=0 且 polar=90° 时相机位于 +Z 轴（SPEC-3.1 + SPEC-6.2） */
export interface CameraState {
  azimuthRad: number
  polarRad: number
  distance: number
}

type ControlState = 'DRAG' | 'INERTIA' | 'IDLE_WAIT' | 'AUTO_SPIN'

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

/**
 * 地球交互状态机（SPEC-7.1 / 7.2 / 7.3 / 7.5）：
 * 拖拽与惯性作用于相机球坐标，空闲自转以增量形式产出、由调用方施加到地球本体。
 */
export class GlobeControls {
  private azimuthRad = 0
  private polarRad = INITIAL_POLAR
  private distance = INITIAL_DISTANCE

  private state: ControlState = 'IDLE_WAIT'
  /** 角速度，单位为「弧度 / 60fps 帧」 */
  private velAz = 0
  private velPol = 0

  private lastInputMs: number
  private lastFrameMs: number

  /** 活跃指针位置，用于拖拽与双指捏合 */
  private pointers = new Map<number, { x: number; y: number }>()
  private dragPointerId = -1
  private lastDragX = 0
  private lastDragY = 0
  private lastPinchDist = 0

  constructor(private dom: HTMLElement) {
    const now = performance.now()
    this.lastInputMs = now
    this.lastFrameMs = now

    // 否则移动端拖拽会被浏览器滚动手势吞掉
    dom.style.touchAction = 'none'
    dom.addEventListener('pointerdown', this.onPointerDown)
    dom.addEventListener('pointermove', this.onPointerMove)
    dom.addEventListener('pointerup', this.onPointerUp)
    dom.addEventListener('pointercancel', this.onPointerUp)
    dom.addEventListener('wheel', this.onWheel, { passive: false })
  }

  /**
   * 推进一帧：返回本帧相机状态与地球自转增量（弧度）。
   * `nowMs` 仅为可测性开放（固定帧率采样），生产调用不传参。
   */
  update(nowMs: number = performance.now()): { camera: CameraState; spinDeltaRad: number } {
    const dt = clamp(nowMs - this.lastFrameMs, 0, MAX_FRAME_MS)
    this.lastFrameMs = nowMs
    // 帧数归一化：每帧常量按 60fps 基准换算到实际帧间隔（SPEC-7.5）
    const frames = dt / FRAME_MS

    if (this.state === 'INERTIA') {
      this.azimuthRad += this.velAz * frames
      this.polarRad = clamp(this.polarRad + this.velPol * frames, MIN_POLAR, MAX_POLAR)
      const decay = Math.pow(DAMPING_PER_FRAME, frames)
      this.velAz *= decay
      this.velPol *= decay
      if (Math.hypot(this.velAz, this.velPol) < VELOCITY_EPSILON) {
        this.velAz = 0
        this.velPol = 0
        this.state = 'IDLE_WAIT'
      }
    }

    if (this.state === 'IDLE_WAIT' && nowMs - this.lastInputMs >= IDLE_DELAY_MS) {
      this.state = 'AUTO_SPIN'
    }

    const spinDeltaRad = this.state === 'AUTO_SPIN' ? SPIN_PER_FRAME * frames : 0

    return {
      camera: {
        azimuthRad: this.azimuthRad,
        polarRad: this.polarRad,
        distance: this.distance,
      },
      spinDeltaRad,
    }
  }

  dispose() {
    this.dom.removeEventListener('pointerdown', this.onPointerDown)
    this.dom.removeEventListener('pointermove', this.onPointerMove)
    this.dom.removeEventListener('pointerup', this.onPointerUp)
    this.dom.removeEventListener('pointercancel', this.onPointerUp)
    this.dom.removeEventListener('wheel', this.onWheel)
  }

  /** 任何输入都重置空闲计时并立即停自转（SPEC-7.3） */
  private markInput() {
    this.lastInputMs = performance.now()
    if (this.state === 'AUTO_SPIN') this.state = 'IDLE_WAIT'
  }

  private onPointerDown = (e: PointerEvent) => {
    this.markInput()
    this.velAz = 0
    this.velPol = 0
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    this.dom.setPointerCapture?.(e.pointerId)

    if (this.pointers.size === 1) {
      this.state = 'DRAG'
      this.dragPointerId = e.pointerId
      this.lastDragX = e.clientX
      this.lastDragY = e.clientY
    } else {
      // 进入双指捏合：本帧只记基准间距，不产生缩放
      this.state = 'IDLE_WAIT'
      this.lastPinchDist = this.pinchDistance()
    }
  }

  private onPointerMove = (e: PointerEvent) => {
    if (!this.pointers.has(e.pointerId)) return
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    this.markInput()

    if (this.pointers.size >= 2) {
      // 双指捏合缩放（SPEC-7.2）：间距变大 → 拉近
      const dist = this.pinchDistance()
      if (this.lastPinchDist > 0 && dist > 0) {
        this.setDistance(this.distance * (this.lastPinchDist / dist))
      }
      this.lastPinchDist = dist
      return
    }

    if (this.state !== 'DRAG' || e.pointerId !== this.dragPointerId) return
    // 拖拽作用于相机：向右拖动使镜头西移，画面跟手（SPEC-7.1）
    const dAz = -(e.clientX - this.lastDragX) * DRAG_SENSITIVITY
    const dPol = -(e.clientY - this.lastDragY) * DRAG_SENSITIVITY
    this.lastDragX = e.clientX
    this.lastDragY = e.clientY

    this.azimuthRad += dAz // 水平无限制（SPEC-7.1）
    this.polarRad = clamp(this.polarRad + dPol, MIN_POLAR, MAX_POLAR)
    // 瞬时角速度：以最后一次移动的增量作为释放时的初速度
    this.velAz = dAz
    this.velPol = dPol
  }

  private onPointerUp = (e: PointerEvent) => {
    if (!this.pointers.delete(e.pointerId)) return
    this.markInput()

    if (this.pointers.size === 1) {
      // 捏合退化为单指拖拽：以剩余指针为新基准，避免跳变
      const [id, p] = [...this.pointers.entries()][0]
      this.state = 'DRAG'
      this.dragPointerId = id
      this.lastDragX = p.x
      this.lastDragY = p.y
      this.velAz = 0
      this.velPol = 0
      return
    }
    if (this.pointers.size > 1) return

    this.lastPinchDist = 0
    this.dragPointerId = -1
    this.state = Math.hypot(this.velAz, this.velPol) > VELOCITY_EPSILON ? 'INERTIA' : 'IDLE_WAIT'
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault()
    this.markInput()
    this.setDistance(this.distance * (1 + e.deltaY * WHEEL_SENSITIVITY))
  }

  private setDistance(value: number) {
    this.distance = clamp(value, MIN_DISTANCE, MAX_DISTANCE)
  }

  private pinchDistance(): number {
    const [a, b] = [...this.pointers.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }
}
