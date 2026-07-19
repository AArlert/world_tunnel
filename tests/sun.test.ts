import { describe, expect, it } from 'vitest'
import { subsolarPoint } from '../src/astro/solar'
import { latLonToVector3 } from '../src/globe/geo'
import { sunDirectionModel } from '../src/globe/sun'

// M1-03：经度归一化边界、sunDir 坐标约定与更新频率下限。
// 期望值推导依据：
//   - SPEC-4.3：直下点经度须归一化到 (−180°, 180°] 区间；
//   - SPEC-4.5：sunDir = 直下点 (lat, lon) 经 SPEC-6.2 坐标约定转成的单位向量，
//     该约定的唯一实现是 latLonToVector3（已在 M0-01 独立验证），故此处用
//     latLonToVector3(subsolarPoint(date))作为 SPEC-4.5 定义的复合期望值，
//     而非读取 sun.ts 内部实现反推；
//   - SPEC-4.5「每帧按当前时刻更新，可降频至 1 次/分钟」隐含更新频率下限：
//     相差 >1 分钟的两个时刻必须产生不同的 sunDir。

describe('subsolarPoint 经度归一化区间（SPEC-4.3）', () => {
  it('任意 UTC 整点，经度均落在 (−180°, 180°] 区间内', () => {
    for (let h = 0; h < 24; h++) {
      const { lon } = subsolarPoint(new Date(Date.UTC(2023, 5, 15, h)))
      expect(lon).toBeGreaterThan(-180)
      expect(lon).toBeLessThanOrEqual(180)
    }
  })

  it('UTC 0 点（−15·(h_UTC−12+EoT/60) 原始值贴近 ±180° 边界）归一化后仍在区间内', () => {
    // h_UTC=0 时未归一化原始值 = −15·(0−12+EoT/60) ≈ 180 − 0.25·EoT，
    // EoT 幅度 ≤17 分钟（SPEC-4.4），故原始值落在 [175.75, 184.25] 附近，
    // 是跨越 180° 边界的典型用例。
    const { lon } = subsolarPoint(new Date(Date.UTC(2023, 5, 15, 0, 0, 0)))
    expect(lon).toBeGreaterThan(-180)
    expect(lon).toBeLessThanOrEqual(180)
  })

  it('跨年多个日期的 UTC 0 点与 12 点采样，经度均落在区间内（覆盖更多边界穿越场景）', () => {
    const months = [0, 2, 5, 8, 11]
    for (const m of months) {
      for (const h of [0, 12]) {
        const { lon } = subsolarPoint(new Date(Date.UTC(2023, m, 10, h)))
        expect(lon).toBeGreaterThan(-180)
        expect(lon).toBeLessThanOrEqual(180)
      }
    }
  })
})

describe('sunDirectionModel —— 单位向量与 SPEC-6.2 坐标约定（SPEC-4.5）', () => {
  it('返回向量为单位向量', () => {
    const dir = sunDirectionModel(new Date(Date.UTC(2023, 5, 21, 12)))
    expect(dir.length()).toBeCloseTo(1, 6)
  })

  it('分量与 latLonToVector3(subsolarPoint(date)) 一致——同一 SPEC-6.2 坐标约定（SPEC-4.5）', () => {
    const date = new Date(Date.UTC(2023, 5, 21, 12))
    const dir = sunDirectionModel(date)
    const { lat, lon } = subsolarPoint(date)
    const expected = latLonToVector3(lat, lon)
    expect(dir.x).toBeCloseTo(expected.x, 6)
    expect(dir.y).toBeCloseTo(expected.y, 6)
    expect(dir.z).toBeCloseTo(expected.z, 6)
  })
})

describe('sunDirectionModel —— 更新频率下限（SPEC-4.5：可降频至 1 次/分钟）', () => {
  it('相差 61 秒的两个时刻，sunDir 分量必须发生变化', () => {
    const t0 = new Date(Date.UTC(2023, 5, 21, 12, 0, 0))
    const t1 = new Date(Date.UTC(2023, 5, 21, 12, 1, 1))
    const d0 = sunDirectionModel(t0)
    const d1 = sunDirectionModel(t1)
    const changed =
      Math.abs(d0.x - d1.x) > 1e-9 ||
      Math.abs(d0.y - d1.y) > 1e-9 ||
      Math.abs(d0.z - d1.z) > 1e-9
    expect(changed).toBe(true)
  })
})
