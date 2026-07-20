import coastline110m from './coastline-110m.json'

/**
 * 海岸线矢量数据（SPEC-3.2②/3.10）：每条折线一个 [lon, lat] 度值序列（未投影，
 * globe 层按 SPEC-6.2 的 latLonToVector3 换算）。
 */
export interface CoastlineData {
  readonly lines: ReadonlyArray<ReadonlyArray<readonly [number, number]>>
}

/**
 * 加载海岸线折线集：world-atlas land-110m 构建期预转换（scripts/build-coastline.mjs，
 * 出处/许可/体积见 public/assets/ASSETS.md）。数据随包静态 import——无运行时 topojson
 * 依赖、无 fetch，同步返回，故矢量默认球即时成形（SPEC-3.2 资源就绪即渲染、SPEC-3.10 计入首包）。
 */
export function loadCoastline(): CoastlineData {
  return coastline110m as unknown as CoastlineData
}
