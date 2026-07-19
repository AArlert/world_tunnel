import { describe, expect, it } from 'vitest'
import { createStarfield } from '../src/globe/starfield'

// M1-08（单测部分）：星空点数量与分布半径。期望值只从 doc/spec.md 推导：
// SPEC-3.5「程序化点星 ≥1500 颗，分布于半径 ≥40 球壳」。
// SPEC-3.5 给出的均是下限（≥1500 / ≥40），故只断言下限，不对实现的具体取值
// （实际点数、实际半径）做等值断言——避免把实现细节固化进期望值。

describe('createStarfield —— 点数与分布半径下限（SPEC-3.5，M1-08）', () => {
  it('点星数量 ≥ 1500（SPEC-3.5）', () => {
    const points = createStarfield()
    const position = points.geometry.getAttribute('position')
    expect(position.count).toBeGreaterThanOrEqual(1500)
  })

  it('全部点星到原点的距离（分布半径）≥ 40（SPEC-3.5「球壳」）', () => {
    const points = createStarfield()
    const position = points.geometry.getAttribute('position')
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i)
      const y = position.getY(i)
      const z = position.getZ(i)
      const radius = Math.sqrt(x * x + y * y + z * z)
      expect(radius).toBeGreaterThanOrEqual(40)
    }
  })
})
