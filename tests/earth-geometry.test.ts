import { describe, expect, it } from 'vitest'
import { createEarthGeometry } from '../src/globe/earth'
import { latLonToVector3 } from '../src/globe/geo'

// M1-12：createEarthGeometry() 的 uv↔坐标映射需与 SPEC-3.6（格林尼治落在昼纹理
// 几内亚湾位置，即 uv≈(0.5,0.5)）+ SPEC-6.2（球面坐标约定，latLonToVector3 为唯一实现）
// 一致。期望值只从 testplan 已登记的判据与 latLonToVector3()（已在 M0-01 独立验证的
// SPEC-6.2 实现）推导，不读 createEarthGeometry 内部代码——只按其对外暴露的
// position/uv 几何属性做断言。

type Geometry = ReturnType<typeof createEarthGeometry>

/** 在几何体的 uv 属性中查找与目标 (u, v) 近似相等的所有顶点，返回其模型空间坐标 */
function verticesAtUv(geometry: Geometry, u: number, v: number, eps = 1e-6) {
  const uv = geometry.attributes.uv
  const pos = geometry.attributes.position
  const found: { x: number; y: number; z: number }[] = []
  for (let i = 0; i < uv.count; i++) {
    if (Math.abs(uv.getX(i) - u) <= eps && Math.abs(uv.getY(i) - v) <= eps) {
      found.push({ x: pos.getX(i), y: pos.getY(i), z: pos.getZ(i) })
    }
  }
  return found
}

describe('createEarthGeometry —— uv 与 SPEC-6.2 坐标一致性（SPEC-3.6 + SPEC-6.2，M1-12）', () => {
  it('uv≈(0.5,0.5) 处顶点 ≈ latLonToVector3(0,0)（格林尼治，SPEC-3.6）', () => {
    const geometry = createEarthGeometry()
    const verts = verticesAtUv(geometry, 0.5, 0.5)
    expect(verts.length).toBeGreaterThan(0)
    const expected = latLonToVector3(0, 0)
    for (const v of verts) {
      expect(v.x).toBeCloseTo(expected.x, 5)
      expect(v.y).toBeCloseTo(expected.y, 5)
      expect(v.z).toBeCloseTo(expected.z, 5)
    }
  })

  it('uv≈(0.75,0.5) 处顶点 ≈ latLonToVector3(0,90)——u 向东递增（SPEC-6.2）', () => {
    const geometry = createEarthGeometry()
    const verts = verticesAtUv(geometry, 0.75, 0.5)
    expect(verts.length).toBeGreaterThan(0)
    const expected = latLonToVector3(0, 90)
    for (const v of verts) {
      expect(v.x).toBeCloseTo(expected.x, 5)
      expect(v.y).toBeCloseTo(expected.y, 5)
      expect(v.z).toBeCloseTo(expected.z, 5)
    }
  })

  it('uv.y=1 处顶点为 +Y 北极——无南北翻转（SPEC-3.6 + SPEC-6.2）', () => {
    const geometry = createEarthGeometry()
    const uv = geometry.attributes.uv
    const pos = geometry.attributes.position
    let matched = 0
    for (let i = 0; i < uv.count; i++) {
      if (Math.abs(uv.getY(i) - 1) <= 1e-6) {
        matched += 1
        expect(pos.getX(i)).toBeCloseTo(0, 5)
        expect(pos.getY(i)).toBeCloseTo(1, 5)
        expect(pos.getZ(i)).toBeCloseTo(0, 5)
      }
    }
    // 至少要存在 uv.y=1 的顶点行，否则上面的断言从未真正执行过
    expect(matched).toBeGreaterThan(0)
  })
})
