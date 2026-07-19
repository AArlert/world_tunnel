// 太阳天文计算：赤纬 / 均时差 / 直下点（SPEC-4.1~4.3）。
// 纯数值实现，零 three.js 依赖，所有函数以 Date 为显式入参。

/**
 * 年积日 N：按 UTC 日期计，1 月 1 日 = 1，闰年 2 月 29 日照常顺次计入（SPEC-4.1）。
 */
export function dayOfYearUTC(date: Date): number {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 1)
  const startOfDay = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((startOfDay - startOfYear) / msPerDay) + 1
}

/**
 * 太阳赤纬（度），Cooper 公式，精度 ±1°（SPEC-4.1）。
 */
export function solarDeclinationDeg(date: Date): number {
  const n = dayOfYearUTC(date)
  return 23.44 * Math.sin((2 * Math.PI * (284 + n)) / 365)
}

/**
 * 均时差（分钟）（SPEC-4.2）。
 */
export function equationOfTimeMin(date: Date): number {
  const n = dayOfYearUTC(date)
  const b = (2 * Math.PI * (n - 81)) / 364
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b)
}

/**
 * 经度归一化到 (−180°, 180°]（SPEC-4.3）。
 */
function normalizeLonDeg(lonDeg: number): number {
  let lon = lonDeg % 360
  if (lon <= -180) lon += 360
  if (lon > 180) lon -= 360
  return lon
}

/**
 * 太阳直下点 (lat, lon)（度）（SPEC-4.1 + 4.3）。
 */
export function subsolarPoint(date: Date): { lat: number; lon: number } {
  const lat = solarDeclinationDeg(date)
  const hUTC =
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600 +
    date.getUTCMilliseconds() / 3600000
  const eot = equationOfTimeMin(date)
  const lon = normalizeLonDeg(-15 * (hUTC - 12 + eot / 60))
  return { lat, lon }
}
