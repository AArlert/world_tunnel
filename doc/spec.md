# spec — world_tunnel 单一事实源

产品/视觉/数据契约的唯一权威。代码中的期望值只准从本文推导；测试断言引用条目编号（SPEC-x.y）。
修改流程见 CLAUDE.md §7：加修改记录 → `make pin-spec` → 同步 testplan。

## 0. 修改记录

| 日期 | 版本 | 修改 |
| --- | --- | --- |
| 2026-07-19 | v0 | 初版：产品概述、布局、视觉、天文、数据契约、模型、交互、个性化、非目标 |

## 1. 产品概述

个人专属新闻信息流地球仪（对标 Ambient News Globe 形态）：可交互 3D 地球实时呈现全球事件——
突发新闻、自然灾害、地区冲突与人道危机，外加火箭发射、航班动态、加密行情。
点击事件可见附带信源链接的精简摘要；watchlist/分类过滤只看关心的。
单用户、纯客户端直连免费 API、零服务器；Web 优先（Vite+React+three.js），M5 经 Capacitor 打 iOS 包。

## 2. 界面布局

- **SPEC-2.1** 顶栏（48px）：品牌名 · 加密行情 ticker（M3）· UTC 时钟。
- **SPEC-2.2** 主区：全屏地球 canvas；右侧悬浮事件流面板（宽 300px，可折叠）。
- **SPEC-2.3** 事件详情卡：点击球面标记或列表条目弹出浮层——标题、分类徽章、severity、时间（相对+绝对）、地点、摘要、信源链接列表（≥1 条）。
- **SPEC-2.4** 设置入口（M4）：watchlist 管理、分类过滤、图层开关（航班）、摘要模式（信源/Claude）。

## 3. 地球视觉规格

- **SPEC-3.1** 几何：球半径 1.0，SphereGeometry 分段 ≥64；相机 fov 45°，初始距离 3.2。
- **SPEC-3.2** 昼夜混合：自定义 shader，`t = dot(N, sunDir)`；昼纹理 `earth_day.jpg`，夜纹理 `earth_night.jpg`（等距圆柱投影，来源见 public/assets/ASSETS.md）。晨昏线软过渡带 t ∈ [-0.1, +0.1]（半宽约 5.7°）内 smoothstep 混合。
- **SPEC-3.3** 夜景灯光：夜半球显示夜纹理城市灯光（亮度增益 ≥1.5）；昼半球不显示灯光。
- **SPEC-3.4** 大气：菲涅尔边缘辉光，主色 `#4a90d9`，从球缘向外衰减；不遮挡标记。
- **SPEC-3.5** 星空：程序化点星 ≥1500 颗，分布于半径 ≥40 球壳，随相机旋转（不随地球自转）。
- **SPEC-3.6** 纹理经度对齐：格林尼治（lat 0, lon 0）的球面标记必须落在昼纹理的非洲西侧几内亚湾位置（M1 校准场景验证）。
- **SPEC-3.7** 事件标记分类色表与分级：

| category | 颜色 | 含义 |
| --- | --- | --- |
| disaster | `#ff4d4f` | 自然灾害（地震/风暴/野火/火山…） |
| conflict | `#ff7a45` | 地区冲突 |
| humanitarian | `#ffc53d` | 人道危机 |
| news | `#40a9ff` | 突发新闻 |
| launch | `#b37feb` | 火箭发射 |
| flight | `#5cdbd3` | 航班（图层） |

  severity ∈ {1,2,3}：标记基础尺寸与脉冲光环幅度随级别递增；severity 3 必须有持续脉冲环。

- **SPEC-3.8** 性能：桌面 Chrome 目标 60fps；标记 ≥200 个时用 instancing/点精灵，不逐事件建 Mesh。

## 4. 天文计算（晨昏线）

- **SPEC-4.1** 太阳直下点纬度 = 太阳赤纬 δ（Cooper 公式）：`δ = 23.44° · sin(2π·(284+N)/365)`，N 为年积日。精度要求 ±1°（视觉用途）。
- **SPEC-4.2** 均时差（分钟）：`EoT = 9.87·sin(2B) − 7.53·cos(B) − 1.5·sin(B)`，`B = 2π·(N−81)/364`。
- **SPEC-4.3** 太阳直下点经度 = `−15° · (h_UTC − 12 + EoT/60)`，h_UTC 为 UTC 小数小时；结果归一化到 (−180°, 180°]。
- **SPEC-4.4** 单测锚点（容差 ±1°）：春分 3-20 δ≈0；夏至 6-21 δ≈+23.44°；冬至 12-21 δ≈−23.44°；均时差全年幅度 |EoT| ≤ 17 分钟；EoT≈0 的日期（如 4-15 前后）UTC 正午直下点经度 ≈ 0°。
- **SPEC-4.5** sunDir 向量 = 直下点 (lat, lon) 经 SPEC-6.2 坐标约定转成的单位向量；shader 每帧按当前时刻更新（可降频至 1 次/分钟）。

## 5. 数据源契约（全部免费、无需 key）

统一约束：**SPEC-5.0** 每源独立轮询与限流预算；HTTP 失败指数退避（基础间隔×2^n，上限 30min）；支持 ETag/Last-Modified 的源带条件请求；任何源故障不得影响其他源与渲染。

- **SPEC-5.1 USGS 地震** → category `disaster`
  - `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson`（启动时先拉 `all_day.geojson` 回填）
  - 轮询 60s。映射：`id=usgs:{feature.id}`；title=`M{mag} {place}`；lat/lon=geometry；ts=properties.time；url=properties.url。
  - severity：mag<4.5→1，4.5≤mag<6→2，mag≥6→3。
- **SPEC-5.2 NASA EONET 自然事件** → category `disaster`
  - `https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=7`，轮询 300s。
  - 映射：`id=eonet:{event.id}`；坐标取最新 geometry；categories[0].title 进 summary；sources[].url 为信源。severity 默认 2。
- **SPEC-5.3 GDACS 灾害/人道** → category `disaster` 或 `humanitarian`（事件类型含 DR/FL 且带人道响应字段时）
  - `https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP`，轮询 300s。
  - alertlevel Green/Orange/Red → severity 1/2/3。`id=gdacs:{eventid}`。
- **SPEC-5.4 GDELT 突发新闻/冲突** → category `news` 或 `conflict`（M3 起点细化查询词与判类规则，此处 pin 接口形态）
  - `https://api.gdeltproject.org/api/v2/doc/doc?query=...&mode=ArtList&format=json&maxrecords=50`，轮询 180s。
  - 无精确坐标的文章按国家/城市 gazetteer 兜底定位；无任何定位则丢弃（SPEC-5.4a）。
- **SPEC-5.5 Launch Library 2 火箭发射** → category `launch`
  - `https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=10&mode=list`，轮询 1800s（免费额 15 req/h，预算 ≤2 req/h）。
  - 坐标取发射工位；T-24h 内 severity 2，T-1h 内 3，其余 1。`id=ll2:{launch.id}`。
- **SPEC-5.6 OpenSky 航班图层** → category `flight`（默认关闭，开启才轮询）
  - `https://opensky-network.org/api/states/all?lamin=…&lomin=…&lamax=…&lomax=…`（当前视口 bbox），轮询 60s，匿名额度内；关图层立即停拉。severity 恒 1。
- **SPEC-5.7 CoinGecko 行情 ticker**（非地理事件，只进顶栏）
  - `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true`，轮询 60s；币种清单 M4 起可配置。

## 6. GeoEvent 模型与坐标约定

- **SPEC-6.1** 归一化模型（全源统一）：

```ts
interface GeoEvent {
  id: string          // "{source}:{原始id}"，全局唯一，跨轮询去重键
  category: 'disaster' | 'conflict' | 'humanitarian' | 'news' | 'launch' | 'flight'
  severity: 1 | 2 | 3
  title: string
  summary: string     // 信源自带描述；可为空串
  urls: string[]      // 信源链接，详情卡展示，≥1（flight 可为空）
  lat: number         // WGS84 度
  lon: number
  ts: number          // epoch ms（事件时间；无则用抓取时间）
  source: string      // 'usgs' | 'eonet' | 'gdacs' | 'gdelt' | 'll2' | 'opensky'
}
```

- **SPEC-6.2** 球面坐标约定（three.js 右手系，y 上）：北极 (90,·)→+Y；(0,0)→+Z；(0,90°E)→+X。实现：`src/globe/geo.ts` latLonToVector3。
- **SPEC-6.3** 同 id 事件再次出现视为更新（覆盖 ts/severity/summary），不新增标记；事件过期策略（默认 24h 无更新移除，flight 60s）。

## 7. 交互规格

- **SPEC-7.1** 拖拽旋转：水平绕 Y 无限制；垂直视角限制在纬度 ±85°；释放后惯性衰减（阻尼系数≈0.95/帧）。
- **SPEC-7.2** 缩放：滚轮/双指，相机距离 ∈ [1.8, 6]。
- **SPEC-7.3** 空闲自转：无输入 10s 后缓慢自转（≈0.02°/帧）；任何输入立即停。
- **SPEC-7.4** 点击标记/列表条目：相机 800ms 缓动飞行到该事件上空 + 弹详情卡（SPEC-2.3）；列表 hover/选中与球面标记高亮双向联动。

## 8. 个性化与通知（M4）

- **SPEC-8.1** watchlist 三类条目：地点（圆域：中心+半径 km）、主题（关键词，匹配 title+summary）、分类（category 集合）。多条目为「或」关系。
- **SPEC-8.2** 过滤模式：全部事件 / 仅 watchlist 命中。命中事件在列表与球面均有视觉强调。
- **SPEC-8.3** 通知：新事件命中 watchlist → Web Notification（M5 换 Capacitor Local Notifications）。**语义为「应用打开/前台时补齐」**，不承诺后台推送。
- **SPEC-8.4** 持久化：watchlist/设置存 IndexedDB；事件缓存可重建，不承诺离线完整性。
- **SPEC-8.5** Claude 摘要开关（默认关）：开启需用户自带 API key（仅存本机）；调用失败静默回退信源摘要。

## 9. 非目标

- 无服务器/账号系统/社交功能；无多端同步。
- 不承诺 iOS 后台常驻刷新与远程推送。
- ACLED 冲突专库需注册，默认不接（冲突类由 GDELT 判类兜底）；接入作为可选增强另行提案。
- 不做历史事件回放与全文检索（搜索仅限当前缓存事件与地名）。
