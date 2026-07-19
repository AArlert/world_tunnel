import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createEarth } from '../src/globe/earth'
import { createPlaceholderTextures } from '../src/globe/textures'

// M1-06：夜景灯光增益（单测判据部分）。期望值只从 doc/spec.md 推导：
// SPEC-3.3「夜半球显示夜纹理城市灯光（亮度增益 ≥1.5）；昼半球不显示灯光」。
// SPEC-3.3 给出的是下限（≥1.5），故只断言下限，不对实现的具体增益取值做等值断言。
//
// 覆盖缺口（如实说明，不硬凑断言）：
// SPEC-3.3 后半句「昼半球不显示灯光」，对应 testplan M1-06 的第二条判据——
// 「混合权重在纯昼端点（t 超出 [-0.1,+0.1] 的昼侧）灯光项权重为 0」，
// 是 fragment shader 对 t=dot(N,sunDir) 求值后再做混合的运行时结果，
// vitest 环境没有 WebGL 上下文，无法执行 GLSL 代码求出实际混合权重；
// 也不通过解析 shader 源码字符串来假装覆盖该判据（禁止用实现反推期望值）。
// 该判据需要真实渲染管线验证（如 e2e 像素采样），本文件不覆盖，
// M1-06 场景因此暂不通过 evidence 置 ✅，保持 🔲，留待 orch 决定验证路径。

describe('createEarth —— 夜景灯光增益 uNightGain 下限（SPEC-3.3，M1-06）', () => {
  it('uNightGain 默认值 ≥ 1.5', () => {
    const { mesh } = createEarth(createPlaceholderTextures())
    const material = mesh.material as THREE.ShaderMaterial
    expect(material.uniforms.uNightGain.value).toBeGreaterThanOrEqual(1.5)
  })
})
