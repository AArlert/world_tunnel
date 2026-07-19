import { describe, expect, it } from 'vitest'
import { latLonToVector3 } from '../src/globe/geo'

// M0-01：SPEC-6.2 球面坐标约定的三个已知点
describe('latLonToVector3', () => {
  it('北极 (90, 0) → +Y', () => {
    const v = latLonToVector3(90, 0)
    expect(v.x).toBeCloseTo(0, 10)
    expect(v.y).toBeCloseTo(1, 10)
    expect(v.z).toBeCloseTo(0, 10)
  })

  it('赤道本初子午线 (0, 0) → +Z', () => {
    const v = latLonToVector3(0, 0)
    expect(v.x).toBeCloseTo(0, 10)
    expect(v.y).toBeCloseTo(0, 10)
    expect(v.z).toBeCloseTo(1, 10)
  })

  it('赤道东经 90° (0, 90) → +X，且半径缩放生效', () => {
    const v = latLonToVector3(0, 90, 2)
    expect(v.x).toBeCloseTo(2, 10)
    expect(v.y).toBeCloseTo(0, 10)
    expect(v.z).toBeCloseTo(0, 10)
  })
})
