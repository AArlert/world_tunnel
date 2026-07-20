# REV-007 — M2 数据核心 + T1 信源 design-prompt 门禁 + spec 缺口 G-1~G-3 仲裁

- 日期：2026-07-20　审查员：rev（独立实例，未参与本 DP 的 arch 撰写）
- 审查对象：`doc/design-prompt/M2-data.md`（FM-05 数据核心 + FM-06 T1 信源）
- 判据出处（均独立读原始材料，不采信 DP 的自述转引）：
  - `doc/spec.md` SPEC-5.0/5.1/5.2/5.3/5.5/5.6/5.9、SPEC-6.1/6.2/6.3、SPEC-3.10/3.11、SPEC-8.1/8.4、§9
  - `doc/design-prompt/_template.md`（模板符合性）
  - `doc/feature-matrix.md` FM-05/FM-06/FM-07/FM-09/FM-10/FM-12/FM-17 行
  - `doc/testplan.md` M2-01 ~ M2-04
  - `.claude/agents/arch.md`（行为泄漏禁区原文）、CLAUDE.md §1/§5.2/§5.3/§7
- 方式：门禁四项逐条独立判断；G-1 的几何规则独立设计并给出可直接应用的 spec 修订文本；G-2/G-3 次序对照 §7 spec 修改路径核验；CORS 口径对照 SPEC-9/5.9/5.0 核验。

## 结论速览

| 项 | 结论 |
| --- | --- |
| 门禁 ① 行为泄漏 | **通过**。无 spec 之外的对外可见行为定义泄漏。附 1 条非阻塞措辞收紧建议（O-1）。 |
| 门禁 ② 极简 | **通过**。无 M2 范围外过度设计；YAGNI 纪律优良（§1 显式拒绝插件/策略/总线）。 |
| 门禁 ③ spec 锚点完备性 | **通过**。关键约束逐条可追溯，抽查锚点归属均正确。 |
| 门禁 ④ 与 testplan M2-01~04 一致性 | **通过（附 1 项须 orch 整改的边界失配）**。DP 无「替 QA 写断言」；但 testplan **M2-02 的 flight/opensky-60s 子句**与 DP（正确地）把 flight 推迟至 M3 相矛盾——须 orch 处置（F-1），不阻塞 DP。附 1 条非阻塞观察（O-2）。 |
| 仲裁 G-1 EONET 降维 | **即裁**。给出可直接应用的 SPEC-5.2 修订文本（§2）。 |
| 仲裁 G-2/G-3 次序 | **成立**。fixture → arch 提案 → rev 仲裁 → orch pin → dev 实现。未裁期间 dev 安全范围见 §3。 |
| CORS 口径（DP §4.4） | **成立**。附 2 条补充约束（§4）。 |
| **总结论** | **门禁通过，可派 dev**。派单须带 §3 的安全范围与 §5 的整改项（F-1 须先于 M2-02 派 QA 前解决）。 |

---

## 1. 交付门禁逐项结论

### 1.1 ① 行为泄漏检查：**通过**

按 arch.md「行为泄漏禁区」——UI 语义、交互规格、数据映射、分类色表等用户可感知行为必须先进 spec，DP 只准引用。逐节核验：

- **字段映射（最易泄漏处）**：DP §2.1 明写「字段与语义**逐字照 SPEC-6.1**，DP 不复述」「每源映射严格照对应 SPEC 条目，不得在本 DP 或代码里另立规则」，并把无法照抄的字段来源缺口显式抛给 §6 待提案。这是正确姿态——DP 未自定义任何 spec 没有的映射。
- **轮询/退避/条件请求（DP §2.2）**：间隔常量（60/300/300/1800s）、退避公式（`min(intervalMs×2^n, 30min)`）、LL2 预算（≤2 req/h）均系 SPEC-5.0/5.1/5.2/5.3/5.5 原文的精确复述，非新增行为。「304 视为成功且不重新归一化/不退避/不改存储」属 SPEC-5.0 条件请求条款的实现级细化（304 = 未修改是 HTTP 既有语义），非新的对外可见行为定义。
- **severity/坐标等具体取值**：DP §2 全程未restate USGS mag 阈值、LL2 T-24h/T-1h 等具体值；§5.2 检查点仅以「三档（mag 阈值）」「T-24h/T-1h」指向 spec，不写断言值。无泄漏。
- **渲染侧行为**：呼吸式过渡（渐隐/渐亮/不闪）明确划归 FM-09（§1「不做」），DP 只约束数据侧顺序（§2.5），未越界定义渲染表现。
- **过滤行为**：分类/watchlist 过滤明确划归 FM-10/M4（§3.3/§3.7），读口输出「未过滤全量快照」，未在数据层定义过滤语义。

**结论：无行为泄漏，通过。**

**O-1（非阻塞，措辞收紧建议）**：§2.3 与 §3.3 写「同 id 覆盖 ts/severity/summary（及其余可变字段）」。SPEC-6.3 只显式列 `ts/severity/summary` 三字段。「及其余可变字段」在 spec 枚举之外扩展了更新语义。判定**不构成硬泄漏**：① 不与 spec 冲突（整条替换是「视为更新」的自然读法）；② 关键在于 §5.2 检查点 6 已正确地把 QA 断言限回 spec 的三字段，**事实源未分叉**（行为泄漏禁区要防的正是 QA/DEV 事实源分叉，此处未发生）。建议 DP 把该括注改为「受保证的更新契约 = SPEC-6.3 明列三字段；实现可整条替换，不得与 spec 冲突」以消除歧义。此项交 orch，可让 arch 顺手改 DP，非派 dev 的前置。

### 1.2 ② 极简检查：**通过**

- §1「不做」清单完整排除 M2 范围外项：GDELT/OpenSky/CoinGecko、T2/T2.5/T3/T4、自定义 RSS、收藏永久保留。
- §1 + §3.1 双处显式声明「唯一扩展开口 = provider 注册数组本身；不设插件系统、不设风格/策略抽象层、不加策略注册表、不加事件总线」——直接对齐 CLAUDE.md §1.2 YAGNI。
- §2.4 per-category TTL 与保护集「**预留插入点即可，不提前建**」；§2.5 去抖写为可选实现自由度（「可去抖」）；§3.4 校验缓存「进程内 Map 即可，无需持久化」。均为最小实现，未见前置建设。
- 10 文件拆分（types/store/http/scheduler/cache/4×provider/providers-index/index）每个有脱网/无 WebGL 单测的可测性理由（§2.6/§3.1），粒度恰当，非过度拆分。

**结论：无 M2 范围外过度设计，通过。** 本 DP 的 YAGNI 纪律为正面样例。

### 1.3 ③ spec 锚点完备性：**通过**

逐节核锚点归属正确性（抽查，非采信 DP 自标）：

| DP 节 | 锚点 | 独立核对 |
| --- | --- | --- |
| §2.1 归一化/坐标边界 | SPEC-6.1、6.2、5.1/5.2/5.3/5.5 | 一致（6.2 换算属 globe 层，数据层禁 import three，锚点正确） |
| §2.2 轮询/退避/条件请求/隔离 | SPEC-5.0 + 各源 5.x | 一致（SPEC-5.0 原文含退避×2^n/上限 30min/条件请求/故障隔离四要件） |
| §2.3 去重 | SPEC-6.3 + 6.1 | 一致（去重键 = 6.1 的 id） |
| §2.4 过期窗 | SPEC-6.3（48–72h） | 一致（DP 不另定新值，落在区间内可配，符合 spec 许可自由度） |
| §2.5 缓存优先启动数据侧顺序 | SPEC-3.11 + 8.4 | 一致（先 load 后 poll、load 不清扫、每轮持久化，均可由 SPEC-3.11「旧标记先上屏后渐隐」正推） |
| §2.6 fixtures/纯函数 | CLAUDE.md §7 | 正确锚到流程规则而非 spec，且自标「纯函数属可测性要求，非 spec 行为」 |

关键约束均可追溯，无悬空约束。**通过。**

### 1.4 ④ 与 testplan M2-01~04 一致性：**通过（附须 orch 整改的 F-1）**

- **M2-01（SPEC-6.1/6.2 字段与坐标）**：DP §2.1 + 检查点 5 一致，无矛盾。
- **M2-03（SPEC-5.0 独立轮询）**：DP §2.2/§3.5 + 检查点 10/12 一致。
- **M2-04（SPEC-5.0 退避/条件请求/隔离）**：DP §2.2 + 检查点 11/12/13 一致。
- **是否「DP 替 QA 写断言」**：**否**。§5.2 标题即声明「断言由 QA 从 spec 推导」；检查点仅列「检查什么」，涉及的不变量（severity∈{1,2,3} 等）系 SPEC-6.1 属性指向，非 DP 自造期望值。尤其 §5.2 末段（line 245）显式规定：G-2/G-3 未裁前 QA 对 GDACS/LL2 只按 SPEC-6.1 **结构不变量**断言、不断言具体字段来源值，并论证「SPEC-6.1 不变量真实覆盖，无 spec 子句掉出场景」——这正是防「照抄实现」与防「判据蒸发」的正确做法，予以肯定。

- **F-1（矛盾，须 orch 整改，不阻塞 DP）—— M2-02 的 flight/opensky-60s 子句与 DP 冲突**：
  - testplan M2-02 含判据「`source='opensky'`（flight）事件不套用该 48–72h 窗口，其保留语义随 60s 轮询周期对齐（SPEC-6.3①「flight 60s 不变」）」。
  - 但 DP §2.4 明确 flight 60s 特例**属后续里程碑（flight→FM-12/M3），M2 不实现**，只预留插入点；DP §5.2 检查点 7 亦不含 flight 特例。二者一致地把 flight 排除在 M2 之外——这与 SPEC-5.6（opensky = M3）吻合，**DP 侧处理正确**。
  - 后果：M2 无 opensky 源，store.sweepExpired 按 DP 是**统一 48–72h**（源无关）。若 QA 按 M2-02 现行文构造合成 flight 事件断言「不套用该窗口」，将对 DP 的 M2 实现**必然失败**（统一窗口会扫掉它）；M2-02 因此在 DP 范围内**不可满足**。
  - 定性：这是 **testplan 侧的越界**（M2-02 把 SPEC-6.3① 的 flight 子句提前塞进 M2 场景），非 DP 缺陷。DP 与 spec 均自洽。
  - 处置（交 orch，须先于把 M2-02 派给 QA 前解决）：把 M2-02 的 flight/opensky-60s 子句**拆出并改挂 M3（FM-12 opensky）或 M4（FM-17，SPEC-6.3 收藏/过期窗可配）**。按 CLAUDE.md §5.2「改判据前先问是否有 spec 子句掉出全部场景之外」——SPEC-6.3①「flight 60s 不变」不得因此蒸发，须落到 M3+ 的实际 testplan 行，不能只留在 feature-matrix 占位。此拆分方向属「判据表述与实际范围对齐」（M2 本就无 flight 源），非 §5.2 禁止的「判据向实现看齐」（未下调强度、子句有新落点）。建议按缺陷登记（性质同 BUG-012/BUG-014 的表述/归属类），由 orch 定承接场景号。

**O-2（非阻塞观察）**：§5.2 检查点 5 写「lon∈(-180,180]」。SPEC-6.1 仅定义 lon 为「WGS84 度」，未 pin 半开/闭区间约定，SPEC-6.2 对 lon 范围亦无限制（latLonToVector3 对经度周期性无碍）。testplan M2-01 自身也未要求该精确区间，故 DP 与 testplan **无矛盾**。仅提示 QA：若无 spec 依据，不宜对 lon 断言严格半开区间 (-180,180]，按 SPEC-6.1 断言「有限实数、纬度∈[-90,90]」即可；若确需 pin lon 边界约定，走 §7 补 SPEC-6.1。

---

## 2. G-1 仲裁 —— EONET Polygon/MultiPolygon 降维（即裁）

**裁决依据**：G-1 只涉几何降维规则，EONET v3 geometry 采用 GeoJSON 标准（Point/Polygon/MultiPolygon 为标准类型），不依赖 fixture 即可裁（DP §6 亦作此判断）。SPEC-5.2 现「坐标取最新 geometry」仅覆盖 Point，非 Point 时无单一 lat/lon，导致 eonet 归一化坐标合法性与检查点 2 精确断言悬空。

**裁决**：取所选最新 geometry 全部坐标点的**经纬度包围盒中心**作为 (lat, lon)。理由：① 对 Point/Polygon/MultiPolygon 统一，Point 为单点退化（min=max），一条规则全覆盖；② 包围盒中心不受多边形闭合环重复首尾顶点的计数偏移影响（顶点算术平均会双计闭合点），对 DEV 无歧义、对 QA 可机械断言；③ 极简，不引入带符号面积质心运算（YAGNI）。

**可直接应用的 SPEC-5.2 修订文本**（由 orch 依 §7 应用 + §0 修改记录 + `make pin-spec` + 同步 testplan M2-01/检查点 2）：

- 原文（SPEC-5.2 映射句）：
  > 映射：`id=eonet:{event.id}`；坐标取最新 geometry；categories[0].title 进 summary；sources[].url 为信源。severity 默认 2。
- 新文：
  > 映射：`id=eonet:{event.id}`；坐标取 geometry 数组中**时间最新**的一条——其 `type` 为 `Point` 时取该点 `[lon, lat]`；为 `Polygon`/`MultiPolygon` 时取该 geometry **全部坐标点的经纬度包围盒中心** `((minLon+maxLon)/2, (minLat+maxLat)/2)` 作为 (lat, lon)（`Point` 为其单点退化情形）。该降维为可视化落点近似、不追求面积质心；跨 ±180° 经线的多边形（EONET 极罕见）落点可能偏移，属已知限界，如需可后续另行提案精化。categories[0].title 进 summary；sources[].url 为信源。severity 默认 2。

应用后 EONET 归一化坐标对任意 geometry 类型都落在合法范围（包围盒中心必在坐标点凸包内，纬度∈[-90,90]），检查点 2 可对 fixture 精确断言坐标。

---

## 3. G-2/G-3 次序仲裁 + 未裁期间 dev 安全范围

### 3.1 arch 提议次序：**成立**

arch 提议（DP §6）：G-2（GDACS 字段来源）/G-3（LL2 字段来源 + list 模式是否含工位坐标）先派 qa/dev **抓真实 fixture** → arch 依实测提 spec 映射提案 → rev 仲裁 → orch pin → dev 实现精确映射。

裁定成立，依据：
- G-2/G-3 是**字段来源**问题（哪个原始字段 → title/summary/urls/lat/lon），无法在抽象层裁——取决于 GDACS/LL2 真实响应形状。无 fixture 直接裁 = 猜测，猜错即产生新的上游契约不符缺陷（CLAUDE.md §5.3.5）。
- CLAUDE.md §7 明定「上游 API 响应样本存 tests/fixtures/，是 provider 单测的事实依据」——抓 fixture 是任何事实性映射提案的前置。
- 该次序即 §7 的 spec 修改路径（登记/提案 → rev 仲裁 → orch 应用+pin），以 fixture 为证据输入，完全合规。

**约束**：抓 fixture 仅是捕获原始响应（可用 curl/node 服务端抓取，头注抓取时间，不需 spec），**可立即派单**；但 dev **不得**在 pin 前实现 gdacs.ts/ll2.ts 的字段映射，也不得在 DP/代码里自定义 SPEC-5.3/5.5 未给的字段来源（DP §2.1/§6 已如此约束）。

### 3.2 未裁期间 dev 可先行的安全范围

**可先行（不被 G-2/G-3 阻塞）**：
- `types.ts` / `store.ts`（去重/清扫/快照/订阅）/ `http.ts`（conditionalFetch）/ `scheduler.ts`（排程/退避/隔离）/ `cache.ts`（IndexedDB）/ `index.ts`（装配 createDataLayer）——均源无关基础设施，无字段来源依赖。
- `providers/usgs.ts`：SPEC-5.1 已完整给出 id/title/lat/lon/ts/url/severity，无缺口，可全实现。
- `providers/eonet.ts`：**G-1 经本记录即裁**；待 orch 应用+pin 后即完整可实现，不再有坐标缺口。（在 G-1 pin 前，eonet 的非 Point 坐标未定，dev 不应终稿 eonet normalize——故 eonet 实现以 G-1 应用为前置，本仲裁已扫清，orch 应用即解锁。）
- `providers/index.ts`：`T1_PROVIDERS` 先注册 usgs、eonet 两源；gdacs/ll2 待其 normalize 落地后追加。

**须待 pin 后（G-2/G-3 阻塞）**：
- `providers/gdacs.ts`、`providers/ll2.ts` 的 **normalize 字段映射**——待 arch 依 fixture 提案、rev 仲裁、orch pin 后 dev 才实现精确映射。其间 dev/qa 可先抓这两源 fixture（含 §4 的 GDACS CORS 实测）。

此范围与 DP §6 建议一致（USGS/EONET 主干 + store/scheduler/cache 不被阻塞），予以确认。

---

## 4. CORS 风险处理路径（DP §4.4）：口径**成立**，附 2 条补充

DP §4.4 口径：实测某源无 `Access-Control-Allow-Origin` → 按 SPEC-5.0 优雅退避降级、不拖垮其余源与渲染 → 登记 bugs.md → rev 仲裁（web 端可行性 vs 推迟到原生 M6），不加代理、不硬绕。

**成立**，依据：
- 对齐 SPEC-9（阶段一零服务器，禁代理）——DP 正确禁止加代理绕 CORS。
- 对齐 SPEC-5.9 先例——web 端仅支持 CORS 开放的源，受限者推迟原生端（Capacitor 不受 CORS）。CORS 封死某源属同类，仲裁轴（web 可行 vs 推迟原生）与 5.9 一致。
- 对齐 CLAUDE.md §5.3.5——上游契约（源在 web 不可直连）与 SPEC-5.x「该源可直接 fetch」的隐含假设冲突，属 spec 邻接缺陷，走 bugs 登记 + rev 仲裁。
- 对齐 SPEC-5.0 故障隔离——CORS 失败即 fetch 拒绝，被本源轮询循环捕获、退避，不冒泡（DP §4.4/§2.2 已述），DEV 无需为此写特例代码。

**补充约束 C-1（防判据蒸发）**：若仲裁结论为「推迟到原生」，orch 须把该源的 SPEC 条目 + FM 行 + testplan 归属**改挂 M6/FM-25 一类原生里程碑**，不得只从 M2 删除。否则 SPEC-5.3/5.5 子句会因无里程碑认领而静默蒸发（CLAUDE.md §5.2 反复警示的失效模式，参照 BUG-014）。

**补充约束 C-2（CORS 实测 ≠ fixture 抓取）**：CORS 只影响**浏览器 fetch**；curl/node 服务端抓 fixture 即便成功也**不证明** web 可行。故 §3.1 的 fixture 抓取（可服务端）与 CORS 实测**是两件事**：CORS 可行性须在浏览器上下文验证（dev server 或一条 e2e fetch）。派单时须写明「抓到 fixture」不等于「web 直连可用」，避免误判。GDACS 尤须此浏览器侧实测（DP §4.4 已点名 GDACS）。

---

## 5. 交 orch 的整改 / 登记项汇总

| # | 项 | 性质 | 处置 |
| --- | --- | --- | --- |
| F-1 | testplan **M2-02 的 flight/opensky-60s 子句**与 DP（正确）把 flight 推迟 M3 冲突，M2 范围内不可满足 | testplan 越界（须 orch 整改） | **须先于把 M2-02 派给 QA 前解决**：登记缺陷，把该子句改挂 M3/FM-12 或 M4/FM-17，确保 SPEC-6.3①「flight 60s 不变」有 M3+ 实际场景承接（§5.2，不蒸发）。见 §1.4 |
| C-1 | CORS 仲裁若「推迟原生」，须改挂 SPEC/FM/testplan 至 M6，不得删除 | 防判据蒸发（预置约束） | 记入 CORS 相关 bug 的仲裁处置口径。见 §4 |
| C-2 | CORS 实测须走浏览器上下文，区别于服务端 fixture 抓取 | 派单口径 | 抓 GDACS/LL2 fixture 的卡须附浏览器侧 CORS 实测要求。见 §4 |
| O-1 | DP §2.3/§3.3「及其余可变字段」措辞可收紧至 SPEC-6.3 三字段契约 | 非阻塞（DP 措辞） | 可让 arch 顺手改 DP，非派 dev 前置。见 §1.1 |
| O-2 | §5.2 检查点 5「lon∈(-180,180]」无 spec 依据 pin 边界约定 | 非阻塞（QA 断言提示） | QA 按 SPEC-6.1 断言（有限实数/纬度∈[-90,90]），不擅自 pin lon 半开区间。见 §1.4 |
| G-1 | EONET 降维 spec 修订文本已给出 | 须应用 | orch 依 §2 应用 SPEC-5.2 + §0 修改记录 + `make pin-spec` + 同步 testplan M2-01/检查点 2，即解锁 eonet 实现 |

---

## 6. 总结论

**门禁通过，可据此 DP 派 dev。** DP 四项门禁全部通过：无行为泄漏、无 M2 范围外过度设计、spec 锚点完备、与 testplan M2-01/03/04 一致且无「替 QA 写断言」。

派单须带以下前置/约束：
1. **orch 先应用 G-1**（§2 的 SPEC-5.2 修订文本 + 修改记录 + pin + 同步 testplan）——应用后 eonet 主干解锁；未应用前 dev 可先做 §3.2 的其余安全范围（types/store/http/scheduler/cache/index/usgs），eonet normalize 待 G-1 pin。
2. **G-2/G-3 走 §3.1 次序**：抓 fixture（可立即派）→ arch 提案 → rev 仲裁 → orch pin → dev 实现 gdacs/ll2 精确映射；未裁期间不得实现这两源字段映射。
3. **F-1 须先于把 M2-02 派给 QA 前解决**（§5），否则 M2-02 在 DP 范围内不可满足。
4. **CORS** 按 DP §4.4 口径 + §4 的 C-1/C-2 补充执行。

以上均为台账/派单顺序动作，不要求改 DP 正文（O-1 可由 arch 顺手收紧，非阻塞）。
