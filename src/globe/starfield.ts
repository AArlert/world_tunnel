import * as THREE from 'three'

const STAR_COUNT = 2000 // ≥1500（SPEC-3.5）
const SHELL_RADIUS = 60 // ≥40（SPEC-3.5）

/** 程序化点星：单个 Points 对象承载全部星点（SPEC-3.5 / SPEC-3.8 性能实践） */
export function createStarfield(): THREE.Points {
  const positions = new Float32Array(STAR_COUNT * 3)
  for (let i = 0; i < STAR_COUNT; i++) {
    // 球面均匀采样：cosθ 均匀分布，避免两极堆积
    const cosTheta = 2 * Math.random() - 1
    const sinTheta = Math.sqrt(1 - cosTheta * cosTheta)
    const phi = 2 * Math.PI * Math.random()
    positions[i * 3] = SHELL_RADIUS * sinTheta * Math.cos(phi)
    positions[i * 3 + 1] = SHELL_RADIUS * cosTheta
    positions[i * 3 + 2] = SHELL_RADIUS * sinTheta * Math.sin(phi)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1.2,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  })

  return new THREE.Points(geometry, material)
}
