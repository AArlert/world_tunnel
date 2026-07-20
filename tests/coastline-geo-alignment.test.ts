import { describe, expect, it } from 'vitest'
import { loadCoastline } from '../src/globe/coastline'
import { latLonToVector3 } from '../src/globe/geo'

// M2-16：矢量海岸线几何与坐标系对齐（SPEC-3.6 + SPEC-6.2 + SPEC-3.2②）。
//
// 期望值只从 spec 推导：
//  - SPEC-6.2「球面坐标约定：北极 (90,·)→+Y；(0,0)→+Z；(0,90°E)→+X。实现：
//    src/globe/geo.ts latLonToVector3」——latLonToVector3 本身已在 tests/geo.test.ts
//    （M0-01）独立验证过三个已知点，本文件不重复验证该函数，只验证
//    coastline.ts 的数据经该函数投影后是否落在 SPEC-6.2 预期的方向——即数据自身
//    `[lon, lat]` 字段顺序/符号未被误存（如经纬互换、符号取反、镜像）。
//  - SPEC-3.6「格林尼治（lat 0, lon 0）的球面标记必须落在昼纹理的非洲西侧几内亚湾
//    位置（M1 校准场景验证）」——本文件对矢量默认风格（SPEC-3.2②）的等价验证：
//    真实海岸线数据在格林尼治附近（几内亚湾窗口内）确实存在顶点，且这些顶点投影后
//    主分量为 +Z（对应 SPEC-6.2 的 (0,0)→+Z），东经点 x>0、西经点 x<0（无镜像/翻转）。
//
// 窗口选取（非判据本身，只是取样范围）：几内亚湾沿岸（西非）在 lon∈[-15,15]、
// lat∈[-10,15] 内应有真实海岸线顶点——该窗口经独立 node 脚本核实命中 64 个顶点、
// 东经/西经各有覆盖（34/23 个），留有充分余量；文件本身不依赖该次核实的具体计数，
// 只要求非空与符号方向正确。

describe('coastline 几何与 latLonToVector3 坐标系对齐（SPEC-6.2 + SPEC-3.6，M2-16）', () => {
  const { lines } = loadCoastline()

  it('海岸线顶点经 latLonToVector3 投影后落单位球面（模长≈1），数据无 NaN/越界污染', () => {
    // latLonToVector3 对任意有限 (lat,lon) 恒返回模长=radius 的向量（cos²+sin²=1 恒成立），
    // 故本断言的实际把关点是"coastline 数据本身是有限、有效的度数值"——若构建期
    // （scripts/build-coastline.mjs）产出损坏数据（NaN/Infinity/超出±90/±180），
    // 会在这里被模长偏离 1 或 toBeCloseTo 因 NaN 而失败捕获
    let checked = 0
    for (const line of lines) {
      for (const [lon, lat] of line) {
        const v = latLonToVector3(lat, lon)
        expect(v.length()).toBeCloseTo(1, 10)
        checked += 1
      }
    }
    // 确认循环确实跑过了大量真实顶点，不是空数据集掩盖了断言从未执行
    expect(checked).toBeGreaterThan(1000)
  })

  it('几内亚湾窗口（lon∈[-15,15]，lat∈[-10,15]）内存在真实海岸线顶点（SPEC-3.6 等价校验的前提）', () => {
    const near = lines.flatMap((line) =>
      line.filter(([lon, lat]) => lon >= -15 && lon <= 15 && lat >= -10 && lat <= 15),
    )
    expect(near.length).toBeGreaterThan(0)
  })

  it('该窗口内顶点投影后主分量为 +Z，东经/西经点 x 符号与经度符号一致——非镜像/翻转（SPEC-6.2 (0,0)→+Z）', () => {
    const near = lines.flatMap((line) =>
      line.filter(([lon, lat]) => lon >= -15 && lon <= 15 && lat >= -10 && lat <= 15),
    )

    for (const [lon, lat] of near) {
      const v = latLonToVector3(lat, lon)
      // 小角度窗口（|lat|,|lon| ≤ 15°）内 cos(lat)·cos(lon) 必然接近 1，是 SPEC-6.2
      // 「(0,0)→+Z」在该窗口内的直接推论；容差 0.9 留有余量（独立核实过窗口内实测
      // 最小值 ≈0.949）
      expect(v.z).toBeGreaterThan(0.9)
    }

    // 东经点与西经点各取若干（|lon|>3° 排除贴近 0° 经线、符号意义不明显的点），
    // x 分量符号须与经度符号一致——若数据存储时发生经度取反/镜像，此处会失败
    const east = near.filter(([lon]) => lon > 3)
    const west = near.filter(([lon]) => lon < -3)
    expect(east.length).toBeGreaterThan(0)
    expect(west.length).toBeGreaterThan(0)
    for (const [lon, lat] of east) {
      expect(latLonToVector3(lat, lon).x).toBeGreaterThan(0)
    }
    for (const [lon, lat] of west) {
      expect(latLonToVector3(lat, lon).x).toBeLessThan(0)
    }
  })
})
