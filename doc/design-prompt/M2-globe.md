# design-prompt — M2 视觉层（事件标记层 + 事件流面板 + 矢量默认风格）

> arch 撰写，rev 门禁通过后 orch 据此派 dev。只准约束实现，不准定义 spec 之外的对外可见行为（行为泄漏禁区，见 .claude/agents/arch.md）。
>
> 覆盖 feature-matrix：FM-07（事件标记 + 面板）、FM-08（矢量默认风格）。
> 数据侧读口由 FM-05/FM-06（design-prompt M2-data.md）交付，本卡**只消费**其 `EventStore` 只读快照，不改 `src/data/`。

## 1. 目标与范围

把 M2 数据层已归一化的 `GeoEvent` 快照**画到球上、列进面板**，并把 M1 的卫星默认底图**换成轻量矢量默认风格**。

**做**：
- **FM-07 标记层**（`src/globe/`）：分类色表 + severity 分级 + 脉冲环，instancing/点精灵（SPEC-3.7 / SPEC-3.8）；挂进 M1 已留的 `GlobeScene.markerRoot`（SPEC-6.2 模型空间自转跟随）。**回补 SPEC-3.4「大气不遮挡标记」为真标记断言**（REV-004 R-1、REV-005 K-2）与 **SPEC-3.8「≥200 标记 instancing/帧率」**（REV-004 R-2）——两条 M1 延后至 M2 的欠账。
- **FM-07 事件流面板**（`src/ui/`）：右侧 300px 可折叠、球主列表从（SPEC-2.2）；消费同一 `EventStore` 快照。
- **FM-07 列表↔标记联动**（SPEC-7.4 分片）：列表 hover/选中 ↔ 球面标记高亮**双向**联动。
- **FM-08 矢量默认风格**（`src/globe/`）：以矢量海岸线/网格 + 昼夜明暗表达晨昏线（SPEC-3.2 重写 ②）、矢量点/辉光表达夜面（SPEC-3.3），免大纹理兑现首包预算（SPEC-3.10）；卫星昼夜底图退出默认加载路径（SPEC-3.2 重写 ③）。

**不做**（均属他卡，本卡只留接口/不堵死，不实现）：
- **点击标记/列表 → 相机 800ms 飞行 + 弹详情卡**（SPEC-7.4 后半、SPEC-2.3）→ M3 FM-14。本卡的联动**仅到高亮**，不做任何飞行、不弹详情卡、不引入 raycast 的「点击动作」。
- **呼吸式过渡的渲染实现**（渐隐熄灭/渐亮、整屏不闪，SPEC-3.11）→ FM-09。本卡只保证标记层增删接口**不堵死**后续逐标记透明度动画（§2.4）。
- **分类过滤 predicate / watchlist 命中强调 / 顶栏品牌名与 UTC 时钟**（SPEC-2.1、SPEC-2.4①、SPEC-8.1 分类子集）→ FM-10。本卡的标记层与面板消费**未过滤全量快照**，过滤在消费侧（§3.3 边界）；面板不内建分类过滤。
- **风格切换 UI / 风格包懒加载 / 天气云图**（SPEC-3.9、SPEC-2.4②③）→ M4 FM-18。本卡只把默认切成矢量，**不建风格抽象层**（YAGNI，见 §3.1）。
- **缓存优先启动的 wiring**（谁在何时调 `createDataLayer().start()` 并把快照喂给标记层/面板）→ FM-09；本卡定义被喂入的接口，不定接线时机。
- **性能预算基线量测**（首包体积/冷启动秒数，SPEC-3.10）→ FM-11。本卡只需让矢量默认落地、使首包**不含**卫星大纹理，为 FM-11 量测提供达标前提。

**R-8 决策声明（REV-004 §5 R-8 / REV-002 O-3）**：REV-004 R-8 建议「触及 shader 时顺带把大气 `uPower`/`uIntensity` 收敛为 GLSL 常量」。**本卡不采纳**——FM-07/FM-08 均不修改 `src/globe/atmosphere.ts` 与 `shaders/atmosphere.ts`（矢量/卫星两风格共用同一大气壳，风格无关）。据 CLAUDE.md §1.3「外科手术式改动」，不得把无关的大气重构塞进本卡。R-8 仍是非阻塞的未来清理，留待**确有卡触及 atmosphere.ts 时**处理；届时按 REV-003 §1.3 预裁，`tests/atmosphere.test.ts:31-36` 随收敛一并删除。故本卡对该测试**零影响**。

**依赖**：M1 的 `GlobeScene.markerRoot`（FM-03，已交付）、`latLonToVector3`（SPEC-6.2，`src/globe/geo.ts` 已存在）、`sunDirectionModel`（SPEC-4.5，已存在）；M2 数据层的 `EventStore.snapshot()/subscribe()`（M2-data §3.3，已交付）。

## 2. 约束（每条标注 SPEC 锚点）

### 2.1 矢量默认风格（FM-08，`src/globe/`）

- **昼夜混合是跨风格能力，数学与 M1 同源**（SPEC-3.2 重写 ①）：矢量风格的昼夜/晨昏线**必须**复用 `t = dot(N, sunDir)`、`k = smoothstep(-uTwilight, +uTwilight, t)`、`uTwilight = 0.1`（过渡带半宽 t∈[-0.1,+0.1]）——与 M1 `shaders/earth.ts` 逐字同一套；差别仅在被混合的两端由「纹理采样」换成「矢量底色/线色」。M1 §3.4 的**模型空间硬约定**（`uSunDir` 不随 `earthGroup.rotation.y` 变换，法线取归一化 `position`）原样继承，保证晨昏线相对地理位置正确、且与标记天然对齐。
- **昼半球不叠加、混合非叠加、夜半球增益** 跨风格保持（SPEC-3.3）：`k=1`（昼半球）时夜面项权重为 0（`mix` 非 `add`）；夜半球亮度增益 ≥1.5。此三条与 M1 一致，不因换风格而改。
- **矢量海岸线 + 网格 + 免大纹理**（SPEC-3.2 重写 ②、SPEC-3.10）：海岸线来自**免费公版且轻量**的矢量数据（候选与体积估算见 §4.1，须落入首包 ≤2MB 预算并登记 ASSETS.md）；经纬网格（graticule）**程序化生成**（零数据成本）。默认风格**不加载任何等距圆柱大纹理**。
- **夜面矢量点/辉光**（SPEC-3.3）：矢量默认风格的夜面以矢量点/辉光表达，不依赖夜纹理。其**具体形态、颜色、数据来源**为对外可见且 spec 未 pin → **待提案项 P-1**（§6）；DEV 在 P-1 pin 前不得自定其可见取值。
- **可见配色与网格密度未 pin → 待提案项 P-1**（§6）：海岸线线色、陆地/海洋底色（含「陆地是否与海洋异色」）、网格线色与网格密度、夜面点/辉光色，均属对外可见且 SPEC-3.2/3.3 只 pin「存在」不 pin「取值」。**DEV 不得在代码或本 DP 里自定这些可见取值**（行为泄漏禁区）；未 pin 前可用**明显临时的占位值**搭结构，但不得作为交付外观。
- **卫星昼夜底图退出默认加载路径**（SPEC-3.2 重写 ③）：`earth_day.jpg`/`earth_night.jpg` 与其加载器**不得在默认 boot 路径上被 fetch**，故不计入首包（SPEC-3.10）。资产文件**保留**（未来天气风格包 SPEC-3.9 复用），ASSETS.md 须把两张纹理标注为**天气风格包专属、懒加载、不计首包**。M1 的 `earth.ts`/`shaders/earth.ts`/`textures.ts`（卫星昼夜路径）**保留供天气包复用**，但从 `GlobeScene` 默认组合根上摘除——是否物理移动到独立目录/是否加 `/* 天气包保留 */` 标注属 DEV 组织自由度，**唯一硬约束是默认 boot 不触发大纹理下载**。
- **几何生成方式（实现私有，可约束）**：矢量底面用普通 `SphereGeometry(1, ≥64, ≥64)`（矢量风格无纹理，无需 M1 的 `phiStart=-π/2` uv 对齐）；海岸线/网格顶点一律经 `latLonToVector3(lat, lon, r)`（`r` 略大于 1，如 1.001，浮在底面之上避免 z-fighting）投影，用 `LineSegments`/`Line`（或等价单一 draw call 的线对象）承载，**禁止逐段建独立 mesh**。矢量底面 + 海岸线 + 网格 + 夜面点全部挂进 `earthGroup`（=`markerRoot`），随自转且共享模型空间 `sunDir`。

### 2.2 事件标记层（FM-07，`src/globe/`）

- **分类色照 SPEC-3.7 色表**（SPEC-3.7）：六 category → 六 hex 逐字照 spec 正文（disaster `#ff4d4f` / conflict `#ff7a45` / humanitarian `#ffc53d` / news `#40a9ff` / launch `#b37feb` / flight `#5cdbd3`），按 per-instance 颜色下发。**DEV 不得另立色值**；测试期望值引用 SPEC-3.7。
- **severity 分级**（SPEC-3.7）：标记基础尺寸与脉冲光环幅度**随 severity 递增**（size/幅度：sev3 > sev2 > sev1）；**severity 3 必须有持续脉冲环**。具体像素尺寸、脉冲频率/幅度数值为**实现自由度**（类比 M1 拖拽手感 REV-002 D-1）——spec 只 pin「递增」与「sev3 持续脉冲存在」，QA 断言其序关系与存在性，不断言具体数值。
- **性能：instancing/点精灵**（SPEC-3.8，回补 M1 豁免）：标记 ≥200 时用 instancing 或点精灵，**不逐事件建 Mesh**；桌面 Chrome 目标 60fps。这是 M1 §1 豁免声明明列的 M2 回补项（REV-004 R-2）。脉冲动画在 RAF 循环内按时间驱动（`tick(elapsedMs)`，§3.2），时间基准同 M1 SPEC-7.5（跨帧率按时间等效，不按逐帧字面量）。
- **地理定位与自转跟随**（SPEC-6.2）：标记位置 = `latLonToVector3(event.lat, event.lon, r)`，挂进 `markerRoot`，随空闲自转与晨昏线一并转动、天然对齐地理。
- **大气不遮挡标记——回补真标记断言**（SPEC-3.4，REV-004 R-1 / REV-005 K-2）：标记须在大气辉光壳（BackSide + AdditiveBlending + `depthWrite=false`，半径 1.15）**之上可见**，不被大气遮挡。M1 的大气配置**不改**（见 R-8 声明），本卡以**真实标记**验证不遮挡——DEV 须确保标记材质的深度/渲染次序设置使其在大气壳前方仍完整可见（这是 M1 大气 `depthWrite=false` 前置保证的兑现点）。**QA 回补证据须为真标记，不得再用材质代理断言**（REV-004 §5 R-1 继续有效）。
- **增删接口不堵死呼吸式过渡**（SPEC-3.11，为 FM-09 预留，不实现）：标记集更新须以 **id 为键的 diff**（新增/移除/更新）表达，**禁止每次整表销毁重建**；每标记须预留**逐实例透明度/亮度通道**（M2 可恒设为不透明）。目的：FM-09 能对「新增标记渐亮、过期标记渐隐熄灭」逐标记做透明度动画而无需重构本层。本卡**不实现**任何淡入淡出。

### 2.3 事件流面板（FM-07，`src/ui/`）

- **布局**（SPEC-2.2）：右侧悬浮面板，展开宽 **300px**，**可折叠**；球为主、列表为从（不遮挡球体主视觉）。折叠/展开的具体触发控件形态（按钮/图标位置）为实现自由度，只 pin「可折叠 + 300px」。
- **消费未过滤全量快照**（M2-data §3.3 边界）：面板消费 `EventStore.snapshot()`/`subscribe()`。**分类过滤 predicate 属 FM-10，面板不内建过滤**；FM-10 落地后，喂入面板的事件数组是「过滤后的可见集」——本卡把面板的事件入参设计成**外部传入的 `GeoEvent[]`**，过滤在其上游（§3.3），本卡不实现该 predicate。
- **列表行可见内容、排序、空状态未 pin → 待提案项 P-2**（§6）：SPEC-2.2 只 pin「事件流面板/300px/可折叠/球主列表从」，**未 pin 每行显示哪些字段、排序规则、空状态文案**（SPEC-2.3 的详情卡字段是 M3 的浮层，非列表行）。此三者对外可见 → **DEV 在 P-2 pin 前不得自定列表行的可见内容**。可用明显占位搭结构，不得作为交付外观。

### 2.4 列表↔标记双向联动（SPEC-7.4 分片）

- **双向联动**（SPEC-7.4）：① 列表行 hover/选中 → 对应球面标记高亮（list→marker）；② 球面标记被指针 hover → 对应列表行强调（marker→list）。**「双向/↔」是 SPEC-7.4 明文**，故两方向均在 M2 交付。
  - **解读并陈（行为准则 1）**：另一种更保守的切法是「M2 只做 list→marker，marker→list 随 M3 的点击-拾取基础设施一并落地」。**本 DP 取「双向」读法**，理由：`双向联动` 是 SPEC-7.4 的单一短语，拆半会使该子句在 M2 只被断言一半、另一半需额外承接登记（易蒸发）；且 hover 拾取（raycast `InstancedMesh` 取 `instanceId`）是有界的、与 M3 点击-飞行共享同一拾取基础设施，前向兼容。**此读法请 rev 门禁时确认**；若 rev 裁定拆半，则 marker→list 方向连同其 raycast 一并延后 M3，本卡 §3 相应删去 `pick`/`onMarkerHover`。
- **拾取范围严格限于高亮**：marker→list 方向需指针 hover 的 raycast 拾取（对标记层，非对底面），但**只用于求 hovered 事件 id → 驱动高亮**。**不做任何点击动作、不飞行、不弹详情卡**（SPEC-7.4 后半 + SPEC-2.3 属 M3 FM-14）。
- **高亮的具体视觉为实现自由度**：SPEC-7.4 pin「高亮」的存在与双向因果，**未 pin** 高亮的具体呈现（标记放大/加亮/描边、列表行的强调样式）。DEV 自定，QA 断言**联动因果**（hover 列表行→对应标记高亮态改变；hover 标记→对应列表行强调态改变，及其反向）而非具体像素。**约束**：高亮**不得复用 SPEC-3.7 分类色去表达非分类语义、不得引入新的颜色编码语义**（避免与分类色混淆）——此为防行为泄漏的底线，非外观规定。

## 3. 接口

### 3.1 模块与文件职责

| 文件 | 职责 | 依赖 |
| --- | --- | --- |
| `src/globe/coastline.ts` | 海岸线矢量数据加载/解码为球面折线顶点集（`{lat,lon}` 序列） | 数据文件（§4.1） |
| `src/globe/shaders/vectorEarth.ts` | 矢量底面/线的昼夜 shader 源码（复用 SPEC-3.2① 的 t/k 数学） | 无 |
| `src/globe/vectorEarth.ts` | 矢量底面 + 海岸线 + 网格 + 夜面点工厂，`setSunDir` 写入口（SPEC-3.2/3.3） | three, coastline, shaders |
| `src/globe/markers.ts` | 事件标记 instancing 层：分类色/severity/脉冲/拾取/高亮（SPEC-3.7/3.8/7.4） | three, geo, `type GeoEvent` |
| `src/globe/GlobeScene.ts` | 组合根扩展：装配矢量地球与标记层、hover 拾取、联动回调（既有类，扩展） | 以上 + 既有 |
| `src/ui/EventPanel.tsx` | 事件流面板：列表渲染、hover/选中、折叠（SPEC-2.2、SPEC-7.4） | react, `type GeoEvent` |
| `src/ui/GlobeStage.tsx`（或等价） | React 侧承载 `GlobeScene` 生命周期 + 面板，桥接联动状态（§3.4） | react, GlobeScene, EventPanel |

拆分理由：矢量 shader 源码与 coastline 解码需独立单测；`markers.ts` 的分类色/severity 映射需可在无 WebGL 下单测（纯映射函数与几何属性）；面板是纯 React 组件可 RTL/快照测。
**不建风格抽象层**（CLAUDE.md §1.2 / M2-data §1 同款纪律）：无 style registry、无「风格插件」接口、无材质工厂注册表——M2 只有矢量一种默认，卫星路径是**保留的死路径**（提留不删，§2.1），M4 FM-18 再引入切换。

### 3.2 导出签名（契约下限，DEV 可加私有成员，不可改语义/所在文件）

```ts
// src/globe/coastline.ts
export interface CoastlineData {
  /** 每条折线一个 number[]，元素为 [lon, lat] 度值（未投影，globe 层负责换算，SPEC-6.2） */
  readonly lines: ReadonlyArray<ReadonlyArray<readonly [number, number]>>
}
export function loadCoastline(): Promise<CoastlineData> | CoastlineData   // 静态 import 或 fetch，DEV 定

// src/globe/vectorEarth.ts
export function createVectorEarth(coastline: CoastlineData): {
  object: THREE.Object3D                                // 挂进 earthGroup(=markerRoot)
  setSunDir(dir: THREE.Vector3): void                   // 模型空间单位向量（SPEC-4.5，跨风格昼夜 SPEC-3.2①）
  dispose(): void
}

// src/globe/markers.ts
import type { GeoEvent } from '../data'                 // 类型 only，无运行时耦合数据层
export interface MarkerLayer {
  readonly object: THREE.Object3D                       // 挂进 markerRoot
  /** 全量事件 → 标记；按 id diff 增删改，不整表重建（SPEC-3.7/3.8；为 FM-09 呼吸预留 §2.2/2.4） */
  setEvents(events: readonly GeoEvent[]): void
  /** 列表→标记：高亮某事件（null=清除）（SPEC-7.4） */
  setHighlight(id: string | null): void
  /** 标记→列表：raycaster 命中最近标记的事件 id，未命中 null（SPEC-7.4；仅高亮，不触发动作） */
  pick(raycaster: THREE.Raycaster): string | null
  /** 脉冲动画推进（sev3 持续脉冲环，SPEC-3.7）；RAF 内每帧调用，时间基准同 SPEC-7.5 */
  tick(elapsedMs: number): void
  dispose(): void
}
export function createMarkerLayer(): MarkerLayer

// src/globe/GlobeScene.ts（既有类，扩展）
export class GlobeScene {
  constructor(container: HTMLElement)
  readonly markerRoot: THREE.Object3D                   // 既有（M1）
  /** 更新标记层事件集（消费 store 快照；接线时机属 FM-09/FM-10，非本卡） */
  setEvents(events: readonly GeoEvent[]): void
  /** 列表→标记高亮联动（SPEC-7.4） */
  setHighlightedEvent(id: string | null): void
  /** 标记→列表：canvas 指针 hover 命中标记时回调（SPEC-7.4）；由 UI 层设置 */
  onMarkerHover?: (id: string | null) => void
  dispose(): void
}
```

- `GlobeScene` 内部把矢量地球换掉 M1 的 `createEarth`（卫星）：默认组合根**不再调 `loadEarthTextures`**（SPEC-3.2③，卫星大纹理不进首包）。`updateSunDir` 改为写入 `vectorEarth.setSunDir`（数据流与 M1 §3.4 一致，只换写入端）。
- `setEvents` 是 store 快照进入渲染层的**唯一入口**；谁订阅 store、何时喂入属 FM-09/FM-10 wiring（本卡不接线，只暴露口）。

### 3.3 数据流与消费侧边界

```
EventStore.snapshot()/subscribe()            （M2-data §3.3，未过滤全量）
        │
        ▼
   [分类过滤 predicate]  ← FM-10（SPEC-2.4①/8.1 分类子集）；本卡不实现，只消费其输出
        │  visibleEvents: GeoEvent[]
        ├───────────────────────────┬───────────────────────────
        ▼                           ▼
  GlobeScene.setEvents()      EventPanel（列表渲染）
   → MarkerLayer.setEvents      （SPEC-2.2；行内容待 P-2）
   (latLonToVector3, SPEC-6.2)
        │                           │
        └─────── 联动状态（hoveredId/selectedId，§3.4）───────┘
                        SPEC-7.4 双向高亮
```

- **上游边界**：标记层与面板**都消费同一份 `visibleEvents`**（未过滤全量在 M2 无 FM-10 时即等于 `snapshot()`；FM-10 落地后为其过滤输出）。本卡**不内建过滤**，避免与 FM-10 双写过滤逻辑（M2-data §3.7 已 pin「过滤属消费侧 FM-10」）。
- **下游边界**：`markers.ts` 只吃 `GeoEvent` 的 `id/category/severity/lat/lon`（类型 only import），不反向依赖 store/scheduler；面板只吃 `GeoEvent` 用于渲染行（字段由 P-2 定）。

### 3.4 React ↔ three 联动桥接（最小结构）

```
GlobeStage.tsx（React）
  ├─ useEffect: new GlobeScene(container) / scene.dispose()（沿用 App 现有模式）
  ├─ 联动状态（React state，最小）：{ hoveredId: string|null, selectedId: string|null }
  ├─ list→marker：hovered/selected 变化 → effect 调 scene.setHighlightedEvent(id)
  ├─ marker→list：scene.onMarkerHover = (id) => setHoveredId(id)
  └─ <EventPanel events={visibleEvents}
                  hoveredId selectedId
                  onHoverRow selectOnClick... />   // 行为回调驱动上面的联动状态
```

- **联动状态用最小 React state 即可**（`useState` 提升到 `GlobeStage`，或极小 context）——**不引入状态库**（无 zustand/redux，YAGNI；联动态仅 2 个 id）。具体用 `useState`/`useReducer`/context 是 DEV 自由度，本卡只 pin「联动态是 React 侧单一真相、双向同步到 `GlobeScene` 的命令式高亮」这一结构。
- **命令式/声明式桥接**：`GlobeScene` 是命令式 three 对象，面板是声明式 React。桥接方向固定：React 态 → `scene.setHighlightedEvent`（下推）；`scene.onMarkerHover` → React `setState`（上抛）。避免在 RAF 循环里直接改 React 态（每帧 setState 会打爆 render）——hover 拾取仅在指针移动时求值并**去抖/节流**（§4.3）。

### 3.5 M1 / M2 / M3 边界

- 复用 M1 `markerRoot`、`geo.ts`、`sun.ts`、大气/星空/交互，**均不改**（大气见 R-8 声明）。
- `GlobeScene` 新增 `setEvents`/`setHighlightedEvent`/`onMarkerHover`——是 M1 §3.7 预告的「M2 把 instanced 标记挂进 `markerRoot`」的兑现。
- **不预留 M3 空壳**（YAGNI，同 M1 §3.7）：不加 `flyTo`、不加 `onMarkerClick`、不加详情卡挂载点——M3 FM-14 届时新增即可。`pick`/`onMarkerHover` 是 SPEC-7.4 M2 分片的真实需要，非为 M3 预留（虽前向兼容）。

## 4. 实现提示（不构成强约束）

### 4.1 海岸线数据候选与体积估算（免费公版，首包 ≤2MB，SPEC-3.10）

矢量默认是首屏默认风格，海岸线数据**须进首包**（不同于卫星纹理的懒加载），故越轻越好。候选（均公有领域/免费）：

| 候选 | 精度 | 体积（约） | 说明 |
| --- | --- | --- | --- |
| Natural Earth 110m coastline（world-atlas `land-110m` TopoJSON 亦可） | 1:110M | GeoJSON ~200KB / TopoJSON ~90KB | 球面尺度足够；TopoJSON 需 `topojson-client`(~小) 解码或**预转换**为紧凑 JSON/typed-array 避免运行时依赖。**推荐默认** |
| Natural Earth 50m coastline | 1:50M | ~500KB–1MB | 明显更细，仍在预算内（约 25–50%）；仅当 110m 视觉过糙时启用，取舍待 FM-11 量测 |
| Natural Earth 10m | 1:10M | 数 MB | **超预算，不用** |

建议：取 110m，**构建期预转换**为「折线数组 [lon,lat]」的紧凑 JSON 或二进制并静态 import（免运行时 topojson 依赖，符合极简），体积占预算 ≈4.5%。选定后在 `public/assets/ASSETS.md` 登记来源/许可/抓取日期（同卫星纹理登记规范）。经纬网格**程序化生成**（每 N° 一条经/纬线，N 属 P-1 网格密度），零数据。

### 4.2 标记 instancing 与脉冲（SPEC-3.7/3.8）

- `InstancedMesh`（每实例 color via `setColorAt` + 每实例矩阵含 severity 缩放）或点精灵二选一（SPEC-3.8 允许）；≥200 时务必单一 draw call，**不逐事件建 Mesh**。
- sev3 持续脉冲环：可用 shader 内 `sin(uTime)` 驱动的环半径/透明度，或额外一层 instanced 环 mesh；`uTime` 由 `tick(elapsedMs)` 累加，跨帧率按时间累加（勿用逐帧字面量，SPEC-7.5 精神）。
- 逐实例透明度通道（§2.4 为 FM-09 预留）：InstancedMesh 可用 instanced `alpha` 属性或每实例颜色 alpha；M2 恒设 1，留通道即可，**不实现淡入淡出**。
- diff 更新：维护 `Map<id, instanceIndex>`；`setEvents` 时算增/删/改，复用空槽或回收末尾槽，避免整表 `dispose`/重建（这也是 FM-09 呼吸的前提）。该 map 同时是 `pick` 的 `instanceId → id` 反查表。

### 4.3 hover 拾取（SPEC-7.4，marker→list）

- `Raycaster.setFromCamera(ndc, camera)` → `raycaster.intersectObject(markerLayer.object)`；`InstancedMesh` 命中含 `instanceId`，经反查表得事件 id。
- 拾取仅对**标记层**求交，不对矢量底面/大气；`pointermove` 时**节流**（如 rAF 合并或 ~50ms）后求值，拖拽中（`GlobeControls` DRAG 态）可跳过以省算力。命中变化时才 `onMarkerHover(id)`（去抖，避免每帧 setState，§3.4）。
- 与 M1 `GlobeControls` 的指针事件**共存**：hover 拾取是只读求交，不消费/不阻断拖拽事件流。

### 4.4 矢量昼夜 shader（复用 SPEC-3.2①/3.3 数学）

- 顶点：`vNormalModel = normalize(position)`（模型空间，同 M1）；线/面共用。
- 片元：`k = smoothstep(-0.1, 0.1, dot(vNormalModel, uSunDir))`；底面色/线色 = `mix(夜端, 昼端, k)`，`k=1` 时夜端权重 0（SPEC-3.3 非叠加）。夜端可含增益（≥1.5 语义对矢量表现为夜面更亮的点/辉光）。**具体颜色是 P-1 占位**，shader 结构与 t/k 数学是本卡约束。
- 片元末尾 `#include <colorspace_fragment>`（ShaderMaterial 不自动转输出色彩空间，同 M1 §4.2）。

### 4.5 生命周期

沿用 M1/M2-data 的 dispose 纪律：矢量地球/标记层新增的 geometry/material/纹理（若有）/`InstancedMesh` 全在 `GlobeScene.dispose()` 释放；`pointermove` 监听在 dispose 清除；coastline 异步加载须防「加载完成时已卸载」竞态（同 M1 纹理竞态）。React 侧 StrictMode 双挂载沿用 `useEffect` cleanup。

## 5. 验收判据

### 5.1 DEV 自检（交付前必过）

- `make lint`：eslint 0 警告 + `tsc --noEmit` 0 错误。
- `make test`：新增（矢量映射/coastline 解码/markers 分类色与 severity 映射/面板）单测全绿，既有单测（含 `tests/atmosphere.test.ts`、`tests/geo.test.ts`）不回归。
- `make dev` 手动开一次：矢量默认球正常渲染、无 console 报错、无 WebGL context 警告；确认**网络面板无 `earth_day.jpg`/`earth_night.jpg` 请求**（SPEC-3.2③ 卫星退出默认加载的自检）。
- `src/globe/markers.ts` 对数据层仅 `import type`（可 grep 自检，无运行时耦合）。

### 5.2 建议 QA 覆盖的检查点（只列检查点，断言由 QA 从 spec 推导，标注 SPEC）

矢量默认风格（FM-08）：
1. **矢量默认昼夜/晨昏线**（视觉截图 + 参数）：默认风格为矢量海岸线/网格，昼夜按 `t=dot(N,sunDir)`、过渡带 t∈[-0.1,+0.1] smoothstep 混合；昼半球不叠加夜面项、混合非叠加（SPEC-3.2① + 3.3）。**这是 REV-005 A3(b) 要求的「M2 必须新增矢量默认昼夜真实场景」，零覆盖新行为，不得停在占位。**
2. **卫星底图退出默认加载**（e2e/网络）：默认 boot 不请求 `earth_day.jpg`/`earth_night.jpg`，首屏不含大纹理（SPEC-3.2③ + 3.10 首包前提）。
3. **矢量夜面不依赖夜纹理**（SPEC-3.3）：夜半球以矢量点/辉光表达（具体外观待 P-1，QA 断言「夜面呈现且不加载夜纹理」的结构，可见取值等 P-1 pin 后补）。

事件标记层（FM-07）：
4. **分类色表**：六 category 标记颜色逐一等于 SPEC-3.7 hex（SPEC-3.7）。
5. **severity 分级**：尺寸/脉冲幅度随 severity 递增；severity 3 存在持续脉冲环（SPEC-3.7；断言序关系与存在性，不断言具体数值）。
6. **≥200 标记 instancing**（回补 SPEC-3.8，REV-004 R-2）：≥200 标记用 instancing/点精灵（非逐事件 Mesh），渲染对象数不随事件数线性增长；帧率量测归 FM-11 性能基线（与已登记 M2-11 口径对齐，REV-010 §3.2）。**M1 豁免的回补项。**
7. **大气不遮挡标记——真标记**（回补 SPEC-3.4，REV-004 R-1/REV-005 K-2）：在大气辉光壳区域放置真实标记，验证其可见、不被大气遮挡。**证据须为真标记，不得再用 `AdditiveBlending`+`depthWrite=false`+`transparent` 材质代理断言。**一并承接 R-6 辉光峰值机械化断言（沿球缘径向采样、切线处最大向外衰减，镜像已登记 M2-12 口径，REV-010 §3.3）。
8. **地理定位**：给定 (lat,lon) 的标记落点与 `latLonToVector3` 一致、随自转跟随（SPEC-6.2；可复用 M1-05 几内亚湾校准式判据）。
9. **增删不堵死呼吸**（结构性，SPEC-3.11 为 FM-09）：`setEvents` 增删改按 id diff、不整表重建，逐实例透明度通道存在（QA 可在 markers 单测层断言 diff 行为与 alpha 通道存在，不验淡入淡出——那属 FM-09）。

事件流面板 + 联动（FM-07）：
10. **面板布局**（SPEC-2.2）：右侧 300px、可折叠、球主列表从；消费 store 快照。（列表行可见内容/排序待 P-2，pin 后补断言。）
11. **列表↔标记双向联动**（SPEC-7.4 分片）：hover/选中列表行 → 对应标记高亮态改变（list→marker）；hover 标记 → 对应列表行强调态改变（marker→list）。**断言联动因果，不断言高亮具体像素。**（若 rev §2.4 裁定拆半，则本项只验 list→marker，marker→list 承接 M3。）

> 检查点 1/3/10/11 的**可见取值/内容**断言依赖 P-1（矢量配色/夜面/网格密度）、P-2（面板行内容/排序）裁决 pin；未 pin 前 QA 按「结构/因果/存在性 + 已 pin 的 SPEC-3.7 色表」断言，不断言未 pin 的可见取值。此为已知留痕，非判据缩水——SPEC-3.2①/3.3/3.4/3.7/3.8/7.4/6.2 的**已 pin 部分**均被真实覆盖，无 spec 子句掉出场景之外。

## 6. 待提案项（spec 缺口，须经 rev 仲裁后由 orch 应用 + pin，DEV 不得在 DP/代码自行定义可见取值）

| # | 缺口 | 涉及 SPEC | 影响 |
| --- | --- | --- | --- |
| **P-1** | 矢量默认风格的**对外可见配色与网格密度**：海岸线线色、陆地/海洋底色（含陆地是否异色）、网格线色与密度、**夜面矢量点/辉光的形态·颜色·数据来源**。SPEC-3.2②/3.3 只 pin「以矢量海岸线/网格/点/辉光表达 + 免大纹理 + 跨风格昼夜」，未 pin 取值 | SPEC-3.2② + 3.3 | 矢量默认外观（FM-08）；检查点 1/3 的可见取值断言。**未 pin 则 DEV 无可交付外观、QA 无可断言取值** |
| **P-2** | **事件流面板列表行的可见内容 + 排序 + 空状态**：每行显示哪些字段、按什么排序、无事件时的空状态文案。SPEC-2.2 只 pin「300px/可折叠/球主列表从」，SPEC-2.3 的详情卡字段属 M3 浮层非列表行 | SPEC-2.2（+ 参照 SPEC-6.1 字段、SPEC-3.7 分类色） | 面板可见内容（FM-07）；检查点 10 的行内容断言。**未 pin 则 DEV 无可交付列表外观** |

**处理次序建议（供 orch/rev 参考，非本 DP 决议）**：P-1/P-2 是 FM-08/面板的**外观前置**——DEV 建不出可交付外观。建议**先经 rev 仲裁 pin，再派 FM-08 与面板的 DEV 卡**（§7 附了 arch 的具体提案供快速仲裁）。标记层的分类色/severity/instancing/联动因果、矢量的昼夜数学/卫星退出加载等**已 pin 部分不被 P-1/P-2 阻塞**，可先行。

## 7. spec 修改提案（附交付 · 待 rev 仲裁 · 未 pin 前非约束 · 不得被 DEV 当已 pin）

> 本节是 arch 附在交付里的 spec 提案（CLAUDE.md §7、arch.md 职责），解决 §6 的 P-1/P-2。**经 rev 仲裁后由 orch 应用到 spec 正文 + §0 修改记录 + `make pin-spec`，本节即失效不再是来源**。提案值为最小可交付默认，rev/产品可调整。

### 提案 A（对应 P-1）：矢量默认风格视觉参数 — 建议新增 SPEC-3.2a

- **原文**：无（SPEC-3.2② 只述「以矢量海岸线/网格 + 昼夜明暗表达晨昏线，免大纹理」；SPEC-3.3 只述「矢量默认风格以矢量点/辉光表达夜面，不依赖夜纹理」，均无取值）。
- **建议新文（SPEC-3.2a 矢量默认风格视觉参数）**：
  - 底面：海洋/陆地统一深色底 `#0a1a2f`（昼），夜半球按昼夜混合压暗；陆地不单独填色（仅以海岸线勾勒），保持静谧科技感（SPEC-3.2② 基调）。
  - 海岸线：线色 `#4db8ff`（青蓝），昼侧亮、夜侧按混合压暗但保留可辨勾勒。
  - 经纬网格（graticule）：线色 `#1e3a5f`（暗蓝），密度经线每 30°、纬线每 30°（赤道与极区不额外加密）。
  - 夜面：海岸线在夜半球附加**微弱自发光辉光**（辉光色 `#7fd4ff`，低强度）表达「矢量辉光夜面」；**不含城市级点数据**（矢量风格无夜纹理/城市数据源，SPEC-3.3）。
- **理由**：SPEC-3.2②/3.3 定义了矢量风格的构成元素但未给可见取值，属对外可见行为缺口；无取值则 FM-08 无法交付外观、QA 无可断言。取值贴合既有深色 UI（`#000`/`#0a0c14`）与大气主色 `#4a90d9` 的冷色系，兑现「科技感/静谧」基调（D3/D12）。
- **影响的 testplan/design-prompt**：本 DP §2.1/§5.2 检查点 1/3（矢量昼夜/夜面外观）由「结构断言」升为可断言可见取值；FM-08 DEV 卡可据此实现。ASSETS.md 需登记海岸线数据源。

### 提案 B（对应 P-2）：事件流面板列表行 — 建议新增 SPEC-2.2a

- **原文**：无（SPEC-2.2 仅「右侧悬浮事件流面板（宽 300px，可折叠）」；SPEC-2.3 是详情卡即 M3 浮层，非列表行）。
- **建议新文（SPEC-2.2a 事件流面板列表行）**：每行显示 ① 分类色圆点（SPEC-3.7 分类色）② 事件标题（SPEC-6.1 `title`）③ 相对时间（由 SPEC-6.1 `ts` 计算，如「3 分钟前」）。列表按 `ts` **倒序**（最新在上，呼应「事件流」）。无事件时显示空状态文案「暂无事件」。（severity/地点/摘要/信源等完整字段属详情卡 SPEC-2.3，M3 点击行展开，不进列表行。）
- **理由**：SPEC-2.2 定义了面板存在与尺寸但未定列表行可见内容/排序/空状态，属对外可见行为缺口；SPEC-7.4 的列表联动又要求行可被 hover/选中标识。给最小三字段 + ts 倒序，既满足联动又不与 M3 详情卡重叠。分类色圆点复用已 pin 的 SPEC-3.7，标题/时间源自已 pin 的 SPEC-6.1，新增仅「显示这三项 + 倒序 + 空文案」的组合约定。
- **影响的 testplan/design-prompt**：本 DP §2.3/§5.2 检查点 10 由「布局断言」补充「行内容/排序/空状态」断言；FM-07 面板 DEV 卡可据此实现。

### 提案 C（对应 P-1 的资产侧，非 spec 正文）：ASSETS.md 登记

- 非 spec 正文改动，属资产登记：`public/assets/ASSETS.md` 新增海岸线矢量数据行（来源/许可/抓取日期，§4.1 候选），并把 `earth_day.jpg`/`earth_night.jpg` 两行**标注为天气风格包专属（SPEC-3.9）、懒加载、不计首包**（SPEC-3.2③）。由 DEV 在 FM-08 卡内随实现更新，rev 门禁核对。
