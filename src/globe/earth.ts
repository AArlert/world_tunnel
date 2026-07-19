import * as THREE from 'three'
import { earthFragmentShader, earthVertexShader } from './shaders/earth'
import type { EarthTextures } from './textures'

const NIGHT_GAIN = 2.0 // 夜景亮度增益，须 ≥1.5（SPEC-3.3）
const TWILIGHT = 0.1 // 晨昏过渡带半宽，t ∈ [-0.1, +0.1]（SPEC-3.2）

/**
 * 地球几何——uv 约定的唯一出处（SPEC-3.6 + SPEC-6.2）。
 * phiStart = -π/2 使 u=0.5 落在 +Z，即 (lat 0, lon 0)，与等距圆柱纹理的本初子午线对齐；
 * u 向东递增（u=0.75 ↔ +X ↔ lon 90°E），uv.y=1 ↔ 北极。分段 64（SPEC-3.1 要求 ≥64）。
 */
export function createEarthGeometry(): THREE.SphereGeometry {
  return new THREE.SphereGeometry(1, 64, 64, -Math.PI / 2)
}

/** 地球本体：昼夜混合材质 + sunDir/纹理写入口 */
export function createEarth(tex: EarthTextures): {
  mesh: THREE.Mesh
  setSunDir(dir: THREE.Vector3): void
  setTextures(next: EarthTextures): void
} {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uDayMap: { value: tex.day },
      uNightMap: { value: tex.night },
      uSunDir: { value: new THREE.Vector3(0, 0, 1) },
      uNightGain: { value: NIGHT_GAIN },
      uTwilight: { value: TWILIGHT },
    },
    vertexShader: earthVertexShader,
    fragmentShader: earthFragmentShader,
  })

  const mesh = new THREE.Mesh(createEarthGeometry(), material)

  return {
    mesh,
    setSunDir(dir) {
      // 模型空间单位向量，就地拷贝即可，无需 needsUpdate（SPEC-4.5）
      ;(material.uniforms.uSunDir.value as THREE.Vector3).copy(dir)
    },
    setTextures(next) {
      // 纹理就绪后直接替换，无淡入过渡（SPEC-3.2）
      material.uniforms.uDayMap.value = next.day
      material.uniforms.uNightMap.value = next.night
    },
  }
}
