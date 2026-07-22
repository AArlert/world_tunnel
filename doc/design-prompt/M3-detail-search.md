# design-prompt — 详情卡 + 相机飞行 + 搜索（FM-14）

> arch 撰写，rev 门禁通过后 orch 据此派 dev。只准约束实现，不准定义 spec 之外的对外可见行为（行为泄漏禁区，见 .claude/agents/arch.md）。
> 触发：FM-14〔详情卡 + 搜索〕。spec 已落定（v0.3.6 pin）：SPEC-2.3（详情卡 L1，v0.3.0 REV-015）、SPEC-2.5（搜索）、SPEC-7.4（点击→飞行+详情卡）、SPEC-5.10（信任表，`src/data/trust.ts` 已实现，M3-07 ✅）、SPEC-2.2 v0.3.6（今日刻痕抽屉语境，REV-022）。
> **本 DP 不提案不改 spec**。凡对外可见取值/行为一律引 SPEC 条目号（引用 spec 既定值，非在此定义新值）；spec 未覆盖处列 §7 缺口清单，待 orch 走 CLAUDE.md §7，**不默选**。
> **搜索（SPEC-2.5）落地前置**：§7 有**两条 spec 级缺口**（GAP-1 入口 co-resolve / GAP-2 gazetteer 数据源），均须先经 §7 仲裁——**切片③（搜索）在两缺口裁定前不开卡**；切片①②（详情卡、飞行）无缺口，门禁过即可派。

---

## 1. 目标与范围

**做什么**：为 M3 交付 FM-14 三件互相咬合的活——
1. **事件详情卡**（`src/ui/DetailCard.tsx` 新建）：点击球面标记或事件流列表条目弹出 L1 浮层，逐项渲染 SPEC-2.3 全字段，信源名/信任等级取 `src/data/trust.ts`（SPEC-5.10，唯一 L1 消费方）。
2. **相机飞行**（扩 `src/globe/controls.ts` + `src/globe/GlobeScene.ts`）：点击标记/列表 → 相机 800ms 缓动飞行到该事件上空（SPEC-7.4）；飞行入口同时服务搜索命中（SPEC-2.5）。
3. **搜索**（`src/ui/SearchBox.tsx` + `src/data/search.ts` 新建，**门禁于 §7 两缺口**）：缓存事件（标题/信源名）与本地地名 gazetteer 的本地匹配，命中分发（事件→飞行+详情卡 / 地名→飞行），空态提示（SPEC-2.5）。

**不做什么**（极简 + 行为泄漏禁区）：
- 不做全文检索、不做跨源事件聚类/语义融合/AI 摘要（SPEC-2.3 去重呈现句、§9、SPEC-8.5——付费阶段二）。
- 不为 T4/RSS 自定义信源预留任何抽象（SPEC-5.9 归 M6）。
- **不新增任何 GeoEvent 字段**：信任分级由 `source` 经 `trust.ts` 派生（SPEC-5.10）、地名不入模型；沿用 SPEC-3.7「颜色由 category 经表派生、不入模型」先例。
- **不定义 spec 之外的用户可见字符串/映射**：severity 只渲染 SPEC-6.1 数值 `1|2|3`，**不得**新造「轻/中/重」等文字档位标签；分类徽章文案只复用既有单一分类标签源（§2.2），**不另立**。
- **不在详情卡之外**渲染任何信源显示名/信任等级文案（M3-10 负向，SPEC-5.10「L0 不编码信源/分级」）。
- 不发起任何指向应用自身/后端的网络请求（SPEC-2.3 零服务器、§9 阶段一零服务器）。
- 搜索的**入口位置**与 **gazetteer 地名半部**不在本 DP 定死——两者各挂 §7 缺口（GAP-1/GAP-2），裁定后再落实现。

---

## 2. 约束（每条标 SPEC 锚点；对外值均为引用 spec 既定值）

### 2.1 详情卡浮层结构与弹出/关闭/层级（SPEC-2.3 / SPEC-7.4）
- 详情卡为**点击触发的 L1 浮层**（SPEC-2.3「点击…弹出浮层」）：触发源两处——① 球面标记点击；② 事件流列表条目点击（SPEC-7.4「点击标记/列表条目…弹详情卡」）。二者打开同一详情卡、渲染同一 GeoEvent。
- 浮层为「点击聚焦的 L1 视图」，**渲染层级在地球 canvas 与「今日刻痕」抽屉之上**（浮层语义的实现，非新对外行为）；顶栏（SPEC-2.1）与六开关（SPEC-2.4①）无须被遮蔽、保持可交互。**精确 z-index、浮层尺寸/位置、进出动效属 UI 实现自由度**。
- 提供**关闭途径**（浮层可关是 SPEC-2.3「浮层」的内在语义）；关闭方式（关闭控件／点击浮层外／Esc）与其可视形态属实现自由度。**本节不定义 SPEC-2.3 之外的对外可见交互语义**。
- 一次仅呈现一张详情卡（对应当前选中事件）；无选中事件时不渲染浮层。

### 2.2 详情卡字段渲染口径（逐字段，SPEC-2.3 全清单）
SPEC-2.3 字段清单 = 标题 / 分类徽章 / severity / 时间（相对+绝对）/ 地点 / 摘要 / 信源名与信任等级 / 信源链接列表 / 轻量纠错反馈入口。逐项数据源与口径：

| 字段 | 数据源 / 口径 | SPEC 锚点 |
| --- | --- | --- |
| 标题 | `event.title` 原文 | SPEC-6.1 `title` |
| 分类徽章 | **主体 = 分类色**（`CATEGORY_COLORS[category]`，`markers.ts` 现导出，唯一色表）；若附文字标签，**只复用既有单一分类标签源**（`App.tsx` `CATEGORY_LABELS`，M2 六开关已用），**不另立第二份字符串** | SPEC-3.7（色）；标签见 §7 观察项 |
| severity | 渲染 SPEC-6.1 数值 `1|2|3`（SPEC-2.2a 明示「其数值展示属详情卡 SPEC-2.3」）；**禁**新造文字档位标签 | SPEC-2.3 + SPEC-2.2a + SPEC-6.1 |
| 时间 | 取 `event.ts`，**相对+绝对并陈**；相对时间复用 SPEC-2.2a③ 现有相对时间格式（`EventPanel.relativeTime`，宜抽为共享 util 保单一源）；绝对时间格式属实现自由度。**断言口径：仅可断取值来源为 `ts` 且相对/绝对两呈现皆存在，不得断言 `ts`=真实发布/更新时刻（REV-015 R-1/R-2）**；**不展示** `lastSeen`（SPEC-6.3① 内部记帐） | SPEC-2.3 时间语义 + SPEC-6.1 `ts` |
| 地点 | 取 `event.lat`/`event.lon` 格式化坐标（M3 GeoEvent **无人读地名字段**，人读地名解析属 T2/T3 FM-13、不在 M3）；坐标格式属实现自由度 | SPEC-6.1 `lat`/`lon`（读法见 §7） |
| 摘要 | `event.summary` 原文（**可为空串**，SPEC-6.1）；空串时的呈现（隐藏该区/占位）属实现自由度 | SPEC-6.1 `summary` |
| 信源名 + 信任等级 | **唯一取自** `getSourceTrust(event.source)`（`src/data/trust.ts`，SPEC-5.10）→ `{displayName, tier}`；**禁**在详情卡内另写显示名/等级字面量（行为泄漏禁区 + SPEC-5.10 单一源） | SPEC-5.10（表）+ SPEC-2.3 |
| 信源链接列表 | `event.urls`（≥1，SPEC-6.1）逐条为外链；**去重呈现**：`urls.length>1` 时**可**呈现链接条数（如「N 条链接/报道」），**文案不得暗示「N 个信源」式跨源多信源汇集**；`length===1` 不强制呈现计数（SPEC-2.3「可呈现」非强制） | SPEC-2.3 去重呈现（M-1 修正文本）+ SPEC-6.1 `urls` |
| 纠错反馈入口 | 见 §2.3 | SPEC-2.3 纠错反馈句 |

### 2.3 纠错反馈入口——零服务器（SPEC-2.3 / SPEC-8.7 / §9）
- 一处轻量入口，点击打开 **`mailto:` 或仓库 issue 链接**；渠道二选一属实现自由度（SPEC-2.3「具体渠道…属实现自由度」）。目标地址/issue 仓库 URL 为**配置常量**（dev/orch 定值，宜单常量、不散落）。
- **链接目标/预填内容含该事件 `id` 或标题等定位上下文**（SPEC-2.3「预填事件 id/标题/信源」）。
- **对外契约 = 零服务器 + 预填事件上下文 + 打开外部 mail/issue**：实现为普通导航（`<a href>` 或 `window.open`），**不得产生任何 fetch/XHR、不得发起任何服务端提交**（SPEC-2.3 零服务器、§9 阶段一零服务器、SPEC-8.7）。

### 2.4 相机飞行（SPEC-7.4）
- 触发：点击标记/列表条目 → 相机**缓动飞行到该事件上空**；同一飞行入口复用于搜索事件命中与地名命中（SPEC-2.5「飞行走 SPEC-7.4」）。
- **飞行时长 = 800ms（SPEC-7.4 pin，非实现自由度）**；缓动曲线形状属实现自由度。
- **目标机位 = 相机方向对准事件当前世界方向**（球面「上空」）：由事件经纬度换算目标方位角/仰角（见 §4.2 换算），仰角钳位 ±85°（SPEC-7.1）。目标距离 SPEC-7.4 未 pin，属实现自由度、须落在 SPEC-7.2 `[1.8,6]`（保留现距或收近皆可）。
- 飞行为**用户点击触发的瞬态过渡**（800ms 后归静止），非常驻动画——与 SPEC-3.11a 稳态零动画不冲突（稳态指无交互输入时；飞行是显式输入的结果）。
- 飞行须与既有交互状态机自洽（SPEC-7.1/7.2/7.3）：飞行期间相机位姿由飞行过渡驱动、飞行结束回落空闲计时（SPEC-7.3）；飞行不改变地球本体自转语义（SPEC-7.3 自转作用于地球本体）。

### 2.5 搜索（SPEC-2.5）——核心口径 + 两处 §7 门禁
> **本节含两处待 §7 裁定的 spec 缺口（§7 GAP-1/GAP-2），标注【门禁】。切片③在两缺口裁定前不开卡。** 未标【门禁】者为 SPEC-2.5 已定、不待裁决。
- **范围（本地、零网络）**：仅当前本地缓存事件（`store.snapshot()`）与本地地名 gazetteer；**不发起网络请求、不做全文检索**（SPEC-2.5、§9）。
- **缓存事件匹配（稳定，无门禁）**：按 `event.title`（SPEC-6.1）+ 信源名（`getSourceTrust(source).displayName`，SPEC-5.10）子串匹配；「已解析地名字段」在 M3 仅 T1 事件、**无人读地名字段**故为空（并入 GAP-2）——即 M3 缓存事件搜索实为**标题 + 信源名**匹配，对 T1 事件可用（对齐 REV-018 F-3 收窄读法）。
- **地名 gazetteer 匹配【门禁 GAP-2】**：SPEC-2.5「本地地名 gazetteer（与 SPEC-5.8 T2 同一份精简 GeoNames）」——**该资产当前不存在**（自查见 §7 GAP-2），且 T2/FM-13 拟随批⑤R4 后移 M4。此半部随 §7 GAP-2 裁定落地。
- **命中分发（SPEC-2.5 + SPEC-7.4）**：命中**事件** → 相机飞至该事件上空（§2.4）+ 打开详情卡（§2.1）；命中**地名** → 相机飞至该坐标（§2.4，无详情卡，地名非事件）。地名分支随 GAP-2 落地。
- **空态**：无匹配时明确空态提示「当前缓存内无匹配」（SPEC-2.5）；此为搜索独立空态，**不并入** SPEC-2.2a 安好态（SPEC-2.2a 末句、SPEC-2.5）。
- **入口位置【门禁 GAP-1】**：SPEC-2.5「入口为事件流面板顶部搜索框」在 SPEC-2.2 v0.3.6 重铸后有名称漂移 + 默认收起可达性张力（REV-022 §6.1）——**入口落点随 §7 GAP-1 裁定**，本 DP 不定死。

### 2.6 L0 负向结构保证（M3-10 / SPEC-5.10）
- 信源显示名 / 信任等级文案（`trust.ts` 表任一取值：USGS / NASA EONET / GDACS / Launch Library 2 / OpenSky / GDELT / 「权威事件源」/「新闻报道（待验证）」）**只准出现在详情卡组件**（`DetailCard.tsx`）。
- **结构保证**：`getSourceTrust` / `SOURCE_TRUST` 的唯一 UI 消费方为 `DetailCard.tsx`；事件流列表行（`EventPanel.tsx`，SPEC-2.2a 三要素=分类色圆点/标题/相对时间）与球面标记（`markers.ts`）**不 import、不渲染** trust 表任何字段（SPEC-5.10「L0 球面标记与事件流列表行不编码信源/分级」、D23 L0 三变量）。
- 同一事件打开详情卡后方可见上述文案（验证「仅 L1 呈现」边界，非全局缺失）。

---

## 3. 接口与导出签名

> 对外可见行为只引用 spec；以下签名/结构为**实现私有**契约，dev 可在等价前提下微调，但须守 §3.5 既有测试兼容面。

### 3.1 详情卡组件（`src/ui/DetailCard.tsx` 新建）
```ts
interface DetailCardProps {
  event: GeoEvent          // 完整事件；由 GlobeStage 按 selectedId 查得
  onClose: () => void      // 关闭浮层（§2.1）
}
export function DetailCard(props: DetailCardProps): JSX.Element
```
- 纯呈现组件：不持数据订阅、不发请求；信源名/等级经 `getSourceTrust(event.source)`（`src/data/trust.ts`）。
- `getSourceTrust` 现未在 `src/data/index.ts` barrel 导出——dev 从 `../data/trust` 直接 import，或补 barrel 再导出（实现自由度，二者皆可）。

### 3.2 相机飞行（扩 `src/globe/controls.ts`）
```ts
// GlobeControls 新增：启动一次 800ms 缓动过渡到目标球坐标，覆盖状态机；
// 过渡完成回落 IDLE_WAIT（SPEC-7.3 空闲计时）。durationMs 缺省 800（SPEC-7.4）。
flyTo(target: CameraState, durationMs?: number): void
```
- 新增控制态 `FLYING`（或等价机制）：`update()` 于飞行态按缓动插值 azimuth/polar/distance，忽略惯性/自转；任何用户输入（`markInput`）可中断飞行（SPEC-7.3「任何输入立即停」的自洽延伸，实现自由度）。
- azimuth 走**最短角路径**（delta 归一化到 `[-π,π]`，避免绕远）；polar clamp `[MIN_POLAR, MAX_POLAR]`（±85°，SPEC-7.1）；distance clamp `[1.8,6]`（SPEC-7.2）。

### 3.3 场景飞行入口 + 标记点击（扩 `src/globe/GlobeScene.ts`）
```ts
// 相机飞至给定经纬度上空（服务事件点击与地名命中；地名无 event 只有坐标）。
flyTo(lat: number, lon: number): void
// 标记点击上抛（SPEC-7.4）：canvas 点击命中标记 → id；未命中 → null。与既有 onMarkerHover 对称。
onMarkerClick?: (id: string | null) => void
```
- `flyTo(lat,lon)` 内部：由经纬度算事件**当前世界方向**（须计入 `markerRoot`/earthGroup 自转，见 §4.2）→ 反解目标 azimuth/polar → 距离取实现自由度值 → 调 `controls.flyTo(target, 800)`。
- `onMarkerClick`：canvas 上区分「点击」与「拖拽释放」（阈值属实现自由度，勿在拖拽后误触发，SPEC-7.1）；命中判定复用 `MarkerLayer.pick(raycaster)`——**与 `M3-marker-pillar.md §3.1` 保持的 `pick` 契约同一面**，不新增拾取通道（与光柱重写兼容面对齐，不冲突）。

### 3.4 搜索匹配（`src/data/search.ts` 新建；纯函数，零 three/react 依赖）
```ts
// 缓存事件匹配（标题 + 信源名子串，SPEC-2.5；已解析地名字段 M3 为空并入 GAP-2）。
export function searchCachedEvents(events: readonly GeoEvent[], query: string): GeoEvent[]
// 地名 gazetteer 匹配【GAP-2 门禁】——签名待 GAP-2 裁定后补，形如：
//   searchGazetteer(query: string): Array<{ name: string; lat: number; lon: number }>
```
- `searchCachedEvents` 为纯函数、可单测（无网络、无 DOM）；匹配大小写/子串策略属实现自由度（极简即可，非全文检索）。

### 3.5 UI 接线（`src/ui/GlobeStage.tsx` 改）
- `GlobeStage` 已持 `events` + `selectedId`（React 单一真相）。FM-14 接线：
  - **列表点击 / 标记点击 / 搜索事件命中** → `setSelectedId(id)` → 渲染 `<DetailCard event={events.find(id)} onClose={()=>setSelectedId(null)}/>` + 调 `scene.flyTo(event.lat, event.lon)`。
  - **搜索地名命中**（GAP-2 后）→ `scene.flyTo(place.lat, place.lon)`（不设 selectedId、不弹卡）。
  - 新增 `scene.onMarkerClick = (id)=>{…}` 接线（对称于既有 `onMarkerHover`）。
- **既有 hover 双向联动（M2-14，SPEC-7.4 高亮）不动**：`hoveredId`/`onMarkerHover`/`setHighlightedEvent` 路径原样保留，本卡只**新增点击→飞行+卡**路径，不改高亮联动。
- 现 `onSelectRow` 的 toggle 语义（点同一行取消选中）可保留或简化为「点击即选中+弹卡」（实现自由度）；SPEC-7.4 只要求点击→飞行+卡。
- 搜索框（`SearchBox.tsx`）落点 gate on §7 GAP-1，接线待裁定。

### 3.6 既有测试兼容面（qa 复跑依据）
- M2-14（`panel-marker-linkage`，SPEC-7.4 双向高亮）：本卡不改 hover 联动路径，判据不变，须**复跑确认**新增点击处理未破坏 hover（点击与 hover 共存于同一 canvas 指针事件）。
- 详情卡为新增组件、搜索为新增模块——无既有 ✅ 场景回退；M3-08/09/10（现 🔲）由本卡落地后 qa 首验。

---

## 4. 实现提示（不构成强约束）

### 4.1 详情卡浮层与样式
- 浮层挂 `.stage`（`position:relative`）内，绝对定位 + z-index 高于 `.event-panel`（现无显式 z-index，浮层给足即可）；样式沿用现深色玻璃质感（`rgba` 底 + `backdrop-filter`，见 `index.css` `.event-panel`）。视觉取值（配色/间距/圆角）若需正式审美判据交 aes；本卡结构落地可用与面板一致的中性深色，不新造对外色语义。
- 相对时间：`EventPanel.tsx` 内 `relativeTime(ts, now)` 未导出；宜抽到 `src/ui/` 共享 util 供详情卡与列表共用（单一源），或详情卡内复刻同格式（实现自由度，勿分叉语义）。

### 4.2 经纬度 → 目标机位换算（§2.4 / §3.3，sign-safe formulation）
- 相机方位约定（`GlobeScene.applyCamera`）：`dir = (sin(pol)·sin(az), cos(pol), sin(pol)·cos(az))`；`az=0,pol=90°`→`+Z`，与 `latLonToVector3(0,0)`→`+Z`（SPEC-6.2）同源。
- **反解**：给事件**世界方向**单位向量 `w=(x,y,z)` → `targetPol = acos(y)`、`targetAz = atan2(x, z)`。此式与 applyCamera 严格互逆，避免手推 sign 错。
- **世界方向须计入地球自转**：标记挂 `markerRoot`（earthGroup），空闲自转累加 `earthGroup.rotation.y`（SPEC-7.3）。事件模型方向 `m = latLonToVector3(lat,lon,1)`，世界方向 `w = earthGroup.matrixWorld · m`（或仅绕 Y：`az` 加 `earthGroup.rotation.y`、`pol` 不变，因自转绕极轴不改纬度）。**用 `w` 反解**，否则任何一次自转后飞行会落偏。可借 DEV 校准钩子（`__globeDebug.addCalibrationMarker`）目视校验落点。

### 4.3 点击 vs 拖拽判别（§3.3）
- canvas `pointerdown→pointerup` 位移小于阈值且未进入拖拽态才算「点击」（阈值属实现自由度）；与 `GlobeControls` 的指针事件共存、不阻断拖拽（比照现 hover 拾取与 controls 共存，`GlobeScene.onHoverMove`）。
- 拾取复用 RAF 内 `pick()`（现 hover 已有节流拾取管线，点击可复用同 raycaster 求值；注意 **BUG-021** 包围球陈旧——`pick` 路径依赖 `MarkerLayer` 内 `boundingSphere=null` 懒重算，光柱重写勿丢，见 `M3-marker-pillar.md §4.4`）。

### 4.4 搜索（切片③，gate on §7）
- `searchCachedEvents` 纯函数先行可测；UI 去抖/高亮属实现自由度。
- gazetteer（若 GAP-2 采「M3 建最小 gazetteer」）：见 §7 GAP-2 的最小引入建议（D29 开源优先）。gazetteer 资产同时服务 FM-13 T2（事件地理化）与本搜索——**同一份**（SPEC-2.5「与 T2 同一份」），勿建两份。

### 4.5 已知陷阱
- **BUG-021**（pick 包围球陈旧）：点击拾取与 hover 同依 `MarkerLayer.pick`，兼容面守 `M3-marker-pillar.md §3.1`。
- **信源名单一源**：详情卡内**禁**出现 `'USGS'` 等字面量或第二份 `source→名` 映射——只 `getSourceTrust`（SPEC-5.10 单一源，比照 `CATEGORY_COLORS` 先例）。违反即 M3-10 家族的行为泄漏。
- **纠错反馈误发请求**：反馈入口须是纯导航（mailto/外链），任何 fetch/XHR 都违 M3-09（§9 零服务器）。

---

## 5. 验收判据

### 5.1 dev 自检
- `make lint` 通过（tsc strict + eslint）。
- `make test TEST=search` 相关单测本地跑通（`searchCachedEvents` 纯函数，切片③）；`make test TEST=trust`（M3-07）不回归。
- 自检 L0 负向（§2.6）：grep 确认 `EventPanel.tsx` / `markers.ts` **未 import** `trust` 且渲染文本不含 trust 表任一取值。
- 自检零请求（§2.3）：详情卡与纠错入口路径无 `fetch`/`XMLHttpRequest`/新增 backend 调用。
- 自检飞行落点（§4.2）：默认视角与一次自转后各点一事件，相机落其上空（DEV 校准钩子目视）。

### 5.2 建议 qa 覆盖检查点（只列检查点，断言由 qa 从 SPEC 推导；SPEC-2.5 搜索场景 qa 于切片③开卡时登记）

**M3-08（详情卡信源名+信任等级+时间语义+去重呈现，已登记 🔲）**
- 点击标记与点击列表条目两路径均弹出详情卡、渲染同一事件。
- 卡内信源名+信任等级与 `trust.ts`/SPEC-5.10 表一致（六源逐一或抽样）。
- 时间取 `ts`、相对+绝对两呈现皆在；不显示 `lastSeen`（断言口径守 REV-015 R-1/R-2：不得断言 `ts`=真实发布时刻）。
- `urls.length>1` 呈现链接条数、文案不暗示「N 个信源」跨源；`length===1` 不强制计数。

**M3-09（纠错反馈入口零服务端，已登记 🔲）**
- 详情卡内存在可点击纠错入口；目标为 mailto:/issue 外链，预填/目标含事件 id 或标题。
- 点击过程无任何指向应用/后端的 fetch/XHR、无服务端提交。

**M3-10（L0 不编码信源/分级，负向，已登记 🔲）**
- 未打开详情卡时，列表行（SPEC-2.2a 三要素）与球面标记均不含 trust 表任一显示名/等级文案。
- 同一事件打开详情卡后方可见（对照 M3-08，验「仅 L1」边界）。

**新登：相机飞行（SPEC-7.4，qa 于切片②登记）**
- 点击标记/列表条目 → 相机缓动飞行，末态相机对准该事件上空（角位置正确，含一次自转后的落点正确性）。
- 飞行时长 ≈800ms（SPEC-7.4）；飞行为瞬态、结束归静止（不构成常驻动画）。
- 飞行不破坏 SPEC-7.2 距离区间与 SPEC-7.1 仰角钳位。
- e2e 提示：飞行为 800ms 过渡，断言末态须 await 过渡 settle（qa 测试 infra）。

**新登：搜索（SPEC-2.5，qa 于切片③开卡登记，gate on §7 两缺口裁定）**
- 缓存事件匹配（标题/信源名）命中→飞行+详情卡；空态「当前缓存内无匹配」；地名命中→飞行（随 GAP-2）。
- 入口落点按 GAP-1 裁定验（随裁定补判据）。
- 零网络（SPEC-2.5/§9）。

**复跑确认（不回退）**：M2-14（双向高亮，SPEC-7.4）——本卡新增点击路径，须复跑确认 hover 联动未被点击处理破坏（§3.6）。

---

## 6. 实现切片（最小可闭环，供 orch 派单）

- **切片① 详情卡 + trust 消费 + L0 负向**：`DetailCard.tsx` 渲染 SPEC-2.3 全字段（信源名/等级经 `getSourceTrust`）+ 纠错反馈零请求入口；`GlobeScene.onMarkerClick` + 列表点击两路径打开卡；关闭途径。**不含飞行**（点击先只弹卡）。**可闭环验证**：M3-08 / M3-09 / M3-10。
- **切片② 相机飞行联动**：`GlobeControls.flyTo`（800ms 缓动 + FLYING 态）+ `GlobeScene.flyTo(lat,lon)`（§4.2 换算）；在切片①的点击路径上叠加飞行（点击→飞行+卡，落定 SPEC-7.4）。**可闭环验证**：新登飞行场景 + M2-14 复跑确认。
- **切片③ 搜索（gate on §7 GAP-1+GAP-2，两缺口裁定前不开卡）**：`search.ts` `searchCachedEvents` + `SearchBox.tsx`（落点按 GAP-1）+ 命中分发（复用切片②飞行 + 切片①详情卡）+ 空态；gazetteer 地名半部按 GAP-2 裁定落地。**可闭环验证**：新登搜索场景。

> 切片①②各自即一段可独立验证的活，建议逐片 `/closeout`；③ 依赖①②落地**且** §7 两缺口裁定。

---

## 7. 缺口清单与实现读法

> 本卡不提案不改 spec。以下 spec 缺口经 orch 走 CLAUDE.md §7（登记 → arch 提案 → rev 仲裁 → orch 应用+pin），**本 DP 不默选**。切片①②不依赖任何缺口、门禁过即可派；**切片③（搜索）依赖 GAP-1 + GAP-2 裁定**。

### GAP-1 · 搜索入口 co-resolve（对外可见，承 REV-022 §6.1 遗留钩子 1）
- **缺口**：SPEC-2.5「入口为事件流面板（SPEC-2.2）顶部搜索框」在 SPEC-2.2 v0.3.6 重铸后二处漂移——(a) **名称漂移**：SPEC-2.2 已将事件流面板改称默认收起的「今日刻痕」抽屉，SPEC-2.5 仍称「事件流面板」；(b) **可达性张力**：搜索框若在默认收起抽屉顶部 → 首屏不可见，与「搜索为独立查询语境」张力（REV-022 §6.1 已登记为搜索落地时的 §7 应用期钩子）。
- **为何是 spec 级**：搜索入口的呈现位置/首屏可达性是**对外可见行为**，不能只在 DP 定（行为泄漏禁区）。
- **候选方案（并陈不默选，供 orch/rev 裁）**：
  - **A** 维持 SPEC-2.5 字面：入口随抽屉顶部，展开抽屉方可见（更新 SPEC-2.5 措辞「事件流面板」→「今日刻痕抽屉」，仅消名称漂移，接受首屏不可见）。
  - **B** 搜索入口独立于抽屉、常驻首屏可见（如顶栏或 canvas 上一处独立入口）——需 SPEC-2.5（及可能 SPEC-2.1/2.2）明确入口新落点与首屏权重。
  - **C** 折中：收起态提供一个可唤起搜索的最小控件（图标），点击展开搜索——需 spec 明确该控件语义。
- **影响面**：SPEC-2.5 正文（措辞/落点）；本 DP §2.5/§3.5 搜索接线；testplan 搜索场景（入口判据）；可能 SPEC-2.1/2.2。

### GAP-2 · gazetteer 数据源 + M3 搜索范围 co-resolve（对外可见，承 REV-018 F-3）
- **自查结论（资产是否存在）**：**不存在**。`public/assets/` 仅 `textures/`（earth_day/night.jpg）；`src/data/` 无 geo/gazetteer 目录；全库无 gazetteer/GeoNames 数据文件（仅文档提及）。且 FM-13（T2 gazetteer）拟随批⑤R4 后移 M4（status.jsonl「续批⑤R4」、REV-018 F-3），M3 搜索的地名半部**当前无 M3 数据源**。
- **缺口**：SPEC-2.5「本地地名 gazetteer（与 SPEC-5.8 T2 同一份精简 GeoNames）」子句在 M3 悬空——地名搜索的数据源归属未定（REV-018 F-3 明列「R4 应用期须经 §7 co-resolve，二选一，避免 M3 悬空子句」）。
- **为何是 spec 级**：M3 搜索**是否含地名搜索**是对外可见能力边界，须 spec 定（REV-018 F-3 已裁为 §7 硬钩子）。
- **候选方案（并陈不默选，对齐 REV-018 F-3 二选一）**：
  - **(i) 收窄 M3 搜索为「缓存事件搜索」**：SPEC-2.5 M3 显式收窄为标题/信源名匹配（对 T1 事件可用），地名搜索随 T2/FM-13 一并挂 M4。**本 DP 缓存事件半部（§2.5/§3.4）即按此可直接实现**，无新增资产。
  - **(ii) M3 即建最小 gazetteer**：把 T2 精简 GeoNames 提前到 M3（连带 FM-13 T2 部分或本卡自带）。**最小引入建议（D29 开源优先）**：数据取 **GeoNames**（`geonames.org`，**CC BY 4.0**，商用可，登记 ASSETS.md 出处/许可）的 `cities15000`（人口 ≥1.5 万，约 2.5 万条，体积小）或 `cities5000`；精简为 `{name, asciiname, lat, lon, country}` 的静态 JSON 放 `public/assets/gazetteer/` 或 `src/data/geo/`，构建期一次性生成、运行时零网络查表。**同一份**供 SPEC-2.5 搜索与 SPEC-5.8 T2 事件地理化复用（SPEC-2.5「与 T2 同一份」），勿建两份。
- **影响面**：SPEC-2.5 正文（范围收窄或不收窄）；若采 (ii) 则 FM-13 T2 归属（M3/M4）与 ASSETS.md；本 DP §2.5/§3.4 地名半部；testplan 搜索场景（是否含地名命中判据）。
- **注**：REV-022 §6.1 将 GAP-1 与本 GAP-2（gazetteer 依赖）并列为搜索落地时一并处置——建议 orch **同批** §7 co-resolve GAP-1+GAP-2，一次定清搜索的入口与范围。

### 非阻断观察项（非 spec 缺口，供 orch 知悉，不阻断切片①）
- **分类徽章文字标签的 spec 锚点**：详情卡分类徽章若附文字标签，复用既有单一分类标签源（`App.tsx CATEGORY_LABELS`，M2 六开关已用户可见）。该分类中文标签串是否需独立 spec 锚点属**M2 遗留的先在条件**（六开关自 M2 即显示），**非 FM-14 引入的新行为**，本卡不处置、亦不因之阻断；徽章最小实现只用分类色（SPEC-3.7，已锚）即完全达标。仅登记供 orch 知悉。
- **「地点」= 坐标读法**：M3 GeoEvent 无人读地名字段，详情卡「地点」渲染格式化经纬度（SPEC-6.1 lat/lon）；人读地名解析属 T2/T3（FM-13，M4）。此为无字段可依时的直读，非缺口；若 rev 认为「地点」须人读地名，则并入 GAP-2 的 T2 归属讨论。

### 遗留风险
- 切片③（搜索）**阻塞于 GAP-1+GAP-2 §7 裁定**；切片①②不阻塞，门禁过即可派。
- 纠错反馈的 mailto 地址/issue 仓库 URL 为配置常量，dev/orch 定值（SPEC-2.3 渠道属实现自由度），非 spec 缺口。
- 光柱标记重写（`M3-marker-pillar.md`）在途：点击拾取复用其 §3.1 `pick` 兼容面，两卡拾取契约一致、不冲突；若光柱重写改动 `pick` 行为，本卡飞行/点击拾取须随之复跑（M2-14 家族）。
