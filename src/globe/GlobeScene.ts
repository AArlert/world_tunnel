import * as THREE from 'three'

/**
 * M0 占位场景：线框地球缓慢自转，证明 three.js 渲染管线可用。
 * M1 换成昼夜纹理 shader + 大气 + 星空 + 交互（SPEC-3）。
 */
export class GlobeScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private globe: THREE.Mesh
  private rafId = 0
  private resizeObserver: ResizeObserver

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    this.camera.position.set(0, 0, 3.2)

    this.globe = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 64), // 分段 ≥64（SPEC-3.1）
      new THREE.MeshBasicMaterial({ color: 0x2b6cb0, wireframe: true }),
    )
    this.scene.add(this.globe)

    this.resizeObserver = new ResizeObserver(() => this.resize(container))
    this.resizeObserver.observe(container)
    this.resize(container)

    const animate = () => {
      this.globe.rotation.y += 0.0015
      this.renderer.render(this.scene, this.camera)
      this.rafId = requestAnimationFrame(animate)
    }
    animate()
  }

  private resize(container: HTMLElement) {
    const { clientWidth: w, clientHeight: h } = container
    if (w === 0 || h === 0) return
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  dispose() {
    cancelAnimationFrame(this.rafId)
    this.resizeObserver.disconnect()
    this.globe.geometry.dispose()
    ;(this.globe.material as THREE.Material).dispose()
    this.renderer.dispose()
    // dispose() 不释放 WebGL context；StrictMode/HMR 反复挂载会逼近浏览器 ~16 context 上限
    this.renderer.forceContextLoss()
    this.renderer.domElement.remove()
  }
}
