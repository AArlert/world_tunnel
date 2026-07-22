import * as THREE from 'three'
import type { GeoEvent } from '../data'
import { createAtmosphere } from './atmosphere'
import { loadCoastline } from './coastline'
import { GlobeControls, type CameraState } from './controls'
import { createEarth } from './earth'
import { latLonToVector3 } from './geo'
import { createMarkerLayer, type MarkerLayer } from './markers'
import { createStarfield } from './starfield'
import { sunDirectionModel } from './sun'
import { createPlaceholderTextures, loadEarthTextures, type EarthTextures } from './textures'
import { createVectorEarth } from './vectorEarth'

const CAMERA_FOV = 45 // SPEC-3.1
const CAMERA_FAR = 200 // 须容纳星空球壳（半径 60）+ 相机距离上限（SPEC-3.5）
const SUN_UPDATE_MS = 60000 // SPEC-4.5 允许降频至 1 次/分钟

/** 地表风格开关：默认矢量（SPEC-3.2②）；satellite 仅 DEV/测试显式启用（BUG-020 方案 a）。 */
export interface GlobeSceneOptions {
  satellite?: boolean
}

/** 地表底面统一接口：矢量地球与卫星地球都提供 sunDir 写入口，dispose 仅矢量侧需要。 */
interface EarthSurface {
  setSunDir(dir: THREE.Vector3): void
  dispose?(): void
}

/**
 * 地球场景组合根：地表底面（默认矢量，SPEC-3.2②/3.2a/3.3）+ 大气 + 星空 + sunDir 驱动
 * （SPEC-3.1~3.6 / 4.5）+ 交互接线（SPEC-7.1~7.3、7.5，状态机在 controls.ts）。
 */
export class GlobeScene {
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  /** M2 事件标记层接入点：随地球自转的容器（SPEC-6.2 模型空间） */
  readonly markerRoot: THREE.Object3D

  /** 标记→列表：canvas 指针 hover 命中标记时回调（SPEC-7.4）；由 UI 层设置 */
  onMarkerHover?: (id: string | null) => void

  private renderer: THREE.WebGLRenderer
  private controls: GlobeControls
  private surface: EarthSurface
  private markerLayer: MarkerLayer
  /** 仅卫星风格持有昼夜纹理；矢量默认下为 undefined（SPEC-3.2③ 大纹理退出默认加载路径） */
  private textures?: EarthTextures
  private rafId = 0
  private resizeObserver: ResizeObserver
  private lastSunUpdate = 0
  private lastFrameMs = 0
  private disposed = false

  // hover 拾取（SPEC-7.4 marker→list）：指针移动时置脏，RAF 内合并求值一次（DP §4.3 节流）
  private raycaster = new THREE.Raycaster()
  private pointerNdc = new THREE.Vector2()
  private pointerDirty = false
  private lastHoveredId: string | null = null

  // reduced-motion 偏好监听（SPEC-3.11a）：透传标记层切呼吸瞬切/坡升
  private reducedMotionQuery?: MediaQueryList

  constructor(container: HTMLElement, options: GlobeSceneOptions = {}) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, CAMERA_FAR)
    // 相机位姿唯一来源是 controls 的球坐标；初始态即 (lat 0, lon 0) 正上方（SPEC-3.1）
    this.controls = new GlobeControls(this.renderer.domElement)
    this.applyCamera(this.controls.update().camera)

    // 地球组：初始自转角 0（SPEC-3.1），空闲自转与 M2 标记都挂在这里
    const earthGroup = new THREE.Object3D()
    this.markerRoot = earthGroup
    this.scene.add(earthGroup)

    // 事件标记层：挂进 markerRoot，随自转与晨昏线一并转动、天然对齐地理（SPEC-6.2/3.7/3.8）
    this.markerLayer = createMarkerLayer()
    earthGroup.add(this.markerLayer.object)

    // reduced-motion 接线（SPEC-3.11a，DP §3.5）：按 OS 偏好初始化并监听运行时变更；
    // 非浏览器环境（matchMedia 缺失）跳过——标记层默认 false（坡升）
    const mql = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (mql) {
      this.markerLayer.setReducedMotion(mql.matches)
      mql.addEventListener('change', this.onReducedMotionChange)
      this.reducedMotionQuery = mql
    }

    if (options.satellite) {
      // 卫星昼夜底图：非默认，仅 DEV/测试经 ?style=satellite 显式启用（BUG-020 方案 a）。
      // 资产保留供天气风格包复用（SPEC-3.9），默认 boot 不走此路径、不下载大纹理（SPEC-3.2③/3.10）。
      const textures = createPlaceholderTextures()
      const earth = createEarth(textures)
      this.textures = textures
      this.surface = earth
      earthGroup.add(earth.mesh)
      void this.applySatelliteTextures(earth)
    } else {
      // 默认轻量矢量风格：海岸线 + 经纬网格 + 昼夜明暗，免大纹理（SPEC-3.2②/3.2a/3.3、SPEC-3.10）。
      const vector = createVectorEarth(loadCoastline())
      this.surface = vector
      earthGroup.add(vector.object)
    }

    this.scene.add(createAtmosphere())
    // 星空挂 scene 根，不受地球自转影响（SPEC-3.5）
    this.scene.add(createStarfield())

    this.resizeObserver = new ResizeObserver(() => this.resize(container))
    this.resizeObserver.observe(container)
    this.resize(container)

    // hover 拾取监听：只读求交，与 GlobeControls 的指针事件共存、不阻断拖拽（DP §4.3）
    this.renderer.domElement.addEventListener('pointermove', this.onHoverMove)
    this.renderer.domElement.addEventListener('pointerleave', this.onHoverLeave)

    if (import.meta.env.DEV) {
      // DEV-only 校准钩子（SPEC-3.6 校准场景用），生产构建中整段被摇掉
      ;(window as unknown as { __globeDebug?: unknown }).__globeDebug = {
        globe: this,
        addCalibrationMarker: (lat: number, lon: number) => {
          const marker = new THREE.Mesh(
            new THREE.SphereGeometry(0.02, 12, 12),
            new THREE.MeshBasicMaterial({ color: 0xffffff }),
          )
          marker.position.copy(latLonToVector3(lat, lon, 1.01))
          earthGroup.add(marker)
        },
      }
    }

    const animate = () => {
      const { camera, spinDeltaRad } = this.controls.update()
      this.applyCamera(camera)
      // 空闲自转作用于地球本体，相机与星空不动（SPEC-7.3 / SPEC-3.5）
      earthGroup.rotation.y += spinDeltaRad
      this.updateSunDir()
      // 呼吸过渡按真实帧间隔推进，跨帧率等效；稳态无过渡时零写入（SPEC-3.11/3.11a/7.5）
      const nowMs = performance.now()
      this.markerLayer.tick(this.lastFrameMs === 0 ? 0 : nowMs - this.lastFrameMs)
      this.lastFrameMs = nowMs
      this.renderer.render(this.scene, this.camera)
      // 渲染后世界矩阵已更新，再做 hover 拾取（SPEC-7.4 marker→list）
      this.updateHover()
      this.rafId = requestAnimationFrame(animate)
    }
    animate()
  }

  /** 球坐标 → 相机位置，与 latLonToVector3(90−polar, azimuth) 同源（SPEC-6.2） */
  private applyCamera({ azimuthRad, polarRad, distance }: CameraState) {
    const sinPolar = Math.sin(polarRad)
    this.camera.position.set(
      distance * sinPolar * Math.sin(azimuthRad),
      distance * Math.cos(polarRad),
      distance * sinPolar * Math.cos(azimuthRad),
    )
    this.camera.lookAt(0, 0, 0)
  }

  /** 首帧立即算一次，此后节流为 60s 一次（SPEC-4.5） */
  private updateSunDir() {
    const now = performance.now()
    if (this.lastSunUpdate !== 0 && now - this.lastSunUpdate < SUN_UPDATE_MS) return
    this.lastSunUpdate = now
    this.surface.setSunDir(sunDirectionModel(new Date()))
  }

  /** 更新标记层事件集（消费 store 快照；接线时机属 App/FM-09，非本方法） */
  setEvents(events: readonly GeoEvent[]) {
    this.markerLayer.setEvents(events)
  }

  /** 列表→标记高亮联动（SPEC-7.4） */
  setHighlightedEvent(id: string | null) {
    this.markerLayer.setHighlight(id)
  }

  /** 指针移动：换算 NDC 并置脏，实际拾取在 RAF 内合并求值（节流，DP §4.3） */
  private onHoverMove = (e: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    this.pointerNdc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.pointerDirty = true
  }

  /** 指针离开 canvas：清空 hover（SPEC-7.4） */
  private onHoverLeave = () => {
    this.pointerDirty = false
    if (this.lastHoveredId !== null) {
      this.lastHoveredId = null
      this.onMarkerHover?.(null)
    }
  }

  /** OS reduced-motion 偏好运行时变更 → 透传标记层（SPEC-3.11a） */
  private onReducedMotionChange = (e: MediaQueryListEvent) => {
    this.markerLayer.setReducedMotion(e.matches)
  }

  /** 命中标记 id 变化时上抛（去抖，避免每帧 setState，DP §3.4）；无回调则跳过求交省算力 */
  private updateHover() {
    if (this.onMarkerHover === undefined || !this.pointerDirty) return
    this.pointerDirty = false
    this.raycaster.setFromCamera(this.pointerNdc, this.camera)
    const id = this.markerLayer.pick(this.raycaster)
    if (id !== this.lastHoveredId) {
      this.lastHoveredId = id
      this.onMarkerHover(id)
    }
  }

  /** 卫星风格专用：异步加载昼夜大纹理替换占位（仅 options.satellite 路径调用） */
  private async applySatelliteTextures(earth: ReturnType<typeof createEarth>) {
    try {
      const loaded = await loadEarthTextures()
      if (this.disposed) {
        // 加载完成时组件已卸载：直接释放，避免泄漏
        loaded.day.dispose()
        loaded.night.dispose()
        return
      }
      this.textures?.day.dispose()
      this.textures?.night.dispose()
      this.textures = loaded
      earth.setTextures(loaded)
    } catch (err) {
      // 加载失败不重试、不弹错误 UI，保持占位渲染（SPEC-3.2）
      console.error('[globe] 卫星纹理加载失败，保持占位渲染', err)
    }
  }

  private resize(container: HTMLElement) {
    const { clientWidth: w, clientHeight: h } = container
    if (w === 0 || h === 0) return
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.rafId)
    this.resizeObserver.disconnect()
    this.controls.dispose()
    this.renderer.domElement.removeEventListener('pointermove', this.onHoverMove)
    this.renderer.domElement.removeEventListener('pointerleave', this.onHoverLeave)
    this.reducedMotionQuery?.removeEventListener('change', this.onReducedMotionChange)

    // 标记层先 dispose（从 markerRoot 摘除自身 InstancedMesh 并释放 GPU 缓冲），
    // 故下方 traverse 不会再触及它
    this.markerLayer.dispose()
    // 矢量地表的 LineSegments（海岸线/网格）不是 Mesh/Points，traverse 不覆盖，须显式释放
    this.surface.dispose?.()
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        obj.geometry.dispose()
        const material = obj.material as THREE.Material | THREE.Material[]
        if (Array.isArray(material)) material.forEach((m) => m.dispose())
        else material.dispose()
      }
    })
    this.textures?.day.dispose()
    this.textures?.night.dispose()

    this.renderer.dispose()
    // dispose() 不释放 WebGL context；StrictMode/HMR 反复挂载会逼近浏览器 ~16 context 上限
    this.renderer.forceContextLoss()
    this.renderer.domElement.remove()
  }
}
