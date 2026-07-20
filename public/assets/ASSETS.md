# 素材登记（出处与许可）

| 文件 | 内容 | 分辨率 | 来源 | 许可 | 抓取日期 |
| --- | --- | --- | --- | --- | --- |
| textures/earth_day.jpg | 地球昼面（Blue Marble Next Generation, 2004-12） | 5400×2700 | NASA Earth Observatory <https://eoimages.gsfc.nasa.gov/images/imagerecords/74000/74218/world.200412.3x5400x2700.jpg> | NASA 影像公有领域（署名致谢 NASA Earth Observatory） | 2026-07-19 |
| textures/earth_night.jpg | 地球夜景灯光（Black Marble 2016） | 3600×1800 | NASA Earth Observatory <https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg> | NASA 影像公有领域（署名致谢 NASA Earth Observatory / NOAA / DoD） | 2026-07-19 |
| src/globe/coastline-110m.json | 世界海岸线矢量折线（130 条，[lon,lat] 度值） | 矢量 1:110m | world-atlas land-110m <https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json>（Natural Earth 1:110m 派生） | 公有领域（Natural Earth） | 2026-07-21 |

- 星空背景为程序化生成（无素材文件）；经纬网格（graticule）亦为程序化生成，零数据成本（SPEC-3.2a）。
- **earth_day.jpg / earth_night.jpg 为天气风格包专属（SPEC-3.9）、懒加载、不计入首包**（SPEC-3.2③/3.10）：
  矢量为默认风格，卫星昼夜大纹理退出默认 boot 加载路径，仅在 `?style=satellite`（DEV/测试）或未来天气风格包选用时才 fetch（REV-010 裁决 C）。
- **coastline-110m.json 计入首包**（矢量默认的首屏资源，SPEC-3.10）：由 `scripts/build-coastline.mjs`
  构建期一次性预转换（解码 land-110m 全部 arcs 为 [lon,lat] 折线、四舍五入 2 位小数），产物入库并静态
  import 进 bundle，运行期无 topojson 依赖、无 fetch。体积：源 TopoJSON ~55KB → 产物 JSON 76KB（gzip ~27KB），
  约占 2MB 首包预算 3.7%（gzip 计约 1.3%）。
- M5 性能分级备选：同源提供 2048 宽低档与 21600 宽高档，按需另行登记。
