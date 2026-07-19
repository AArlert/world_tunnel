import { describe, expect, it } from 'vitest'
import {
  dayOfYearUTC,
  equationOfTimeMin,
  solarDeclinationDeg,
  subsolarPoint,
} from '../src/astro/solar'

// M1-01 + M1-02：期望值全部由 doc/spec.md §4 天文计算公式独立推导，不参考实现体。

describe('dayOfYearUTC —— 年积日按 UTC 日期计（SPEC-4.1）', () => {
  it('1 月 1 日 UTC → N=1（SPEC-4.1）', () => {
    expect(dayOfYearUTC(new Date(Date.UTC(2023, 0, 1)))).toBe(1)
  })

  it('非闰年 3 月 20 日 UTC → N=79（Jan31+Feb28+20，SPEC-4.1）', () => {
    expect(dayOfYearUTC(new Date(Date.UTC(2023, 2, 20)))).toBe(79)
  })

  it('闰年 2 月 29 日 UTC → N=60（Jan31+29，闰年顺次计入，SPEC-4.1）', () => {
    expect(dayOfYearUTC(new Date(Date.UTC(2024, 1, 29)))).toBe(60)
  })

  it('闰年 3 月 1 日 UTC → N=61（紧接闰日之后顺次递增，SPEC-4.1）', () => {
    expect(dayOfYearUTC(new Date(Date.UTC(2024, 2, 1)))).toBe(61)
  })
})

describe('solarDeclinationDeg —— 春分/夏至/冬至锚点（SPEC-4.1 公式 + SPEC-4.4 锚点）', () => {
  // 容差 ±1°（SPEC-4.4 明文）
  const TOL_DEG = 1

  it('春分 3-20 UTC → δ ≈ 0°（SPEC-4.4）', () => {
    const delta = solarDeclinationDeg(new Date(Date.UTC(2023, 2, 20, 12)))
    expect(Math.abs(delta - 0)).toBeLessThanOrEqual(TOL_DEG)
  })

  it('夏至 6-21 UTC → δ ≈ +23.44°（SPEC-4.4）', () => {
    const delta = solarDeclinationDeg(new Date(Date.UTC(2023, 5, 21, 12)))
    expect(Math.abs(delta - 23.44)).toBeLessThanOrEqual(TOL_DEG)
  })

  it('冬至 12-21 UTC → δ ≈ −23.44°（SPEC-4.4）', () => {
    const delta = solarDeclinationDeg(new Date(Date.UTC(2023, 11, 21, 12)))
    expect(Math.abs(delta - -23.44)).toBeLessThanOrEqual(TOL_DEG)
  })
})

describe('equationOfTimeMin —— 全年幅度上限（SPEC-4.2 公式 + SPEC-4.4 锚点）', () => {
  it('非闰年全年 365 天，|EoT| 幅度均 ≤ 17 分钟（SPEC-4.4）', () => {
    const startUTC = Date.UTC(2023, 0, 1)
    const msPerDay = 24 * 60 * 60 * 1000
    let maxAbs = 0
    for (let i = 0; i < 365; i++) {
      const d = new Date(startUTC + i * msPerDay)
      const eot = equationOfTimeMin(d)
      maxAbs = Math.max(maxAbs, Math.abs(eot))
    }
    expect(maxAbs).toBeLessThanOrEqual(17)
  })
})

describe('subsolarPoint —— EoT≈0 日期 UTC 正午的直下点经度（SPEC-4.3 公式 + SPEC-4.4 锚点）', () => {
  it('4-15 前后 UTC 正午（h_UTC=12），直下点经度 ≈ 0°（容差 ±1°，SPEC-4.4）', () => {
    const { lon } = subsolarPoint(new Date(Date.UTC(2023, 3, 15, 12, 0, 0, 0)))
    expect(Math.abs(lon - 0)).toBeLessThanOrEqual(1)
  })
})
