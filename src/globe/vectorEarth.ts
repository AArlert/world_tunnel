import * as THREE from 'three'
import type { CoastlineData } from './coastline'
import { latLonToVector3 } from './geo'
import { vectorEarthFragmentShader, vectorEarthVertexShader } from './shaders/vectorEarth'

// SPEC-3.2a pin 的对外可见取值（十六进制按 sRGB 解释，THREE.Color 转线性后进 shader，
// 末尾 colorspace_fragment 再转回 sRGB 输出）。
const BASE_DAY = 0x1f4468 // 底面昼端（次日点方向）：被照亮的青蓝本体（SPEC-3.2a 显式 pin）
const BASE_NIGHT = 0x0d1827 // 底面夜端：沉入太空的深靛（SPEC-3.2a 显式 pin，非由昼端压暗派生）
const COAST_DAY = 0x6690b3 // 海岸线昼端：降饱和蓝灰结构线（SPEC-3.2a，与 news 蓝拉开饱和度）
const GRID_DAY = 0x1e3a5f // 经纬网格：暗蓝（默认隐藏，仅近景/调试档启用，SPEC-3.2a）
const NIGHT_GLOW = 0x3a5a72 // 夜面海岸线辉光色（SPEC-3.2a，低强度）

const NIGHT_DIM = 0.35 // 线（海岸/网格）夜端压暗系数（实现自由度，SPEC-3.2a 仅要求夜端暗于昼端保留可辨）
const GLOW_STRENGTH = 0.4 // 夜面辉光强度（低强度，SPEC-3.2a 仅要求存在与色相）
const TWILIGHT = 0.1 // 晨昏过渡带半宽 t ∈ [-0.1, +0.1]（SPEC-3.2①，与 M1 同源）

const SURFACE_R = 1.0 // 底面半径（SPEC-3.1）
const LINE_R = 1.001 // 线浮于底面之上，避免 z-fighting（DP §2.1）
const GRID_STEP = 30 // 经线/纬线各 30°（SPEC-3.2a）
const GRID_SEG = 2 // 每段折线的度跨（越小越圆滑），仅几何细分、不影响间距

/**
 * 矢量昼夜材质：昼端色 dayHex；夜端 nightHex 显式给定则直接用（底面两端 pin，SPEC-3.2a），
 * 否则按 NIGHT_DIM 由昼端压暗（海岸/网格线）；glowHex 非空时夜半球附加辉光。
 */
function createSurfaceMaterial(
  dayHex: number,
  opts: { nightHex?: number; glowHex?: number } = {},
): THREE.ShaderMaterial {
  const day = new THREE.Color(dayHex)
  const night =
    opts.nightHex !== undefined ? new THREE.Color(opts.nightHex) : day.clone().multiplyScalar(NIGHT_DIM)
  const glowHex = opts.glowHex
  return new THREE.ShaderMaterial({
    uniforms: {
      uColorDay: { value: day },
      uColorNight: { value: night },
      uSunDir: { value: new THREE.Vector3(0, 0, 1) },
      uTwilight: { value: TWILIGHT },
      uGlowColor: { value: new THREE.Color(glowHex ?? 0x000000) },
      uGlowStrength: { value: glowHex === undefined ? 0 : GLOW_STRENGTH },
    },
    vertexShader: vectorEarthVertexShader,
    fragmentShader: vectorEarthFragmentShader,
  })
}

/** 把 [lon, lat] 折线集投影为单一 LineSegments 几何（每折线拆成相邻点对，单一 draw call）。 */
function polylinesToSegments(
  lines: ReadonlyArray<ReadonlyArray<readonly [number, number]>>,
  radius: number,
): THREE.BufferGeometry {
  const positions: number[] = []
  const push = (lat: number, lon: number) => {
    const v = latLonToVector3(lat, lon, radius)
    positions.push(v.x, v.y, v.z)
  }
  for (const line of lines) {
    for (let i = 0; i + 1 < line.length; i++) {
      push(line[i][1], line[i][0])
      push(line[i + 1][1], line[i + 1][0])
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return geometry
}

/** 程序化经纬网格：经线每 GRID_STEP°（极到极）、纬线每 GRID_STEP°（不含两极点），零数据成本。 */
function buildGraticule(): ReadonlyArray<ReadonlyArray<readonly [number, number]>> {
  const lines: [number, number][][] = []
  // 经线：lon 固定，lat 从 -90 扫到 90
  for (let lon = -180; lon < 180; lon += GRID_STEP) {
    const meridian: [number, number][] = []
    for (let lat = -90; lat <= 90; lat += GRID_SEG) meridian.push([lon, lat])
    lines.push(meridian)
  }
  // 纬线：lat 固定（跳过 ±90 退化为点的极点），lon 环绕一圈
  for (let lat = -90 + GRID_STEP; lat <= 90 - GRID_STEP; lat += GRID_STEP) {
    const parallel: [number, number][] = []
    for (let lon = -180; lon <= 180; lon += GRID_SEG) parallel.push([lon, lat])
    lines.push(parallel)
  }
  return lines
}

/**
 * 矢量默认地球：深色底面 + 海岸线（夜面辉光）+ 经纬网格，昼夜明暗表达晨昏线（SPEC-3.2②/3.2a/3.3）。
 * 免大纹理（SPEC-3.10）。返回的 object 是底面 Mesh（SphereGeometry，供 SPEC-3.1 几何断言与
 * M1 调试钩子按 markerRoot 直接子节点定位），海岸线/网格作为其子节点随之一同挂进 markerRoot、
 * 共享模型空间 sunDir 与自转（SPEC-6.2）。
 */
export function createVectorEarth(coastline: CoastlineData): {
  object: THREE.Object3D
  setSunDir(dir: THREE.Vector3): void
  dispose(): void
} {
  const baseGeometry = new THREE.SphereGeometry(SURFACE_R, 64, 64)
  const baseMaterial = createSurfaceMaterial(BASE_DAY, { nightHex: BASE_NIGHT })
  const base = new THREE.Mesh(baseGeometry, baseMaterial)

  const coastGeometry = polylinesToSegments(coastline.lines, LINE_R)
  const coastMaterial = createSurfaceMaterial(COAST_DAY, { glowHex: NIGHT_GLOW })
  const coast = new THREE.LineSegments(coastGeometry, coastMaterial)

  // 经纬网格：保留构建，但默认远景不显示（SPEC-3.2a，D24）。近景 LOD/调试档的显隐规则属视觉第二批（另案）。
  const gridGeometry = polylinesToSegments(buildGraticule(), LINE_R)
  const gridMaterial = createSurfaceMaterial(GRID_DAY)
  const grid = new THREE.LineSegments(gridGeometry, gridMaterial)
  grid.visible = false

  base.add(coast, grid)

  const materials = [baseMaterial, coastMaterial, gridMaterial]

  return {
    object: base,
    setSunDir(dir) {
      // 模型空间单位向量，就地拷贝到各材质（SPEC-4.5、跨风格昼夜 SPEC-3.2①）
      for (const m of materials) (m.uniforms.uSunDir.value as THREE.Vector3).copy(dir)
    },
    dispose() {
      // LineSegments 不是 Mesh/Points，GlobeScene 的 traverse 不覆盖，须在此显式释放
      baseGeometry.dispose()
      coastGeometry.dispose()
      gridGeometry.dispose()
      for (const m of materials) m.dispose()
    },
  }
}
