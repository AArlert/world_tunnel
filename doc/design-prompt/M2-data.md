# design-prompt — M2 数据核心 + T1 信源框架（src/data/）

> arch 撰写，rev 门禁通过后 orch 据此派 dev。只准约束实现，不准定义 spec 之外的对外可见行为（行为泄漏禁区，见 .claude/agents/arch.md）。
>
> 覆盖 feature-matrix：FM-05（数据核心）、FM-06（T1 信源）。

## 1. 目标与范围

从零建 `src/data/`：**四个 T1 自带坐标源的轮询与归一化 → 全局去重/过期存储 → IndexedDB 缓存读写 → 对 UI/globe 的只读快照口**。
数据层是纯逻辑层，**零 three.js 依赖**（坐标以 WGS84 度传递，球面换算由 globe 层的 `latLonToVector3` 负责，SPEC-6.2）。

**做**：SPEC-5.0（统一轮询/退避/条件请求约束）、SPEC-5.1/5.2/5.3/5.5（USGS/EONET/GDACS/LL2 四源）、SPEC-5.8-T1（自带坐标源）、
SPEC-6.1（GeoEvent 模型）、SPEC-6.3（去重/过期）、SPEC-8.4（IndexedDB 持久化）、SPEC-3.11 的**数据侧**（启动先从缓存回填、每轮持久化）。

**不做**（均属他卡，本卡只留接口，不实现）：
- 事件标记渲染、点击拾取、列表面板 → FM-07（消费本卡的读口）。
- 呼吸式过渡的**渲染**表现（渐隐/渐亮、整屏不闪）→ FM-09；本卡只保证"启动先回填缓存、不预先清扫过期"的**数据侧顺序**（§2.5）。
- 分类过滤 / watchlist / 命中强调 → FM-10（M2）/ FM-16（M4）；读口输出**未过滤全量快照**，过滤是消费侧职责（§3.7 边界）。
- 扩展信源 GDELT/OpenSky/CoinGecko、解析分层 T2/T2.5/T3/T4、自定义 RSS、收藏永久保留 → M3/M4/M6。
- **唯一为 M3 预留的扩展开口 = provider 注册数组本身**（§3.6），不设插件系统、不设风格/策略抽象层（YAGNI，CLAUDE.md §1.2）。

## 2. 约束（每条标注 SPEC 锚点）

### 2.1 归一化模型与坐标边界

- 全源统一输出 `GeoEvent`，字段与语义**逐字照 SPEC-6.1**（id/category/severity/title/summary/urls/lat/lon/ts/source）。DP 不复述字段语义，DEV/QA 一律以 SPEC-6.1 为准（SPEC-6.1）。
- `src/data/` **禁止 import three**：坐标停留在 `{ lat, lon }` 度值，可在 node 下无 WebGL 单测（SPEC-6.2 的换算属 globe 层）。此为可测性硬边界。
- 每源的字段映射（id 前缀、title 组装、severity 分级、category 判定）**严格照对应 SPEC 条目**，不得在本 DP 或代码里另立规则（SPEC-5.1/5.2/5.3/5.5）。存在字段来源缺口的源见 §6 待提案项。

### 2.2 轮询、退避、条件请求（SPEC-5.0，通用约束）

- 每源独立轮询间隔与限流预算，互不阻塞：USGS 60s、EONET 300s、GDACS 300s、LL2 1800s（LL2 预算 ≤2 req/h）（SPEC-5.1/5.2/5.3/5.5）。间隔为**命名常量**，测试断言引用 SPEC 条目。
- HTTP 失败**指数退避**：`nextDelay = min(intervalMs × 2^n, 30min)`，n 为连续失败次数；成功（含 304）后 n 归零（SPEC-5.0）。
- 支持 ETag/Last-Modified 的源发**条件请求**（`If-None-Match` / `If-Modified-Since`）；**304 视为成功且无新数据**——不重新归一化、不退避、不改动存储（SPEC-5.0）。
- **故障隔离**：任一源的网络/解析异常必须被本源的轮询循环捕获，不得冒泡到其他源或渲染；退避后自行恢复（SPEC-5.0）。
- LL2 走 `mode=detailed`、limit=10、1800s（SPEC-5.5，REV-008 裁决换端点参数）——间隔即预算闸门，DEV 不得为"更实时"缩短。

### 2.3 去重与更新（SPEC-6.3）

- 存储以 `id` 为主键；**同 id 再现视为更新**，覆盖 ts/severity/summary（及其余可变字段），**不新增第二个条目**（SPEC-6.3）。
- 去重键即 SPEC-6.1 的 `id`（`{source}:{原始id}`），全局唯一，跨轮询稳定（SPEC-6.1 + 6.3）。

### 2.4 过期清扫（SPEC-6.3）

- 默认过期窗为**单一命名常量，取值须落在 SPEC-6.3 规定的 [48h, 72h] 区间内**（具体值视存储预算定、可配，属 spec 许可的实现自由度，不在本 DP 另定新值）；超窗且无更新的事件从存储移除（SPEC-6.3）。
- flight 的 60s 特例与**收藏永久保留**均属后续里程碑（flight→FM-12/M3，收藏→FM-17/M4），M2 不实现；但清扫逻辑不得写成**阻碍**后续按类/按收藏豁免的形态（预留 per-category TTL 与保护集的插入点即可，不提前建）（SPEC-6.3）。
- 清扫的触发时机受 §2.5 约束。

### 2.5 缓存优先启动的数据侧顺序（SPEC-3.11 数据侧 + SPEC-8.4）

- 启动路径：**先**从 IndexedDB 读回上次缓存事件、灌入存储（供 FM-09 立即上屏），**再**启动轮询（SPEC-3.11：不空网络等待）。
- 回填缓存时**不执行过期清扫**——缓存里的旧事件要能先上屏，其熄灭由首轮刷新后的清扫 + FM-09 的呼吸过渡承接（SPEC-3.11）。清扫在**每轮成功刷新后**随 `now` 执行。
- 每轮存储变更后将快照**持久化**回 IndexedDB（可去抖合并写，去抖窗口属实现细节不进 spec）；缓存已从"可重建"升格为启动路径一部分（SPEC-3.11 + 8.4）。
- IndexedDB 仅承载**事件缓存**；watchlist/设置的持久化属 FM-10/FM-16，本卡不碰（SPEC-8.4 边界）。不承诺离线数据完整性（SPEC-8.4），配额溢出的淘汰策略 M2 不做（过期窗已天然限界）。

### 2.6 fixtures 事实源（CLAUDE.md §7）

- 四源各需在 `tests/fixtures/` 存**真实 API 响应样本**，头注抓取时间；归一化单测以此为事实依据。USGS 需 `all_hour` 与 `all_day` 两份（启动回填走 all_day，SPEC-5.1）。
- 归一化必须写成**纯函数**（`normalizeXxx(raw, now) → GeoEvent[]`），与 fetch 解耦，才能对 fixture 断言且不打网络（可测性要求，非 spec 行为）。
- 抓取时若发现源存在 CORS / 端点字段缺失等工程障碍，见 §4.4 / §6，按缺陷登记，不在代码里自行绕过。

## 3. 接口

### 3.1 模块与文件职责

| 文件 | 职责 | 依赖 |
| --- | --- | --- |
| `src/data/types.ts` | `GeoEvent`（SPEC-6.1）、`Category`/`SourceId` 联合、`EventProvider`/`ProviderResult`/`PollContext` 契约 | 无 |
| `src/data/store.ts` | `EventStore`：去重 upsert、过期清扫、快照/订阅（SPEC-6.3） | types |
| `src/data/http.ts` | `conditionalFetch`：ETag/Last-Modified 校验缓存、AbortSignal、非 2xx/304 抛错（SPEC-5.0） | 无（fetch） |
| `src/data/scheduler.ts` | `Scheduler`：每源独立定时 + 指数退避 + 故障隔离（SPEC-5.0） | types |
| `src/data/cache.ts` | IndexedDB 事件缓存的读/写（SPEC-8.4、SPEC-3.11 数据侧） | types |
| `src/data/providers/usgs.ts` | `normalizeUsgs` 纯函数 + `usgsProvider`（SPEC-5.1） | types, http |
| `src/data/providers/eonet.ts` | 同上（SPEC-5.2） | types, http |
| `src/data/providers/gdacs.ts` | 同上（SPEC-5.3） | types, http |
| `src/data/providers/ll2.ts` | 同上（SPEC-5.5） | types, http |
| `src/data/providers/index.ts` | `T1_PROVIDERS` 注册数组——**M3 扩展的唯一开口** | 四 provider |
| `src/data/index.ts` | `createDataLayer`：装配 store+scheduler+cache，暴露读口与 start/stop | 以上全部 |

拆分理由：归一化纯函数需脱网单测（§2.6）；store/scheduler 需在 node 下无 WebGL/无网络单测。**不加插件系统、不加策略注册表、不加事件总线**（CLAUDE.md §1.2）。

### 3.2 类型契约（types.ts）

```ts
// GeoEvent 逐字照 SPEC-6.1，此处只声明不重定义语义
export type Category = 'disaster' | 'conflict' | 'humanitarian' | 'news' | 'launch' | 'flight'
export type SourceId = 'usgs' | 'eonet' | 'gdacs' | 'gdelt' | 'll2' | 'opensky'
export interface GeoEvent { /* SPEC-6.1 的全部字段 */ }

/** provider 拉取一次的结果；transport/解析异常一律 throw（由 scheduler 退避处理） */
export type ProviderResult =
  | { status: 'ok'; events: GeoEvent[] }
  | { status: 'notModified' }            // 304，SPEC-5.0

export interface PollContext {
  firstRun: boolean      // 首次运行：USGS 拉 all_day 回填（SPEC-5.1）
  now: number            // 注入时钟（epoch ms）：LL2 时序 severity 可测（SPEC-5.5）
  signal: AbortSignal    // dispose 中止在途请求
}

export interface EventProvider {
  readonly source: SourceId
  readonly intervalMs: number            // SPEC-5.1/5.2/5.3/5.5
  poll(ctx: PollContext): Promise<ProviderResult>
}
```

### 3.3 存储与读口（store.ts）—— 对 UI/globe 的唯一读口

```ts
export class EventStore {
  /** 只读全量快照（未过滤）；FM-07 globe 标记层与 FM-10 面板共同消费 */
  snapshot(): readonly GeoEvent[]
  /** 订阅变更，返回退订函数；供 FM-07/FM-09 拉取新快照重绘。变更粒度=整快照，diff 由消费侧算 */
  subscribe(listener: (events: readonly GeoEvent[]) => void): () => void

  /** 去重合并，同 id 覆盖 ts/severity/summary（SPEC-6.3）；scheduler 每轮调用 */
  upsertMany(events: GeoEvent[]): void
  /** 缓存回填：灌入且不触发清扫（SPEC-3.11 数据侧顺序，§2.5） */
  load(events: GeoEvent[]): void
  /** 过期清扫：移除超窗无更新事件（SPEC-6.3）；每轮刷新后带 now 调用 */
  sweepExpired(now: number): void
}
```

- `snapshot()` 返回**未过滤全量**；分类/watchlist 过滤是消费侧（FM-10/M4）职责，store 不内建过滤（SPEC-8.1 的过滤属 FM-10 边界，见 §3.7）。

### 3.4 HTTP 与条件请求（http.ts）

```ts
export type ConditionalResult =
  | { status: 'ok'; body: unknown }
  | { status: 'notModified' }

/** 带 ETag/Last-Modified 校验缓存（按 url 键，进程内即可）；304→notModified；非 2xx/304→throw（SPEC-5.0） */
export function conditionalFetch(url: string, signal: AbortSignal): Promise<ConditionalResult>
```

- 校验缓存（etag/lastModified）**进程内 Map 即可**，无需持久化（SPEC-5.0 未要求跨会话保留 validator）。
- 条件请求头仅对声明支持的源发送；不支持的源退化为普通 GET（provider 自定，属 §4.2 实现提示）。

### 3.5 调度与退避（scheduler.ts）

```ts
export class Scheduler {
  constructor(
    providers: EventProvider[],
    onResult: (events: GeoEvent[]) => void,   // ok 且非空时回调，交 store.upsertMany
    clock?: () => number,                     // 注入时钟，默认 Date.now
  )
  start(): void   // 首轮 firstRun=true，各源按自身 intervalMs 独立排程
  stop(): void    // abort 在途请求 + 清所有定时器（dispose 生命周期）
}
```

- 每源持有独立的 backoff 计数与定时器；一源失败只影响该源的下次延迟，其余源不受影响（SPEC-5.0 故障隔离）。
- `status==='notModified'` 视为成功：不回调 onResult、不退避、重置 backoff（SPEC-5.0）。

### 3.6 装配根与 M3 扩展开口（index.ts / providers/index.ts）

```ts
// providers/index.ts —— M3 追加 provider 的唯一位置（GDELT/OpenSky 等），M2 不预留其他扩展点
export const T1_PROVIDERS: EventProvider[] = [usgsProvider, eonetProvider, gdacsProvider, ll2Provider]

// index.ts —— App/GlobeScene 侧的接入点（谁来 start 属 FM-07/FM-10 wiring，非本卡）
export function createDataLayer(): {
  store: EventStore
  start(): Promise<void>   // 1) cache→store.load（SPEC-3.11）  2) scheduler.start
  stop(): void             // scheduler.stop + 落一次持久化
}
```

- `createDataLayer` 内部编排：cache 回填 → 启动调度 → 每轮 `store.upsertMany` + `store.sweepExpired(now)` + 去抖 `cache.persist`。
- CoinGecko（SPEC-5.7 顶栏 ticker）**非 GeoEvent、不进本注册数组**，属 FM-12 独立通道，M2 不设计。

### 3.7 与相邻模块的数据流与边界

```
[四 T1 源]                       [启动]
  fetch(conditional, SPEC-5.0)     cache.load(IndexedDB, SPEC-3.11/8.4)
      │                                 │
      ▼                                 ▼
  normalize(raw, now) → GeoEvent[]    EventStore.load  ──先于网络──┐
      │  (SPEC-5.1/5.2/5.3/5.5, 6.1)                              │
      ▼                                                            ▼
  scheduler.onResult → store.upsertMany(去重 6.3) → sweepExpired(6.3) → cache.persist
                                     │
                                     ▼  snapshot()/subscribe()（未过滤全量）
                        ┌────────────┴────────────┐
                    FM-07 globe 标记层          FM-10 面板/分类过滤
                 (latLonToVector3, SPEC-6.2)   (SPEC-8.1 过滤在此，非 store)
```

- **上游边界**：provider 只吐 `{lat, lon}` 度值，不碰 three（SPEC-6.2 换算在 globe 层 `geo.ts`，已存在）。
- **下游边界**：store 只提供**未过滤快照 + 订阅**；FM-07 挂标记进 `GlobeScene.markerRoot`（M1 已留），FM-10 做分类过滤与顶栏——均消费本读口，本卡不实现它们。

## 4. 实现提示（不构成强约束）

### 4.1 归一化纯函数与时钟注入
LL2 的 severity 依赖 `T-24h/T-1h`（SPEC-5.5），USGS/EONET 的 ts 缺省回落抓取时间（SPEC-6.1），都要求把"当前时间"作为**显式入参 `now`** 传入 normalize，禁止函数内部 `Date.now()`——否则 fixture 单测不可复现（对照 M1 astro 的显式 `Date` 入参约定）。

### 4.2 条件请求的源差异
USGS 的 geojson feed 支持 ETag，优先条件请求省流量；EONET/GDACS/LL2 是否返回可用 validator 以 fixture 抓取时的响应头为准，不支持则退化普通 GET（`conditionalFetch` 遇无 validator 自然走 200 分支即可，无需分叉 provider 代码）。

### 4.3 生命周期与竞态
沿用 M1 的 dispose 纪律：`Scheduler.stop()` 必须 `AbortController.abort()` 在途 fetch + 清定时器；`createDataLayer().stop()` 由 GlobeScene/App 卸载时调用，防 React StrictMode 双挂载泄漏。异步归一化完成时若已 stop，丢弃结果不入 store。

### 4.4 已知工程陷阱（登记而非绕过）
- **CORS**：T1 源在浏览器直连可能缺 `Access-Control-Allow-Origin`（GDACS 尤需实测）。零服务器纪律（SPEC-9）禁止加代理；按 SPEC-5.0，CORS 失败的源应**优雅退避降级、不拖垮其余源与渲染**。若某源确被 CORS 封死，属 spec/上游契约缺陷，**登记 bugs.md 交 rev 仲裁**（web 端可行性 vs 推迟到原生 M6），不在代码里硬绕。
- **LL2 `mode=list` 字段**：list 模式可能不含发射工位经纬度（SPEC-5.5 要求"坐标取发射工位"）。已裁决：实测 list 无坐标，端点改 `mode=detailed`（REV-008 §6.2 已入 spec）。
- 测试链路走 Vitest（Node），不涉及 BUG-001 的 Python/AppData 约束。

## 5. 验收判据

### 5.1 DEV 自检（交付前必过）
- `make lint`：eslint 0 警告 + `tsc --noEmit` 0 错误。
- `make test`：新增归一化/store/scheduler 单测全绿，既有单测不回归。
- **`src/data/` 无 `import ... 'three'`**（可 grep 自检）——数据层零渲染依赖。
- 四源 fixture 已落 `tests/fixtures/`（USGS 两份），头注抓取时间。

### 5.2 建议 QA 覆盖的检查点（只列检查点，断言由 QA 从 spec 推导）
归一化（对 fixture，纯函数）：
1. USGS：id/title/lat/lon/ts/url 映射与 severity 三档（mag 阈值），all_day 回填路径（SPEC-5.1）。
2. EONET：id、最新 geometry 取坐标、category[0] 进 summary、severity 默认（SPEC-5.2；polygon 取点规则见 §6 待裁）。
3. GDACS：alertlevel→severity 三档、DR/FL+人道字段→humanitarian 否则 disaster、id（SPEC-5.3；字段来源缺口见 §6）。
4. LL2：id、发射工位坐标、T-24h/T-1h/其余的 severity（注入 now 打三个边界）（SPEC-5.5）。
5. 全源输出满足 SPEC-6.1 结构不变量：id 唯一且 `{source}:` 前缀、severity∈{1,2,3}、lat∈[-90,90]/lon∈(-180,180]、title 非空、urls≥1（flight 除外，M2 无 flight）（SPEC-6.1）。

存储（store 单测，无网络）：
6. 去重：同 id 二次 upsert 覆盖 ts/severity/summary 且总数不增（SPEC-6.3）。
7. 过期清扫：超窗事件被移除、窗内保留，且窗常量落在 [48h,72h]（SPEC-6.3）。
8. `load()` 回填不触发清扫；`sweepExpired` 仅在带 now 调用时清扫（SPEC-3.11 数据侧顺序）。
9. snapshot 未过滤 + subscribe 变更通知（读口契约）。

调度与退避（scheduler 单测，mock provider）：
10. 每源按自身 intervalMs 独立排程、互不阻塞（SPEC-5.0/5.1/5.2/5.3/5.5）。
11. 失败→指数退避 `intervalMs×2^n`、上限 30min；成功/304 后 n 归零（SPEC-5.0）。
12. 一源持续抛错不影响其余源继续出数（故障隔离，SPEC-5.0）。
13. 304（notModified）不重新归一化、不退避、不写 store（SPEC-5.0）。

缓存（cache + 装配，fake-indexeddb 或等价）：
14. 启动 `createDataLayer().start()` 先 load 缓存入 store、后启调度（SPEC-3.11 数据侧）。
15. 每轮变更持久化、重启后 round-trip 还原（SPEC-8.4）。

> 检查点 3/4 中 GDACS/LL2 的**字段级精确值**断言依赖 §6 待提案项裁决；未裁决前，QA 对这两源按检查点 5 的 SPEC-6.1 **结构不变量**断言（非空/≥1/范围/前缀），不断言具体字段来源值。此为已知留痕，非判据缩水（SPEC-6.1 不变量真实覆盖，无 spec 子句掉出场景）。

## 6. 待提案项（spec 缺口，须经 rev 仲裁后由 orch 应用，DEV 不得在 DP/代码自行定义）

| # | 缺口 | 涉及 SPEC | 影响 |
| --- | --- | --- | --- |
| G-1 | EONET geometry 为 Polygon/MultiPolygon 时如何降维到单一 lat/lon（SPEC-5.2 "坐标取最新 geometry" 只覆盖 Point） | SPEC-5.2 + 6.1 | eonet 归一化坐标合法性；检查点 2 精确断言 |
| G-2 | GDACS 的 title/summary/urls/lat-lon **字段来源**未在 SPEC-5.3 给出（仅给 severity/id/category）；"人道响应字段"具体指哪个字段亦未明 | SPEC-5.3 + 6.1 | gdacs 归一化；检查点 3 精确断言 |
| G-3 | LL2 的 title/summary/urls **字段来源**未在 SPEC-5.5 给出；且 `mode=list` 是否含工位坐标待实测（§4.4）——已裁决闭合，见 REV-008 | SPEC-5.5 + 6.1 | ll2 归一化；检查点 4 精确断言 |

处理建议（供 orch/rev 参考，非本 DP 决议）：G-1 可现在裁（几何规则，不依赖 fixture）；G-2/G-3 依赖字段来源，宜**先派 qa/dev 抓 fixture**，再由 arch 依真实响应提 spec 映射提案、rev 仲裁 pin，之后 dev 才实现这两源的精确映射。M2 其余部分（USGS/EONET 主干 + store + scheduler + cache）不被这三项阻塞，可先行。
