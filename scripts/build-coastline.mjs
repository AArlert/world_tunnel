// 海岸线矢量数据构建期预转换（一次性，产物 src/globe/coastline-110m.json 入库）。
// 源：world-atlas land-110m（Natural Earth 1:110m 派生，公有领域），TopoJSON ~55KB。
// 做法：解码全部 arcs（land 拓扑的共享边即海岸线），去量化为 [lon, lat] 折线并四舍五入到 2 位小数
//       （0.01° ≈ 1.1km，对 110m 精度足够），输出紧凑 JSON。运行期无 topojson 依赖、无 fetch。
// 复跑：node scripts/build-coastline.mjs（需联网拉取 land-110m.json）。出处/许可/体积见 public/assets/ASSETS.md。

/* global fetch, URL */
import { writeFileSync } from 'node:fs'

const SRC = 'https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json'
const OUT = new URL('../src/globe/coastline-110m.json', import.meta.url)

const round2 = (v) => Math.round(v * 100) / 100

const res = await fetch(SRC)
if (!res.ok) throw new Error(`拉取 land-110m 失败：HTTP ${res.status}`)
const topo = await res.json()

const [sx, sy] = topo.transform.scale
const [tx, ty] = topo.transform.translate

// 每条 arc 为 delta 编码的量化坐标序列：首点绝对、后续为增量，去量化后即 [lon, lat]（度）。
const lines = topo.arcs.map((arc) => {
  let x = 0
  let y = 0
  const out = []
  for (const [dx, dy] of arc) {
    x += dx
    y += dy
    out.push([round2(x * sx + tx), round2(y * sy + ty)])
  }
  return out
})

const json = JSON.stringify({ lines })
writeFileSync(OUT, json)
console.log(`已写出 ${lines.length} 条折线，${json.length} 字节 → src/globe/coastline-110m.json`)
