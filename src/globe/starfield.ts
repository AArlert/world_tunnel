import * as THREE from 'three'

const STAR_COUNT = 2000 // ≥1500（SPEC-3.5）
const SHELL_RADIUS = 60 // ≥40（SPEC-3.5）

// 冷白基色（sRGB，微冷）：逐星按亮度系数缩放（SPEC-3.5 上限约束下的分布，属实现自由度）
const STAR_BASE = [0.78, 0.82, 0.86] as const
// 亮度系数上限 0.55：STAR_BASE 的 sRGB luma ≈208，×0.55 ≈114，严格低于昼面海岸线 #6690b3（luma≈138，SPEC-3.5）
const BRIGHT_RATIO = 0.08 // 约 8% 为可辨亮星，其余为暗星（给深度、不成噪声，D3/D23 L0）
const _star = new THREE.Color()

/** 程序化点星：单个 Points 对象承载全部星点（SPEC-3.5 / SPEC-3.8 性能实践） */
export function createStarfield(): THREE.Points {
  const positions = new Float32Array(STAR_COUNT * 3)
  const colors = new Float32Array(STAR_COUNT * 3)
  for (let i = 0; i < STAR_COUNT; i++) {
    // 球面均匀采样：cosθ 均匀分布，避免两极堆积
    const cosTheta = 2 * Math.random() - 1
    const sinTheta = Math.sqrt(1 - cosTheta * cosTheta)
    const phi = 2 * Math.PI * Math.random()
    positions[i * 3] = SHELL_RADIUS * sinTheta * Math.cos(phi)
    positions[i * 3 + 1] = SHELL_RADIUS * cosTheta
    positions[i * 3 + 2] = SHELL_RADIUS * sinTheta * Math.sin(phi)

    // 逐星亮度：少数亮星 [0.30,0.55]、多数暗星 [0.10,0.22]；上限 0.55 使星亮度不高于昼面海岸线（SPEC-3.5）
    const factor =
      Math.random() < BRIGHT_RATIO ? 0.3 + Math.random() * 0.25 : 0.1 + Math.random() * 0.12
    // 在 sRGB 空间按 factor 缩放（luma 同比例缩放，稳保 ≤ 上限），setRGB 转 linear 后存 vertexColor
    _star.setRGB(STAR_BASE[0] * factor, STAR_BASE[1] * factor, STAR_BASE[2] * factor, THREE.SRGBColorSpace)
    colors[i * 3] = _star.r
    colors[i * 3 + 1] = _star.g
    colors[i * 3 + 2] = _star.b
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const material = new THREE.PointsMaterial({
    vertexColors: true, // 逐星亮度分布（SPEC-3.5 上限 + 深度），亮度承载于 vertexColor
    size: 1.2,
    sizeAttenuation: false,
    transparent: true,
    depthWrite: false,
  })

  return new THREE.Points(geometry, material)
}
