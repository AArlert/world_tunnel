import { describe, expect, it } from 'vitest'
import { loadCoastline } from '../src/globe/coastline'
import { createVectorEarth } from '../src/globe/vectorEarth'

// M2-15（辅助单测）：矢量默认风格经纬网格密度（SPEC-3.2a 网格条款）。
//
// 期望值只从 spec 推导：
//   - SPEC-3.2a「经纬网格（graticule，程序化生成）……密度为经线每 30°、纬线每 30°，
//     赤道与极区不额外加密」——本文件从 createVectorEarth() 返回对象的公开几何属性
//     （THREE.Object3D.children 的 LineSegments.geometry.attributes.position）里，
//     反推经线/纬线的位置分布，只断言"相邻经线/纬线间隔恒为 30°、无更密的插入线"，
//     不读取 vectorEarth.ts 内部的 GRID_STEP/GRID_SEG 常量本身（那是实现细节，其取值
//     30° 恰与 spec 文本重合是巧合式一致，本文件独立从渲染出的几何反推，不依赖该常量）。
//
// 网格与海岸线的黑盒区分法：createVectorEarth 的返回对象只暴露 `object`（THREE.Object3D），
// 不暴露"哪个子节点是网格"这一实现细节。矢量默认风格只有海岸线与网格两个 LineSegments
// 子节点；世界海岸线（110m 分辨率，130 条折线，数千顶点）在结构上必然比一个稀疏的
// 程序化网格（12 经线+5 纬线，同样数千顶点量级但明显更少——单条网格线在 GRID_SEG=2°
// 细分下仅 ~90~180 段）顶点数更多——用"两个子节点中顶点数更少的那个"作为网格判据，
// 比逐经纬度桶设阈值更稳健（已用调试脚本核实：真实海岸线数据在个别整数经纬度上也可能
// 偶然聚集较多顶点，逐桶阈值容易被巧合破坏；顶点总量对比则不受此干扰）。

const DEG = Math.PI / 180

/** THREE.Vector3（单位球面附近）→ (latDeg, lonDeg)，与 src/globe/geo.ts latLonToVector3
 * 互为逆变换（该正变换已在 tests/geo.test.ts / M0-01 独立验证）；本文件独立实现逆变换，
 * 不读取/依赖 geo.ts 的任何实现细节。 */
function vectorToLatLon(x: number, y: number, z: number): { lat: number; lon: number } {
  const r = Math.hypot(x, y, z)
  const lat = Math.asin(y / r) / DEG
  const lon = Math.atan2(x, z) / DEG
  return { lat, lon }
}

/** 从一个 LineSegments 的 position 属性里，找出"重复出现次数远超真实地理数据合理范围"的
 * 整数经度/纬度值——即经线（同经度多点）与纬线（同纬度多点）的结构信号。 */
function findRepeatedDegrees(positions: Float32Array | number[]): {
  meridianLons: number[]
  parallelLats: number[]
} {
  const lonCount = new Map<number, number>()
  const latCount = new Map<number, number>()
  for (let i = 0; i + 2 < positions.length; i += 3) {
    const { lat, lon } = vectorToLatLon(positions[i], positions[i + 1], positions[i + 2])
    const rl = Math.round(lat)
    const ro = Math.round(lon)
    latCount.set(rl, (latCount.get(rl) ?? 0) + 1)
    lonCount.set(ro, (lonCount.get(ro) ?? 0) + 1)
  }
  // 阈值 80：单条经线在 GRID_SEG=2° 细分下应有 ~91 个顶点、单条纬线 ~181 个，
  // 远超真实世界海岸线数据在任一单一整数经/纬度上偶然聚集的点数（已用 M2-16
  // 的几内亚湾窗口核实：真实海岸线在 64 个顶点的密集窗口内，同一整数经/纬度
  // 上最多几个点），80 留有充分区分度
  const THRESHOLD = 80
  const meridianLons = [...lonCount.entries()].filter(([, c]) => c > THRESHOLD).map(([v]) => v)
  const parallelLats = [...latCount.entries()].filter(([, c]) => c > THRESHOLD).map(([v]) => v)
  return { meridianLons, parallelLats }
}

/** 相邻元素间隔是否恒为 step（升序排列后逐差） */
function hasUniformStep(sorted: number[], step: number): boolean {
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] !== step) return false
  }
  return true
}

describe('矢量默认风格经纬网格密度（SPEC-3.2a，M2-15 辅助单测）', () => {
  it('经线间隔恒为 30°、纬线间隔恒为 30°，赤道/极区无额外插入线', () => {
    const { object } = createVectorEarth(loadCoastline())
    const lineChildren = object.children.filter(
      (c) => (c as unknown as { isLineSegments?: boolean }).isLineSegments,
    ) as unknown as { geometry: { attributes: { position: { array: Float32Array } } } }[]
    expect(lineChildren.length).toBe(2) // 海岸线 + 网格

    // 黑盒识别网格子节点：顶点数较少的那个（见头注）
    const byVertexCount = [...lineChildren].sort(
      (a, b) => a.geometry.attributes.position.array.length - b.geometry.attributes.position.array.length,
    )
    const gridChild = byVertexCount[0]
    const coastChild = byVertexCount[1]
    // 自检（非 SPEC 判据）：确认两者顶点数差距明显，判据成立的前提
    expect(coastChild.geometry.attributes.position.array.length).toBeGreaterThan(
      gridChild.geometry.attributes.position.array.length * 1.5,
    )

    const { meridianLons, parallelLats } = findRepeatedDegrees(gridChild.geometry.attributes.position.array)
    const sortedLons = [...meridianLons].sort((a, b) => a - b)
    const sortedLats = [...parallelLats].sort((a, b) => a - b)

    // 经线：间隔恒为 30°（相邻经线差值逐一核验，若存在额外插入线会在此处出现 <30 的间隔）
    expect(hasUniformStep(sortedLons, 30)).toBe(true)
    // 经线应覆盖完整 360°（12 条），而非局部加密/局部缺失
    expect(sortedLons.length).toBe(12)

    // 纬线：间隔恒为 30°，且不含赤道/极区额外加密线（若有，相邻间隔会小于 30）
    expect(hasUniformStep(sortedLats, 30)).toBe(true)
    // 纬线应含赤道（0°）——网格覆盖赤道，且赤道处没有因"额外加密"而被拆成多条
    expect(sortedLats).toContain(0)
    // 纬线不含 ±90（极点退化为单点，不构成一条可辨的纬线，"极区不额外加密"的自然推论）
    expect(sortedLats).not.toContain(90)
    expect(sortedLats).not.toContain(-90)
  })
})
