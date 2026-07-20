# spec 修改提案 — G-2（GDACS 字段来源）/ G-3（LL2 字段来源与 list 模式坐标）

> arch 依真实 fixture 起草，**提案性质，未改任何正式文档**。经 rev 仲裁后由 orch 应用 SPEC-5.3/5.5 正文 + §0 修改记录 + `make pin-spec` + 同步 testplan M2-01/检查点 3-4。
>
> 触发：REV-007 §3 裁定次序第二步（fixture 已入库 → arch 依实测提案）。缺口原文见 `doc/design-prompt/M2-data.md` §6（G-2/G-3）。
>
> 证据源（只读，未整读入上下文，用 node 逐字段探查）：
> - `tests/fixtures/gdacs_eventlist.json`（634344 B，抓取 2026-07-20T14:19:20Z，端点 `geteventlist/MAP`）
> - `tests/fixtures/ll2_upcoming.json`（9822 B，抓取 2026-07-20T14:19:37Z，端点 `launch/upcoming/?limit=10&mode=list`）
> - 现行 `doc/spec.md` SPEC-5.3 / SPEC-5.5 / SPEC-6.1
>
> 每条映射标注 **[实证]**（当前 fixture 逐字段验证）或 **[推测]**（依 API schema 知识、当前 fixture 覆盖不到，须补抓确认）。二者不混写。

---

## 0. 证据探查结论速览

| 缺口 | 核心实证发现 | 对提案的影响 |
| --- | --- | --- |
| G-2 GDACS 坐标 | MAP 端点是 GeoJSON FeatureCollection，**同一 eventid 出现多条要素**（1 条 Point 中心点 + 多条 Polygon 影响区 / LineString 路径）；165 要素 → **25 个 distinct eventid**。每个 eventid **必有 ≥1 条 `geometry.type==='Point'` 的中心点要素**。 | 坐标须取 **Point 中心点要素**，不能对任意要素取几何；去重键 `gdacs:{eventid}` 天然把多要素合并为 1 事件。 |
| G-2 humanitarian 字段 | MAP 响应**不存在任何"人道响应"字段**；可用的分类相关字段仅 `eventtype`/`alertlevel`/`glide`/`severitydata`。 | 原判类条件"带人道响应字段"在该端点**不可实现**，须以保守替代规则改写（见 §2.4）。 |
| G-3 LL2 坐标 | `mode=list` 响应**完全不含发射工位经纬度**：`pad`、`location` 均为纯字符串名称（如 `"Space Launch Complex 4E"` / `"Vandenberg SFB, CA, USA"`），无 lat/lon 数值字段。 | SPEC-5.5"坐标取发射工位"在 list 模式**无法满足** → 须换端点 `mode=detailed`（§3.2）。 |
| G-3 LL2 其余字段 | `id`/`name`/`net`/`url` 在 list 模式均 [实证] 齐全（10/10）。 | title/ts/id 可 list 模式落地；lat/lon 与更优 summary/urls 依赖 detailed。 |

---

## 1. G-2 GDACS — 必填字段来源（SPEC-6.1 逐项）

### 1.1 fixture 实证结构

- 顶层：`{ type:'FeatureCollection', features:[...165], bbox }`。
- `features[]` 每条 = GeoJSON Feature，`{ type:'Feature', bbox:[minLon,minLat,maxLon,maxLat], geometry, properties }`。
- **要素类型分布**：Point 44 / Polygon 70 / LineString 51（Point=中心点，Polygon/LineString=影响区与路径）。
- **eventtype 分布（distinct 事件）**：TC 3 / DR 11 / FL 4 / EQ 7（共 25 事件）。
- **alertlevel 分布**：Green 157 / Orange 8 要素；**样本无 Red**（severity 3 无实证，见 §1.4）。
- 已核验：同一 eventid 的所有要素，`name`/`alertlevel`/`url.report`/`datemodified` **完全一致**（0 处不一致 / 165 要素）——故取该 eventid 任一要素的 `properties` 作事件级字段均等价，本提案统一规定取 **Point 中心点要素**。

### 1.2 SPEC-6.1 必填字段 → GDACS 原始路径（均取自该 eventid 的 **Point 中心点要素**）

| SPEC-6.1 字段 | 原始路径 | 标注 | 说明 |
| --- | --- | --- | --- |
| `id` | `properties.eventid` → `gdacs:{eventid}` | [实证] | 现行 SPEC-5.3 已规定，无变更。25 distinct，去重键稳定。 |
| `lat` / `lon` | 中心点要素 `geometry.coordinates`（`[lon, lat]`） | [实证] | 见 §1.3 选取规则。 |
| `title` | `properties.name` | [实证] | 165/165 非空（如 `"Flood in United States"`、`"Tropical Cyclone ELIDA-26"`）。`eventname` 有 26 条为空，**不用**。满足 title 非空。 |
| `summary` | `properties.htmldescription` | [实证] | 165/165 存在，含 alert 色 + 事件名 + 起止日期（如 `"Green Flood in United States from: 19 May 2026 01 to: 19 Jul 2026 01."`）。较 `description`（≈`name`）信息更全。SPEC-6.1 许空，此处非空。为纯文本无 HTML 标签（字段名 html- 系历史命名）。 |
| `urls` | `[properties.url.report]` | [实证] | 165/165 存在，为人读报告页 `report.aspx?eventid=...`。满足 urls≥1。`url.details`/`url.geometry` 是 API JSON，不入 urls。 |
| `ts` | `properties.datemodified`（按 **UTC** 解析）→ epoch ms | [实证] | 见 §1.5 时区陷阱与过期窗风险。 |
| `severity` | `properties.alertlevel` Green/Orange/Red → 1/2/3 | [实证 G/O，推测 R] | 现行 SPEC-5.3 已规定，无变更。样本仅含 Green/Orange，Red 分支未实证（§1.4）。 |
| `category` | `properties.eventtype` 判定 | 见 §1.4 | disaster / humanitarian，规则见 §1.4（原"带人道响应字段"不可实现）。 |
| `source` | 常量 `'gdacs'` | — | SPEC-6.1 约定。 |

### 1.3 坐标选取规则（关键，本提案新增到 spec）

**实证事实**：MAP 端点对每个 eventid 返回一组要素——1 条 `geometry.type==='Point'` 的中心点（`Class==='Point_Centroid'`）+ 若干 `Polygon`（影响缓冲区）+ `LineString`（如 TC 路径）。若对全部要素逐条归一化，会产生 165 个标记；且它们共享 `gdacs:{eventid}`，去重后**坐标由最后写入的要素决定**（非确定），可能落到 polygon 边界点或路径中段而非事件中心。

**提案规则**：
> 归一化时按 `eventid` 分组；每个事件的坐标取该 eventid **全部 `geometry.type==='Point'` 中心点要素**坐标的**经纬度包围盒中心** `((minLon+maxLon)/2, (minLat+maxLat)/2)`。单一中心点时退化为该点本身。`Polygon`/`LineString` 要素只是同一事件的几何细节，不单独成事件（去重键 `gdacs:{eventid}` 亦将其合并）。

- **[实证]** 25/25 个 eventid 均含 ≥1 Point 中心点要素；其中 15 个含 2–3 个中心点（多区域洪水/干旱，如某美国洪水 3 点、某跨国干旱 2 点）。对多中心点取包围盒中心，得到该事件的整体落点，**与顺序无关、跨轮询稳定**。
- **一致性**：此规则与已 pin 的 SPEC-5.2（EONET，G-1 裁定）"包围盒中心降维"同法，DEV/QA 心智一致。
- **仅对 Point 中心点取包围盒**：不可对全部要素（含 TC 大范围路径 LineString）取包围盒——那会把 TC 落点拉到整条路径中段。TC 实证每事件恰 1 个 Point 中心点（即当前风暴中心），直接采用。

### 1.4 humanitarian 判类 —— "人道响应字段"的实证落点与保守替代

**核心实证结论**：GDACS `geteventlist/MAP` 响应中**不存在**任何可直接判定"是否触发人道响应"的字段。逐项核验现有字段：

| 候选字段 | 实证内容 | 能否作"人道响应"判据 |
| --- | --- | --- |
| `eventtype` | `{DR, FL, EQ, TC}`（本样本） | 类型标识，非响应标识 |
| `alertlevel` / `alertscore` | Green/Orange（+ score） | 影响级别，非响应标识 |
| `glide` | GLIDE 灾害编号，仅 5 个 distinct 事件非空（**全为 DR**，FL 全为空） | ADRC 人道社区编号，最接近"进入人道追踪"信号，但样本极稀疏且不覆盖 FL |
| `severitydata` | `{severity, severitytext, severityunit}`（物理量级，如 "95167 km2"） | 物理严重度，非人道响应 |
| `source` | GLOFAS/GDO 等模型来源 | 数据来源，非响应标识 |

原 SPEC-5.3 判类条件"事件类型含 DR/FL **且带人道响应字段**"中的"人道响应字段"**在 MAP 端点无落点**，条件不可实现。须给保守替代。**这是用户可感知分类（category → 颜色），必须经 spec 落定，不得由 DEV 在代码或 DP 私定** —— 以下为供 rev 仲裁的三个替代方案，本 arch **推荐方案 A，但不默选**，值判交 rev：

| 方案 | 规则 | fixture 覆盖（distinct 事件 → humanitarian） | 优 | 劣 |
| --- | --- | --- | --- | --- |
| **A（推荐）** | `eventtype ∈ {DR,FL}` → humanitarian，其余 → disaster | 15 / 25（DR 11 + FL 4） | 字段必存在、确定、可机械断言；直接落实 SPEC-5.3 原文对 DR/FL 的枚举；无凭空阈值 | 较原"且带…"条件**放宽**——把 Green（轻微）DR/FL 也判 humanitarian |
| B（保守窄） | `eventtype∈{DR,FL}` 且 `glide` 非空 → humanitarian | 5 / 25（全 DR，无 FL） | 最接近"人道追踪"语义，最不易误标 | glide 稀疏且样本内 FL 全空，等于让 FL 永不为 humanitarian，与 SPEC-5.3 并列 DR/FL 相悖 |
| C（保守窄） | `eventtype∈{DR,FL}` 且 `alertlevel≠Green` → humanitarian | 3 / 25（全 DR） | 只把有影响的 DR/FL 判 humanitarian | Green→disaster 属自造阈值，无 GDACS "响应"字段背书；同样让样本内 FL 全落 disaster |

**推荐 A 的理由**：① SPEC-5.3 已显式点名 DR/FL 为人道候选类型，eventtype 就是该枚举的落点，用它判类不引入 spec 外的新维度；② `eventtype` 100% 存在，规则确定、QA 可对 fixture 精确断言（DR/FL 15 事件→humanitarian，EQ/TC 10 事件→disaster）；③ B/C 都需引入一个 GDACS 未以"响应"语义背书的阈值（glide 存在性 / alert 阈值），且都让样本内 FL 全部掉出 humanitarian，与 spec 并列 DR/FL 的意图不符。**代价**：A 相对原条件放宽了 humanitarian 边界（Green 轻微洪旱也入 humanitarian）——此为 rev 需拍板的产品取向（宁宽 vs 宁窄），故列 B/C 供选。

> 若 rev 取 B/C（宁窄），须注意 SPEC-5.3 原文"DR/FL"枚举的语义不得因此蒸发——即"DR/FL 属人道候选"仍应在 spec 表述中留痕，只是加了 glide/alert 二级闸门。

### 1.5 时区陷阱与过期窗交互（DEV 注意 + 遗留风险）

- **[实证] 时区陷阱**：GDACS 所有时间字段（`datemodified`/`fromdate`/`todate`）格式为 `"2026-07-20T05:57:19"`，**无 `Z`/时区后缀**，但 GDACS 约定为 **UTC**。JS `Date.parse` 对无后缀串按**本地时区**解释，会产生本地偏移量的系统性错误。DEV 归一化须显式按 UTC 解析（补 `'Z'` 或等价）。此为映射实现约束，写入 SPEC-5.3 备注。
- **[遗留风险 R-1] ts 取 datemodified 与过期窗（SPEC-6.3）交互**：选 `datemodified` 是因为 `fromdate`（事件起始，如干旱始于 5 月）会令持续数月的 current 事件一入库即超 48–72h 窗被清扫；`datemodified` 反映最近更新，当前样本中 current 事件的 datemodified 均在窗内（如某洪水 ~1.3 天前、某干旱 ~8h 前），可存活。**残留边界**：一个仍 `iscurrent` 但 GDACS 久未 modify（datemodified > 72h）的稳定事件，会被 sweepExpired 清掉（且每轮 re-upsert 用的仍是同一 datemodified，不刷新）。此属 **SPEC-6.3 过期语义**（按事件 ts vs 按"最后见到时刻"）层面的问题，超出 G-2 字段映射范畴，**登记为遗留风险交 rev**：是否需要 SPEC-6.3 补"持续事件按最后拉取时刻续期"。本提案不擅自扩 6.3。

---

## 2. G-2 SPEC-5.3 修订文本

**现行**（`doc/spec.md` SPEC-5.3）：
> - **SPEC-5.3 GDACS 灾害/人道** → category `disaster` 或 `humanitarian`（事件类型含 DR/FL 且带人道响应字段时）
>   - `https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP`，轮询 300s。
>   - alertlevel Green/Orange/Red → severity 1/2/3。`id=gdacs:{eventid}`。

**建议**（rev 取方案 A 时）：
> - **SPEC-5.3 GDACS 灾害/人道** → category `disaster` 或 `humanitarian`
>   - `https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP`，轮询 300s。响应为 GeoJSON FeatureCollection；**同一 `eventid` 会出现多条要素**（1 条 `geometry.type='Point'` 中心点 + 若干 Polygon 影响区 / LineString 路径）。归一化按 `eventid` 分组，每组产出一个事件（去重键 `gdacs:{eventid}` 亦合并同 eventid 的多要素）。
>   - 坐标：取该 eventid **全部 Point 中心点要素**坐标的经纬度包围盒中心 `((minLon+maxLon)/2,(minLat+maxLat)/2)`（单点退化为该点）；Polygon/LineString 要素仅为几何细节，不单独成事件、不参与取坐标。
>   - 字段（取自该 eventid 任一要素的 `properties`，事件级字段跨要素一致）：`id=gdacs:{eventid}`；title=`name`；summary=`htmldescription`；urls=`[url.report]`；ts=`datemodified`（GDACS 时间戳为 **UTC 且无时区后缀**，须按 UTC 解析）。
>   - severity：`alertlevel` Green/Orange/Red → 1/2/3。
>   - category：`eventtype ∈ {DR, FL}` → `humanitarian`，其余（EQ/TC/…）→ `disaster`。

**依据**：§1 各行实证；坐标规则与 SPEC-5.2（G-1）同法保持一致；humanitarian 改写因 MAP 端点无"人道响应"字段（§1.4），取 eventtype 判类为最少假设的确定规则。

**影响面**：
- testplan **M2-01 / M2-data.md 检查点 3**：GDACS 从"按检查点 5 结构不变量断言"升级为可精确断言字段来源值（title=name、坐标=Point 中心点包围盒中心、DR/FL→humanitarian 等）。
- QA 断言可对 fixture 机械核对：25 事件、DR/FL 15→humanitarian、EQ/TC 10→disaster、坐标落 Point 中心点。
- 无既有 ✅ 场景被推翻（M2 GDACS 尚未实现，检查点 3 处于"结构不变量"待裁态）。

---

## 3. G-3 LL2 — 字段来源与 list 模式坐标

### 3.1 fixture 实证：list 模式无坐标（G-3 核心答案）

- 顶层：`{ count:363, next, previous, results:[...10] }`。
- `results[]` 键集（[实证]）：`id, url, slug, name, status, last_updated, net, net_precision, window_end, window_start, lsp_name, mission, mission_type, pad, location, landing, launcher, orbit, image, infographic, type`。
- **`pad` 与 `location` 均为纯字符串**（`pad:"Space Launch Complex 4E"`、`location:"Vandenberg SFB, CA, USA"`），**无 latitude/longitude 数值字段**；10/10 result 皆然。
- **实测答案：`mode=list` 不含发射工位经纬度**，SPEC-5.5"坐标取发射工位"在 list 模式**无法满足**。

### 3.2 坐标方案对比与推荐

| 方案 | 做法 | 请求预算（现 1800s=2 req/h，免费 15 req/h） | 结论 |
| --- | --- | --- | --- |
| **① 换 `mode=detailed`（推荐）** | 同一 upcoming 端点改 `mode=detailed`，单次响应含完整 `pad` 对象（`pad.latitude`/`pad.longitude`） | **仍 1 请求/轮 = 2 req/h ≤ 15**，仅单响应体增大（约数倍），请求数不变 | **推荐**：不增请求数、预算内、一次拿全字段 |
| ② list + 逐发射二级请求 | list 拿 id，再对每条 launch 请求 detail 取坐标 | 10 detail/轮 → 2 轮/h ×(1+10)=**22 req/h > 15**，超免费额 | 驳回（爆预算） |
| ③ list + 本地工位 gazetteer | 维护 `pad 名称 → 坐标` 查表 | 0 增请求 | 驳回：属 T2 gazetteer（SPEC-5.8 T2/M3），且违背 T1"自带坐标源"定义，对新工位脆弱、需长期维护 |

**推荐方案 ①（`mode=detailed`）**，理由：请求数不变即满足 SPEC-5.5 的 ≤2 req/h 预算闸门；detailed 一并提供更优的 summary/urls；不引入 gazetteer（不越 M3 T2 边界，不加长期维护面）。

**[推测] 待确认**：`mode=detailed` 含 `pad.latitude`/`pad.longitude`（字符串数值，parse 为 number）等字段，来自 LL2 2.2.0 schema 知识，**当前 fixture 未覆盖**。须由 qa **补抓一份 `?limit=10&mode=detailed` fixture**（同一 upcoming 端点，一次即可，注意免费额敏感）确认字段存在后，方可 pin SPEC-5.5 坐标条款并令 dev 实现 / QA 精确断言坐标。此为本提案对 orch/rev 的前置动作建议。

### 3.3 SPEC-6.1 必填字段 → LL2 原始路径

| SPEC-6.1 字段 | list 模式路径 | detailed 模式路径（推荐端点） | 标注 |
| --- | --- | --- | --- |
| `id` | `results[].id` → `ll2:{id}` | 同 | [实证]（list），现行 SPEC-5.5 已规定 |
| `title` | `results[].name`（如 `"Falcon 9 Block 5 \| Starlink Group 17-39"`，10/10 非空） | 同 | [实证] |
| `ts` | `results[].net`（T-0，ISO **含 Z**，`Date.parse` 直接得 UTC；10/10 存在） | 同 | [实证]；亦为 T-24h/T-1h severity 的基准 |
| `severity` | 由 `net` 相对 `now`：T-1h 内→3，T-24h 内→2，其余→1 | 同 | [实证 字段]（severity 阈值规则为 SPEC-5.5 现文，未变） |
| `lat`/`lon` | **不存在** | `pad.latitude` / `pad.longitude`（字符串→number） | list [实证 缺失] / detailed [推测 待补抓] |
| `summary` | `results[].mission`（字符串名，如 `"Starlink Group 17-39"`）；无描述文本 | `mission.description`（完整任务描述） | list [实证]（弱）/ detailed [推测] |
| `urls` | `[results[].url]`（LL2 API 自链 JSON，非人读页；10/10 存在，满足 ≥1 但为 API 链接） | `infoURLs[].url` / `vidURLs[].url`（人读页），空时回落自链 `url` | list [实证]（弱）/ detailed [推测] |
| `source` | 常量 `'ll2'` | 同 | — |

- **[实证] `net` 有 `Z`**，与 GDACS 无后缀相反，无时区陷阱。
- **urls 观察**：list 模式仅有 API 自链，作"详情卡"链接体验差；detailed 的 `infoURLs`/`vidURLs` 才是人读页——是推荐换 detailed 的次要动因（主动因是坐标）。

### 3.4 G-3 SPEC-5.5 修订文本

**现行**（`doc/spec.md` SPEC-5.5）：
> - **SPEC-5.5 Launch Library 2 火箭发射** → category `launch`（M2：属 T1 自带坐标源，随首批 provider 接入）
>   - `https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=10&mode=list`，轮询 1800s（免费额 15 req/h，预算 ≤2 req/h）。
>   - 坐标取发射工位；T-24h 内 severity 2，T-1h 内 3，其余 1。`id=ll2:{launch.id}`。

**建议**（前置：qa 补抓 mode=detailed fixture 确认坐标字段后 pin）：
> - **SPEC-5.5 Launch Library 2 火箭发射** → category `launch`（M2：属 T1 自带坐标源，随首批 provider 接入）
>   - `https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=10&mode=detailed`，轮询 1800s（免费额 15 req/h，预算 ≤2 req/h；detailed 仅增大单响应体，请求数不变仍 2 req/h）。改用 `mode=detailed` 因 `mode=list` 响应不含发射工位坐标。
>   - 字段映射：`id=ll2:{launch.id}`；lat/lon 取 `pad.latitude`/`pad.longitude`（发射工位）；title=`name`；summary=`mission.description`；urls 取 `infoURLs[].url` ∪ `vidURLs[].url`（皆空时回落 `url`）；ts=`net`（T-0，ISO UTC）。
>   - severity：以 `net` 相对当前时刻，T-1h 内 3，T-24h 内 2，其余 1。

**依据**：§3.1 list 无坐标为实证；换端点为 §3.2 方案对比后唯一满足预算的坐标获取路径；title/ts/id 为 list 实证、坐标/summary/urls 为 detailed 推测（须补抓 fixture 落地为实证后再 pin）。

**影响面**：
- testplan **M2-01 / M2-data.md 检查点 4**：LL2 从"按检查点 5 结构不变量断言"升级为可精确断言 id/坐标/T-24h/T-1h severity/字段来源。
- `tests/fixtures/`：须新增 `ll2_upcoming_detailed.json`（mode=detailed），README 登记抓取时间；现 `ll2_upcoming.json`（list）可留作"list 无坐标"的实证或替换。
- SPEC-5.5 端点参数变更（list→detailed）须在 §0 修改记录说明，并核对 M2-data.md §2.2「LL2 走 mode=list」一句同步改为 detailed（否则 DP 与 spec 分叉）。

---

## 4. 已知限界（样本覆盖不到的枚举，列为限界而非断言）

| 项 | 限界 | 处置 |
| --- | --- | --- |
| GDACS severity=3（Red） | 样本仅 Green/Orange，Red→3 分支无实证 | 映射为 SPEC-5.3 既定，保留；QA 对 fixture 只能断言 1/2，Red 分支属规则外推，不因无实证而删 |
| GDACS 其他 eventtype（VO/WF 等） | 样本仅 DR/FL/EQ/TC | category 规则"非 {DR,FL}→disaster"已覆盖未见类型，无缺口 |
| LL2 坐标/summary/urls（detailed） | 当前 fixture 为 list，detailed 字段未实证 | §3.2 [推测]，**须补抓 mode=detailed fixture 方可 pin** |
| LL2 net 为 null / TBD 发射 | 本样本 10/10 有 net | 若 detailed 样本出现 net 为空，severity 无基准——补抓后若见，需补一句 ts 回落抓取时间（SPEC-6.1）；当前无实证，仅提示 |
