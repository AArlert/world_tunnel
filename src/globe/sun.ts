import type { Vector3 } from 'three'
import { subsolarPoint } from '../astro/solar'
import { latLonToVector3 } from './geo'

/**
 * 当前时刻的太阳方向：直下点 (lat, lon) 经 SPEC-6.2 约定转成的模型空间单位向量（SPEC-4.5）。
 * 模型空间是硬约定——该向量不随地球自转变换，晨昏线只由真实时刻驱动。
 */
export function sunDirectionModel(date: Date): Vector3 {
  const { lat, lon } = subsolarPoint(date)
  return latLonToVector3(lat, lon, 1)
}
