import { Vector3 } from 'three'

const DEG = Math.PI / 180

/**
 * 经纬度（度）→ three.js 右手系球面坐标（SPEC-6.2）：
 * 北极(90,·)→+Y，赤道本初子午线(0,0)→+Z，赤道东经90°(0,90)→+X。
 */
export function latLonToVector3(latDeg: number, lonDeg: number, radius = 1): Vector3 {
  const lat = latDeg * DEG
  const lon = lonDeg * DEG
  return new Vector3(
    radius * Math.cos(lat) * Math.sin(lon),
    radius * Math.sin(lat),
    radius * Math.cos(lat) * Math.cos(lon),
  )
}
