import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createAtmosphere } from '../src/globe/atmosphere'

// M1-07：大气菲涅尔辉光的机械代理断言。期望值只从 doc/spec.md 推导：
// SPEC-3.4「菲涅尔边缘辉光，主色 #4a90d9，从球缘向外衰减；不遮挡标记」。
//
// 覆盖范围与缺口（如实说明）：
// - 主色：直接来自 SPEC-3.4 正文的十六进制字面量 #4a90d9，与材质 uColor uniform 比对，
//   不读实现取值反推。
// - 菲涅尔衰减：SPEC-3.4 未给出 power/intensity 的具体数值，只要求「存在由球缘向外的
//   衰减」，故只断言衰减相关 uniform 为正数下限（衰减指数与强度须非零才可能产生衰减
//   效果），不对具体取值做等值断言。「由球缘向外衰减」的实际渲染呈现（视觉判据）
//   需要真实 WebGL 渲染管线求值 shader，vitest 环境无 WebGL 上下文，不在本文件覆盖
//   范围内（该项验证需截图/像素采样，留待 orch 决定路径）。
// - 不遮挡标记：按 testplan M1-07 登记的机械代理判据——大气材质满足 AdditiveBlending +
//   depthWrite=false + transparent（SPEC-3.4 推论；M1 无标记层，标记不被遮挡的直接验证
//   顺延至 M2 标记层场景，此处只验证材质配置本身）。

describe('createAtmosphere —— 大气材质代理断言（SPEC-3.4，M1-07）', () => {
  it('主色 uniform 等于 SPEC-3.4 规定的 #4a90d9', () => {
    const mesh = createAtmosphere()
    const material = mesh.material as THREE.ShaderMaterial
    const color = material.uniforms.uColor.value as THREE.Color
    const expected = new THREE.Color(0x4a90d9) // SPEC-3.4 明文十六进制主色
    expect(color.r).toBeCloseTo(expected.r, 5)
    expect(color.g).toBeCloseTo(expected.g, 5)
    expect(color.b).toBeCloseTo(expected.b, 5)
  })

  it('菲涅尔衰减相关 uniform 为正数——"由球缘向外衰减"要求非零衰减强度（SPEC-3.4）', () => {
    const mesh = createAtmosphere()
    const material = mesh.material as THREE.ShaderMaterial
    expect(material.uniforms.uPower.value).toBeGreaterThan(0)
    expect(material.uniforms.uIntensity.value).toBeGreaterThan(0)
  })

  it('不遮挡标记的材质代理：AdditiveBlending + depthWrite=false + transparent（SPEC-3.4 推论）', () => {
    const mesh = createAtmosphere()
    const material = mesh.material as THREE.ShaderMaterial
    expect(material.blending).toBe(THREE.AdditiveBlending)
    expect(material.depthWrite).toBe(false)
    expect(material.transparent).toBe(true)
  })
})
