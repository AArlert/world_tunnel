# design-prompt — 守望最小闭环（FM-28）

> arch 撰写，rev 门禁通过后 orch 据此派 dev。只准约束实现，不准定义 spec 之外的对外可见行为（行为泄漏禁区，见 .claude/agents/arch.md）。
> 触发：REV-020 遗留义务 1（守望闭环涉数据核心「守望匹配」+ store「守望对象本地存」+ ui「过滤模式状态机」，属重大模块实现私有约束）。spec 已全部落定（无本 DP 提案）：
> SPEC-8.1 / 8.2 / 8.6（v0.3.4 pin，REV-020 放行）、SPEC-2.2 / 2.2a（v0.3.6 pin，REV-022 放行）、SPEC-3.1 / 6.1 / 6.2 / 7.2 均已 pin。
> **本 DP 全部为实现私有约束**：数据结构、匹配算法、持久化通道、导出签名、模块落点、切片顺序——均非对外可见行为，不需入 spec。凡对外可见取值/概念一律引 SPEC 条目号（在引用 spec 既定值，非在此定义新值）。
> 覆盖 feature-matrix：FM-28〔守望最小闭环〕（M3-11 / M3-12）。相邻卡边界见 §1「不做」与 §3.4 跨卡契约。

---

## 1. 目标与范围

**做什么**：落地守望最小闭环——**守望对象三类数据模型 → 守望匹配（纯函数）→ 本地持久化 → 「全部/仅守望命中」两态过滤（与分类过滤正交叠加）→ 「守望对象有无」状态暴露 → 开屏锚定数据通路**。落地 SPEC-8.1（M3 最小形态）/ SPEC-8.2（M3 仅命中模式）/ SPEC-8.6（引导采集的下游承接 + 锚定数据源）。

模块落点（与 FM-28 行「src/data/ 守望匹配 + src/store/ 守望对象本地存 + src/ui/ 过滤模式」逐段对齐）：
- `src/data/watch.ts`（新增）：`WatchTarget` 判别联合 + 守望匹配纯函数 + 锚点派生纯函数。零 three.js/React 依赖，沿用 data 层「WGS84 度值、可 node 单测」的可测性硬边界（比照 M2-data.md §2.1）。
- `src/store/watchlist.ts`（新增，新建 `src/store/` 目录）：守望对象集合本地持久化读写。落点依据见 §2.3。
- `src/App.tsx`（改）：守望集合状态 + 过滤模式状态 + 可见集组合（分类 ∩ 守望命中）+ `hasWatchTarget` 派生 + 过滤模式切换控件。复用现有 `visibleEvents` 过滤接缝。

**不做什么**（均属他卡或后续里程碑，本卡不实现）：
- **引导采集 UI 流程**（守望第一问界面、三类采集交互、垂类分流）→ **FM-15**（M3-13）。本卡只提供供引导写入的持久化 API（§3.2）与锚点派生（§2.6）。
- **globe 侧开屏锚定实现**（GlobeScene/GlobeControls 锚定参数、近景相机位姿、引导→球面接线）→ **FM-15**（feature-matrix「src/globe/ 锚定视角」+ M3-13）。本卡只提供锚点派生（数据通路）+ 消费接口契约（§3.4）。
- **安好态 / 中性空态的文案与渲染** → **FM-29**（M3-16，SPEC-2.2a）。本卡只暴露 `hasWatchTarget` 布尔（§2.5）；文案已在 SPEC-2.2a、渲染归 FM-29——**本卡不得写任何安好态/中性空态文案或分支渲染**（行为泄漏禁区）。
- **精细圆域交互**（中心+半径 km 精确输入）→ M4 精化（SPEC-8.1）。M3 地方守望复用引导已采集的粗粒度圆域，不新增精细圆域 UI。
- **全部模式下 inline 命中强调**（标示命中/非命中的新增视觉轴）→ M4 精化（SPEC-8.2，aes 付税 → arch 落 SPEC-8.2，REV-020 遗留义务 2）。M3 仅做隔离式呈现，零新增视觉轴。
- **多守望条目组合的复杂过滤逻辑** → M4 精化（SPEC-8.2 完整过滤）。M3 只做「或」集合 + 两态开关。
- **IndexedDB 完整持久化机制** → M4（SPEC-8.4）。M3 取最小本地存（§2.3）。
- **命中通知**（Web Notification）→ M4 / FM-19（SPEC-8.3）。
- 不为上述 M4 能力预留任何抽象层（精细圆域/复杂过滤/IndexedDB 迁移/命中态色编码）（极简，CLAUDE.md §1.2）。

**标识符纪律**：对外概念词为「守望」，代码标识符沿用 `watchlist`/`watch`（R7 裁定，REV-020）。

---

## 2. 约束（每条标 SPEC 锚点；对外概念/值均为引用 spec 既定项）

### 2.1 守望对象数据模型（SPEC-8.1 M3 最小形态）
- `WatchTarget` = 三类**判别联合**（`kind: 'place' | 'person' | 'theme'`），镜像 SPEC-8.1 守望对象三类。判别联合的 TS 编码（字段名、结构布局）属实现私有；字段**承载的概念**引 SPEC-8.1：
  - **地方**（`place`）：圆域中心 `lat`/`lon`（WGS84 度，SPEC-6.1/6.2）+ 半径 `radiusKm`（SPEC-8.1「地方（圆域：中心+半径 km）」）。
  - **人**（`person`）：一处地方（`lat`/`lon`/`radiusKm`）+ 一个名字标签 `label`（SPEC-8.1「人（一处地方 + 一个名字标签…本质为带标签的地方守望）」）。**薄层表达**——结构 = 地方 + label，匹配复用地方（§2.2），无独立匹配语义。
  - **主题**（`theme`）：关键词 `keyword`（SPEC-8.1「主题（关键词，匹配 title+summary）」）。
- `radiusKm` 的**具体取值**（大区域 vs 城市粗粒度圆域）由引导 FM-15 采集写入（SPEC-8.6①「地方（关注地/大区域…或一处关注城市的粗粒度圆域）」），**非本模块定值**；本模块只定义「圆域=中心+半径」的承载与匹配。M3 不新增精细圆域输入交互（SPEC-8.1 M3 最小，精细圆域属 M4）。
- `label` **纯本地、永不上传**（SPEC-8.1）：不参与匹配（§2.2）、不参与过期/排序，仅随守望对象本地持久化（供 FM-15 引导回显 / M4 设置展示）。上传禁区的结构性保证见 §2.3。

### 2.2 守望匹配算法（SPEC-8.1）
- **「或」集合语义**（SPEC-8.1「多守望对象为『或』关系」）：事件命中守望集 ⟺ 命中其中**任一**守望对象。空守望集恒不命中（`matchesWatchlist(e, []) === false`）。
- **地方/人圆域命中**（SPEC-8.1「地方（圆域：中心+半径 km）」）：事件 `(lat, lon)` 到圆域中心的**大圆角距 ≤ `radiusKm`** 即命中。人守望按其**所含地方**判命中、`label` 不参与匹配（SPEC-8.1「本质为带标签的地方守望」）。大圆距离算法与地球半径常数属实现细节（§4.1）。
- **主题关键词命中**（SPEC-8.1「主题（关键词，匹配 title+summary）」）：`keyword` 出现在事件 `title` **或** `summary`（SPEC-6.1 字段）中即命中；**子串包含**即「匹配/含」（M3-12「事件 title+summary 含关键词判命中」）。大小写口径见 §7 缺口 2（推荐大小写不敏感）。
- **匹配为纯函数**：无副作用、不读全局态、不触网；事件与守望集显式入参——保证单测可复现（M3-11/M3-12 单测辅助断言的达成前提）。

### 2.3 本地持久化（SPEC-8.6 承接 / SPEC-8.4 边界）
- 守望对象集合**本地持久化、重启存活**（SPEC-8.6「上述选择均本地持久化」）。M3-11 断言：写入后模拟重启（重新初始化从本地存回填）集合仍完整可读回。
- **M3 最小口径**：机制属实现自由度（SPEC-8.6；M3-11「IndexedDB 完整机制属 M4、本场景仅断言重启存活，机制属实现自由度」）。SPEC-8.4「守望/设置存 IndexedDB」的**完整机制属 M4**——故 M3 取**最小本地存**（localStorage，§3.2/§4.3），**不做 IndexedDB 完整化**，与事件缓存 `cache.ts` 完全解耦（`cache.ts` 头注已声明「watchlist/设置持久化不在此」）。
- **上传禁区（硬约束，SPEC-8.1 纯本地永不上传 + §9 阶段一零服务器）**：持久化通道必须**纯本地、零网络**——模块内不得有任何 `fetch`/`XHR`/上传；守望数据（尤其 `label`）不得进入数据层 provider/scheduler 的任何网络请求 payload。守望是事件流的**下游只读消费者**（单向：读事件、不写网络），守望数据永不回流到 provider 层。localStorage 天然满足（同步 API、无网络出口），此即 M3-11「本地存写入/读回不触发对外网络请求、label 不出现在任何请求 payload」断言的结构性达成方式。

### 2.4 过滤模式与正交叠加（SPEC-8.2 / SPEC-8.1 正交）
- **两态过滤模式「全部事件 / 仅守望命中」**（SPEC-8.2 M3「过滤模式『全部事件 / 仅守望命中』两态」），可双向切换（M3-12「两态且可切换」）。切换控件的**存在性**由 SPEC-8.2 两态 + M3-12「可切换」要求；控件的形态/位置/首屏可见性属 **UI 实现自由度**（spec 未 pin，不作首屏可见硬断言——保持极简，QA 定位靠 dev 提供的稳定选择器）。
- **「仅守望命中」态 = 隔离式呈现**（SPEC-8.2「仅呈现命中事件…非命中事件从球面与列表两处隐藏，隔离即强调」）：命中事件经既有球面光柱（SPEC-3.7）与事件流列表（SPEC-2.2a）渲染，非命中事件隐藏。
- **复用同类显隐机制**（SPEC-8.2「复用与分类过滤 SPEC-2.4① 同类的显隐机制，不新增视觉轴」）：守望过滤必须与六开关分类过滤**复用同一过滤接缝**——现 `App` 的 `visibleEvents` useMemo，其结果同时喂标记层（`GlobeScene.setEvents`）与面板（`EventPanel`），两处天然同步。**不新建独立显隐路径、不新增标记/列表视觉编码轴**。
- **正交叠加**（SPEC-8.1「分类过滤与守望命中为正交筛选轴…二者自然叠加（显示类别内的守望命中）」）：可见集 = 分类显示集 ∩ 守望命中集。组合谓词：`enabled.has(e.category) && (mode === 'all' || matchesWatchlist(e, watchlist))`。关闭某分类 → 该类事件即使命中守望也不呈现；重开恢复其命中项（M3-12 正交叠加断言）。
- **默认过滤模式**：读法 = 「全部事件」，锚 SPEC-2.2 静息核心（须含事件光柱标记，见 §7 读法 A / 缺口 1）。

### 2.5 「守望对象有无」状态暴露（SPEC-2.2a / SPEC-8.1）
- 「守望对象有无」是本模块对外暴露的状态（SPEC-2.2a：事件流空态「依守望对象有无（SPEC-8.1/8.6）二分呈现」）。派生自守望集合：`hasWatchTarget = 守望集合非空`。
- **供 SPEC-2.2a 安好态二分消费（FM-29 / M3-16）**：有 ≥1 守望对象且列表空 → 安好态；无守望对象且列表空 → 中性空态。**本模块只暴露该布尔值并把它传到面板 prop**；安好态/中性空态的**文案与分支渲染属 FM-29**（M3-16，文案已在 SPEC-2.2a）——本卡不写文案、不写分支渲染（行为泄漏禁区 + 卡边界）。
- **供 FM-15 引导写入**：引导采集三类守望对象后写入守望集合（SPEC-8.6①），`hasWatchTarget` 随之翻真。写入 API 见 §3.2/§3.3。
- 「仅守望命中 + 空守望集」边界：`mode==='watched'` 且守望集为空 → 可见集空 → `hasWatchTarget===false` → 落中性空态（FM-29）。是否禁用/隐藏该态下的切换属 UI 自由度，非 spec 约束（不作硬判据）。

### 2.6 开屏锚定数据通路（SPEC-3.1 / SPEC-8.6 / REV-020 §7-4）
- 地方/人守望驱动开屏锚定（SPEC-3.1「守望选定关注区域 → 冷启动初始视角改为近景该区域」+ SPEC-8.6「地方守望同时驱动开屏锚定…为 M3 开屏锚定的唯一数据源」）。
- 本模块提供**锚点派生纯函数**：守望集合 → 锚点 `{lat, lon} | null`。有地方/人守望取其圆域中心为锚点；无地方/人守望返回 `null` → globe 侧回落 SPEC-3.1 默认几内亚湾视角（SPEC-8.6「跳过或未选地方守望时，开屏锚定回落 SPEC-3.1 默认视角」）。
- **多地方沿用单区域语义**（REV-020 §7-4「沿用现行单区域锚定语义（D8），未新增行为」）：取守望集合中**首个**地方/人守望的圆域中心为锚点；选取策略（首个/主关注）属实现细节/M4 精化，本模块取首个即最小落地。
- 锚点为**冷启动构造时一次性**消费（SPEC-3.1「冷启动初始视角」）：不做会话内实时重锚（守望变更不触发相机跳转）。
- **globe 侧消费属 FM-15**（GlobeScene/GlobeControls 锚定参数 + 近景距离/角度 + 引导→球面接线 + App 侧 anchor 接线）；本模块只提供锚点派生 + §3.4 接口契约。近景距离属实现自由度（M3-13），须落 SPEC-7.2 相机距 [1.8, 6]。

---

## 3. 接口与导出签名（实现私有；对外行为只引 spec）

### 3.1 `src/data/watch.ts`（FM-28 新增）

| 导出 | 签名 | 用途 | SPEC |
| --- | --- | --- | --- |
| `WatchTarget` | 判别联合 `PlaceWatch \| PersonWatch \| ThemeWatch`（`kind` 判别） | 守望对象三类模型 | SPEC-8.1 |
| `matchesWatchTarget` | `(event: GeoEvent, target: WatchTarget) => boolean` | 单对象命中（地方/人圆域、主题关键词） | SPEC-8.1 |
| `matchesWatchlist` | `(event: GeoEvent, targets: readonly WatchTarget[]) => boolean` | 「或」集合命中；空集恒 false | SPEC-8.1 |
| `WatchAnchor` | `{ lat: number; lon: number }` | 开屏锚点值类型 | SPEC-3.1 |
| `watchlistAnchor` | `(targets: readonly WatchTarget[]) => WatchAnchor \| null` | 首个地方/人守望 → 锚点；无则 null | SPEC-3.1 / 8.6 / REV-020 §7-4 |

- 字段布局（`PlaceWatch { kind:'place'; lat; lon; radiusKm }` 等）属实现私有，dev 自定；`GeoEvent` 从 `../data` 引入（`lat`/`lon`/`title`/`summary`，SPEC-6.1）。
- **禁止 import three**（沿用 data 层可测性硬边界，M2-data.md §2.1）。

### 3.2 `src/store/watchlist.ts`（FM-28 新增，新建 `src/store/` 目录）

| 导出 | 签名 | 用途 | SPEC |
| --- | --- | --- | --- |
| `loadWatchlist` | `() => WatchTarget[]` | 同步从本地存读回；缺失/解析失败返回 `[]` | SPEC-8.6 |
| `saveWatchlist` | `(targets: readonly WatchTarget[]) => void` | 同步覆盖式写入本地存 | SPEC-8.6 |

- 持久化格式（JSON、localStorage key）与解析容错属实现私有（§4.3）。**通道零网络**（§2.3 硬约束）。
- 目录落点理由：CLAUDE.md §2 仓库结构预留 `src/store/（状态）`，FM-28 行「src/store/ 守望对象本地存」明列此落点；与 `src/data/`（事件流数据核心）分层——守望是应用态而非事件流数据，且需与事件 `cache.ts`（IndexedDB 异步）解耦以支撑**同步**读（§4.4 锚定无竞态）。

### 3.3 `src/App.tsx` 接线变更（FM-28）
- 守望集合状态：`const [watchlist, setWatchlist] = useState<WatchTarget[]>(() => loadWatchlist())`——**同步 seed 自本地存**（§4.4）。
- 过滤模式状态：`const [watchMode, setWatchMode] = useState<'all' | 'watched'>('all')`（默认 'all'，§2.4 / §7 读法 A）。
- 可见集组合（改现有 `visibleEvents` useMemo）：`enabled.has(e.category) && (watchMode === 'all' || matchesWatchlist(e, watchlist))`（§2.4 正交叠加）。
- `hasWatchTarget`：`const hasWatchTarget = watchlist.length > 0`（§2.5），传入面板（经 GlobeStage → EventPanel）。
- 写入 + 持久化路径：一处 setter 同时更新 state 与落盘（`setWatchlist(t); saveWatchlist(t)`，或 `useEffect([watchlist]) → saveWatchlist`）；供 FM-15 引导调用。
- 过滤模式切换控件：`watchMode` 的双态切换 UI（存在性依 M3-12，形态/位置属自由度，§2.4）；dev 加稳定选择器供 e2e 定位。

### 3.4 跨卡接口契约（路径/签名共享，非本卡实现项）

> 以下为 FM-28 与相邻卡的**共享接口契约**——供 FM-15 / FM-29 dev 参照对齐，**实现归各自卡**。仅共享路径/签名/SPEC 锚点（合 CLAUDE.md 实例隔离纪律）。

- **与 FM-15（引导 + globe 锚定）**：
  - FM-15 引导采集后经 §3.3 写入路径落盘（`saveWatchlist` + App state 更新）。
  - FM-15 消费 `watchlistAnchor(watchlist)`（§3.1，FM-28 提供含单测的纯派生）驱动 globe 侧锚定。**建议消费接口契约**（FM-15 实现）：`GlobeSceneOptions` 增 `anchor?: WatchAnchor | null`；`GlobeControls` 构造增可选初始位姿参数（默认回落现有 `INITIAL_*` 常量，向后兼容现调用点）；App 侧把 `watchlistAnchor(watchlist)` 经 GlobeStage 透传给 GlobeScene，**仅构造时一次性**消费（不入 effect deps，§4.4）。锚点→相机位姿逆变换公式见 §4.2。
- **与 FM-29（安好态 / 中性空态）**：
  - `EventPanel` 增 `hasWatchTarget: boolean` prop——**FM-28 供值**（自 §3.3 派生并透传），**FM-29 消费并渲染二分**（M3-16，文案锚 SPEC-2.2a）。
  - 落地顺序（log v0.3.6「安好态守望分支依 FM-28 store，先落无守望中性分支」）：FM-29 骨架先落中性分支（`hasWatchTarget` 默认 false）；FM-28 落地后透传真值激活安好态分支。**FM-28 只连值、不写文案/分支**；`prop` 声明由先落卡引入、后落卡对齐同名同签，互不写对方半边。

---

## 4. 实现提示（不构成强约束）

### 4.1 圆域大圆距离（§2.2 地方/人命中）
- haversine 大圆角距 → km，`EARTH_RADIUS_KM = 6371`（平均半径，开源常用值，D29 开源优先）。判定 `距离 ≤ radiusKm` 即命中。度→弧度换算注意；经度跨 ±180° 由 haversine 天然处理，无需特判。

### 4.2 锚点 → 相机位姿逆变换（§2.6 / §3.4，供 FM-15 消费）
- 由 SPEC-6.2 正变换（`latLonToVector3`：`P=(cosφ·sinλ, sinφ, cosφ·cosλ)`）反解，相机恒 `lookAt(0,0,0)`、位于 `normalize(P)·distance`：
  - `azimuthRad = lon·DEG`
  - `polarRad = (90 − lat)·DEG`，**clamp 到 `[MIN_POLAR, MAX_POLAR]`**（controls 现值 5°/175°，SPEC-7.1 纬度 ±85° 上限，防极区越界）
  - `distance` = 近景值（自由度，须 ∈ SPEC-7.2 [1.8, 6]）
- 与 `GlobeScene.applyCamera` 注释「latLonToVector3(90−polar, azimuth) 同源」一致，可复用现有 `applyCamera` 路径。

### 4.3 本地持久化格式（§2.3 / §3.2）
- localStorage key 建议 `worlens.watchlist`（命名自由度）。`saveWatchlist` = `JSON.stringify(targets)`；`loadWatchlist` = `JSON.parse` + 基本形状校验（非数组/解析异常 → 返回 `[]`，不抛）。M3 最小不做 schema 版本迁移（YAGNI；M4 IndexedDB 升级时再议，SPEC-8.4）。

### 4.4 已知陷阱
- **同步 seed 保锚定无竞态**：`watchlist` 必须用 `useState(() => loadWatchlist())` 惰性初始化器**同步**读回，使 GlobeStage 首次挂载（其 GlobeScene 构造 useEffect）时 `watchlistAnchor(watchlist)` 已反映持久层——避免 IndexedDB 异步回填与构造时锚定的时序竞态（选 localStorage 而非复用 `cache.ts` 的核心动因）。
- **锚定构造时一次性**：GlobeScene 锚定参数由 FM-15 在构造 useEffect（`[]` deps）内消费，**不得**把 anchor 加入 effect deps（否则守望变更会重建 GlobeScene / 相机跳变，违 SPEC-3.1「冷启动初始视角」非实时跟随语义）。
- **首启引导时序**：极首次启动（本地存空）时锚定回落默认；引导写入守望后的正向锚定依赖「引导先于 globe 挂载」的时序——属 FM-15 引导流程职责（M3-13 正向用例前置持久化后冷启动即可测），本卡不承接。
- **可见集组合幂等**：`watchMode==='all'` 时守望谓词短路为恒真，可见集 == 现分类过滤结果——保证 M2-19（分类过滤，现 🔲 回退重测）与默认态 M3-14 行为不因本卡引入而变（默认 'all' 不改现状）。

---

## 5. 验收判据

### 5.1 dev 自检
- `make lint` 通过（tsc strict + eslint）；`src/data/watch.ts` 零 three.js import（可 node 单测，§3.1）。
- 相关单测本地跑通：守望匹配（地方圆域命中/边界、主题子串命中、人=地方命中 label 不参与、「或」集合、空集恒 false）、锚点派生（有地方/人取首个、无则 null、多地方取首个）、持久化 round-trip（写入→读回一致、缺失/坏数据→[]）——这些同时是 M3-11 / M3-12 单测辅助的实现侧自检。
- 现有回归不回退：M2-19（分类过滤）、M3-14（默认静息态）行为不变（§4.4 幂等）。

### 5.2 建议 qa 覆盖检查点（只列检查点，断言由 qa 从 SPEC 推导）

**M3-11（守望对象采集与本地持久化，单测）**
- 三类守望对象均可写入集合（地方/人/主题）（SPEC-8.1 / 8.6①）。
- 人类结构含地方 + label 两部分（SPEC-8.1）。
- 本地存写入/读回**不触发任何对外网络请求**（fetch/XHR）、label 不出现在任何请求 payload（SPEC-8.1 纯本地 + §9）——结构性达成见 §2.3。
- 多守望对象以集合承载（本场景仅断言集合承载，命中判定归 M3-12）（SPEC-8.1「或」）。
- 模拟重启（重初始化从本地存回填）集合完整存活可读回（SPEC-8.6 / SPEC-8.4 M3 本地存闭环）。
- M3 边界：精细圆域、持久化完整化属 M4，不在本场景（SPEC-8.1 M4 精化）。

**M3-12（仅守望命中过滤 + 分类正交，e2e + 单测辅助匹配）**
- 两态「全部事件 / 仅守望命中」可切换（SPEC-8.2 M3）。
- 全部态命中+非命中均呈现；仅命中态命中经球面光柱 + 列表呈现、非命中从两处隐藏（SPEC-8.2 隔离式）。
- 匹配判定（单测辅助）：地方按经纬度落圆域、主题按 title+summary 含关键词、人按所含地方（SPEC-8.1 / 8.6①）。
- 分类正交叠加：关闭某分类 → 该类命中项也不呈现、重开恢复（SPEC-8.1 正交）。
- 零命中子情形：本场景已设 ≥1 守望对象，仅命中态零命中 → 落 SPEC-2.2a 安好态分支（安好态渲染归 FM-29，本场景据 SPEC-2.2a 断言其触发；机位注记见 M3-12 行）。
- M3 边界：inline 命中强调、多守望组合复杂过滤属 M4（SPEC-8.2 M4）。

**M3-13（守望第一问引导 + 开屏锚定）——归 FM-15，非本卡**
- 本卡只提供 `watchlistAnchor` 派生（含单测）+ 持久化写入 API；引导 UI、globe 锚定接线、正/负向锚定 e2e 属 FM-15（§1「不做」/§3.4）。M3-13 于 FM-15 dev 卡开卡时由 qa 覆盖。

---

## 6. 实现切片（最小可闭环，供 orch 派单）

- **切片① 数据模型 + 匹配 + 锚点派生 + 本地持久化**：`src/data/watch.ts`（`WatchTarget` + `matchesWatchTarget`/`matchesWatchlist` + `watchlistAnchor`）+ `src/store/watchlist.ts`（`loadWatchlist`/`saveWatchlist`）。纯逻辑 + 持久化，无 UI 接线。**可闭环验证**：M3-11（采集 + 持久化）+ 匹配/锚点纯函数单测（M3-12 单测辅助）。
- **切片② 过滤模式 UI 组合 + hasWatchTarget 暴露**：`App.tsx` 守望集合状态 + `watchMode` 两态 + 可见集正交组合（分类 ∩ 守望）+ 切换控件 + `hasWatchTarget` 透传。**可闭环验证**：M3-12（两态切换 + 隔离呈现 + 分类正交，e2e）。

> 切片①即一段可独立验证的活（纯函数 + 持久化单测可复跑），建议先 `/closeout`；切片② 依赖①的匹配/派生落地。锚点派生随①落地并单测；其 **globe 侧消费与 M3-13** 属 FM-15 卡，本卡两切片不含 globe/引导接线。

---

## 7. 缺口清单与实现读法裁决

### 缺口清单（spec 未覆盖的对外可见行为，待 orch 走 §7；本卡不自行定值）

1. **默认过滤模式未显式 pin**（对外可见——决定冷启动呈现）。本卡取读法 A（默认='全部事件'，见下），锚 SPEC-2.2 静息核心「事件光柱标记」。**若 rev 判 SPEC-2.2 不足以 pin 默认过滤模式**，则需一条 SPEC-8.2 微条目明确默认='全部事件'，方可让 QA 从 spec 直接断言默认态。请 rev 门禁时裁决此读法是否成立、或转 §7 提案。
2. **主题关键词大小写口径未 pin**（对外可见——决定 "Syria" 是否匹配 "syria"）。SPEC-8.1「关键词，匹配 title+summary」+ M3-12「含关键词」只锚定**子串包含**，未定大小写。推荐读法：**大小写不敏感子串**（`toLowerCase` 双侧）——健壮关键词搜索的常规读法。QA 若只断言**同大小写**子串命中则纯 spec 可导、无需此条；若要断言**大小写不敏感**命中，则需 rev 确认该读法或补 SPEC-8.1 微澄清。请 rev 门禁时一并裁。
3. **引导预设区域目录取值**（东亚/中东/北美等大区域的圆域中心+粗粒度半径 km；一处关注城市的粗粒度圆域取值）——对外可见（决定匹配命中范围 + 开屏锚定落点），SPEC-8.6① 只举例名称、未 pin 取值。**属 FM-15 引导内容**（非 FM-28）：本卡匹配/锚定以「圆域=中心+半径」为输入、不依赖具体目录，M3-11/M3-12 单测用合成守望对象即可测，**非 FM-28 阻断**。登记备 orch：FM-15 开卡前这批预设取值需走 §7 pin（否则 M3-13 正向锚定 e2e 无 spec 可导的期望坐标）。

### 实现读法（非 spec 提案；derivable 或已 pre-settled，dev 按此实现，rev 门禁复核）

- **A. 默认过滤模式 = 「全部事件」**——锚 SPEC-2.2「静息核心 = 地球 canvas + **事件光柱标记（SPEC-3.7）** + UTC 时钟」：默认过滤模式不得隐藏静息核心的事件光柱标记，故默认不可为「仅守望命中」（无守望对象/零命中时将清空光柱、违静息核心）；「全部事件」是与 SPEC-2.2 静息核心自洽的唯一读法，且与 M3-14（默认态含光柱标记）一致。**（此读法未经预仲裁，列缺口 1 待 rev 门禁确认。）**
- **B. 主题关键词 = 大小写不敏感子串**——见缺口 2，健壮读法，待 rev 门禁确认 QA 断言口径。
- **C. 多地方锚点 = 首个地方/人守望**——**REV-020 §7-4 已裁**「沿用现行单区域锚定语义（D8），未新增行为…列 per-DEV/M4 细化」。取首个即最小落地，选取策略精化属 M4；dev 据此实现，非待确认项。
- **D. 人守望匹配 ≡ 地方匹配**——SPEC-8.1「人…本质为带标签的地方守望」直接可导：人按其所含地方圆域判命中，`label` 不参与匹配（仅本地持久化 + FM-15 回显）。derivable，非待确认项。

### 遗留风险
- 缺口 1/2 为本卡 rev 门禁的必答裁项（默认模式读法、关键词大小写 QA 口径）；缺口 3 是 FM-15 开卡前置（预设区域取值 pin），非本卡阻断。
- FM-15 / FM-29 跨卡 prop 声明的落地顺序（§3.4）：若两卡并行，需 orch 明确先落卡引入 `anchor` / `hasWatchTarget` prop 声明，后落卡对齐——避免半连线 dead code（外科手术纪律）。本 DP 已给同名同签契约降低冲突面。
