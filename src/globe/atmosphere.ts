import * as THREE from 'three'
import { atmosphereFragmentShader, atmosphereVertexShader } from './shaders/atmosphere'

const ATMOSPHERE_COLOR = 0x4a90d9 // 主色（SPEC-3.4）
const SHELL_RADIUS = 1.15 // 壳半径，视觉调参自由度
const FRESNEL_POWER = 3.0
const INTENSITY = 1.2

/** 大气辉光壳：背面菲涅尔 + 加法混合（SPEC-3.4） */
export function createAtmosphere(): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(ATMOSPHERE_COLOR) },
      uPower: { value: FRESNEL_POWER },
      uIntensity: { value: INTENSITY },
    },
    vertexShader: atmosphereVertexShader,
    fragmentShader: atmosphereFragmentShader,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    // 不写深度：保证 M2 事件标记不被大气壳遮挡（SPEC-3.4 末句）
    depthWrite: false,
  })

  return new THREE.Mesh(new THREE.SphereGeometry(SHELL_RADIUS, 64, 64), material)
}
