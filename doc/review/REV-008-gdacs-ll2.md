# REV-008 — G-2(GDACS)/G-3(LL2) 字段映射提案仲裁

- 日期：2026-07-21　审查员：rev（独立实例，未参与 proposal-gdacs-ll2.md 的 arch 撰写）
- 审查对象：`doc/design-prompt/proposal-gdacs-ll2.md`（SPEC-5.3/5.5 修改提案，arch 依 fixture 实证起草）
- 触发：REV-007 §3 裁定次序第三步（fixture 入库 → arch 依实测提案 → rev 仲裁）
- 判据出处（均独立读原始材料，不采信提案转述，用 node 逐字段探查未整读大文件）：
  - `doc/spec.md` SPEC-5.0/5.1/5.2/5.3/5.5、SPEC-6.1/6.2/6.3
  - `doc/review/REV-007-M2-data-gate.md` §2/§3（G-1 降维同法、G-2/G-3 裁定次序）
  - 事实依据：`tests/fixtures/gdacs_eventlist.json`、`ll2_upcoming.json`、`ll2_upcoming_detailed.json`（提案交付后新抓，2026-07-20T14:38:00Z）、`tests/fixtures/README.md`
  - `doc/design-prompt/M2-data.md` §2.2/§2.4/§4.4/§6、`src/data/store.ts`、`src/data/providers/eonet.ts`、`src/data/providers/index.ts`
  - `doc/product-decisions.md` D1/D3/D13、`doc/testplan.md` M2-01~04

## 结论速览

| 项 | 结论 |
| --- | --- |
| G-2 GDACS [实证] 核验 | **全部复核通过**。25 事件、要素分布、字段路径、跨要素一致性、htmldescription 无 HTML、glide 稀疏、datemodified 无时区后缀均逐条实测吻合。 |
| G-3 LL2 list [实证] 核验 | **通过**。list 模式无工位坐标（pad/location 皆纯字符串），id/name/net/url 齐全，net 含 Z。 |
| G-3 LL2 detailed [推测]→[实证] | **升级成立**。新 detailed fixture 实测：pad.latitude/longitude 10/10 可解析、mission.description 10/10 非空、infoURLs/vidURLs 存在于 result 顶层（5/10 两者皆空 → 回落 url 被真实触发）。SPEC-5.5 坐标条款前置补抓已满足，可直接 pin。 |
| 裁决① humanitarian 判类 | **取方案 A**：`eventtype ∈ {DR,FL} → humanitarian`，其余 → disaster。 |
| 裁决② LL2 换 mode=detailed | **成立**。预算论证复核通过（请求数不变、2 req/h ≤ 15）。 |
| 裁决③ R-1 过期窗交互 | **不静默**：ts=datemodified 本身正确、批准；但根因（清扫按事件 ts）已在 EONET **live 显现**（24/26 open 事件首轮即被误清），登记 **BUG-018**，仲裁倾向 Design Y（按最后见到时刻续期）。**不阻塞** GDACS/LL2 pin。 |
| **总结论** | **放行**。orch 按 §5 修订文本应用 SPEC-5.3/5.5 + §0 修改记录 + pin + 同步 testplan/§2.2；R-1 走 BUG-018 独立 spec 修改路径。 |

---

## 1. G-2 GDACS [实证] 核验（逐条复跑 node 探查）

对 `gdacs_eventlist.json`（634344 B，抓取 2026-07-20T14:19:20Z）独立探查，提案 §0/§1 的每条 [实证] 标注复核结果：

| 提案 [实证] 断言 | 独立实测 | 判定 |
| --- | --- | --- |
| 顶层 FeatureCollection，165 要素 | type=FeatureCollection，features=165 | ✔ |
| 要素类型 Point 44 / Polygon 70 / LineString 51 | 完全一致 | ✔ |
| 25 distinct eventid | Object.keys(byId)=25 | ✔ |
| eventtype（distinct 事件）TC 3 / DR 11 / FL 4 / EQ 7 | 完全一致（DR+FL=15，EQ+TC=10） | ✔ |
| alertlevel 仅 Green 157 / Orange 8，无 Red | 完全一致 | ✔ |
| 每个 eventid 必有 ≥1 Point 中心点 | events with 0 Point=0；Point 数分布 {1:10, 2:11, 3:4}（即 15 事件多中心点） | ✔ |
| 同 eventid 各要素 name/alertlevel/url.report/datemodified 一致 | 逐要素比对 0/165 不一致 | ✔ |
| 字段路径 name/htmldescription/url.report/datemodified/Point coordinates | 抽样 Point 要素：name="Flood in United States"、htmldescription="Green Flood in United States from…"、url.report="report.aspx?eventid=…"、datemodified="2026-07-19T07:50:29"、geometry.coordinates=[-111.54,38.34]（[lon,lat]）、Class="Point_Centroid" | ✔ |
| htmldescription 为纯文本无 HTML 标签 | 165/165 非空、0/165 含标签 | ✔ |
| glide 仅 5 distinct 事件非空、全为 DR | 5 事件非空，eventtype 全部 DR（FL 全空） | ✔ |
| datemodified 无时区后缀（UTC） | 格式 "YYYY-MM-DDThh:mm:ss" 无 Z，须显式按 UTC 解析 | ✔ |

**坐标规则复核**：抽 1 个 3-Point 事件（1103888 US 洪水），三点 [lon,lat] 经纬度包围盒中心 = (-104.62, 35.67)，落在美国本土、纬度∈[-90,90]、与要素顺序无关。规则确定、可机械断言、与 SPEC-5.2（G-1）包围盒中心同法。**批准**。

**结论**：G-2 全部 [实证] 标注属实，无一处夸大或误标。

## 2. G-3 LL2 [实证] 核验 + [推测] 升级

**list 模式**（`ll2_upcoming.json`，9822 B）复核：count=363、10 results；`pad`/`location` 10/10 为纯字符串（如 "Space Launch Complex 4E" / "Vandenberg SFB, CA, USA"），**无 latitude/longitude 数值**；id/name/net/url 10/10 齐全；net 10/10 含 Z。→ 提案「list 模式不含工位坐标」为实证，成立。

**detailed 模式**（`ll2_upcoming_detailed.json`，154831 B，新抓 2026-07-20T14:38:00Z）——把提案 §3 的 [推测] 逐条实测升级：

| 提案 [推测] 字段 | detailed 实测 | 升级判定 |
| --- | --- | --- |
| `pad.latitude` / `pad.longitude` | pad 10/10 为对象，含 latitude/longitude 字符串（如 "34.632"/"-120.611"=Vandenberg），10/10 parseFloat 可解析为有限数 | **[推测]→[实证]** |
| summary=`mission.description` | mission 10/10 为对象，description 10/10 非空（如 "A batch of 24 satellites for the Starlink mega-constellation…"） | **[推测]→[实证]** |
| urls=`infoURLs[].url` ∪ `vidURLs[].url`，皆空回落 `url` | infoURLs/vidURLs 存在于 result **顶层**；infoURLs 非空 5/10、vidURLs 非空 5/10、**两者皆空 5/10** → 回落 `url`（10/10 存在）在半数样本被真实触发，urls≥1 得以保证 | **[推测]→[实证]，且回落分支为必需（非理论）** |
| ts=`net` | 10/10 存在含 Z；net_precision 分布 Second 1 / Minute 5 / Hour 4，但均为具体时间戳，severity 计算无碍 | ✔ |

**重要结论**：提案 §3.4「前置：qa 补抓 mode=detailed fixture 确认坐标字段后 pin」的前置条件 **现已满足**——detailed fixture 已入库并逐字段确证，SPEC-5.5 坐标/summary/urls 条款可**立即 pin**，无需再补抓。§4 遗留项「detailed 出现 net 为空则需 ts 回落」在本样本 10/10 有 net，未触发，保留为限界。

## 3. 裁决① — humanitarian 判类（取方案 A）

**背景**：SPEC-5.3 原文「事件类型含 DR/FL 且带人道响应字段时」→ humanitarian。经实测，GDACS `geteventlist/MAP` 响应中**无任何「人道响应」字段**（可用分类字段仅 eventtype/alertlevel/glide/severitydata，无一承载「是否触发人道响应」语义）——原 AND 条件的第二个从句**指向一个不存在的字段**，不可实现。此为 CLAUDE.md §5.3.5「上游 API 行为与 spec 不符 → spec 缺陷」，须重写规则；重写非 §5.2 禁止的「判据向实现看齐」（后者是下调强度以迁就实现，此处是 spec 建立在一个被证伪的字段假设上，被迫重写）。选定 A、B、C 之一即为**新判类规则**。

**裁决：取方案 A（`eventtype ∈ {DR,FL} → humanitarian`，其余 → disaster）**。理由：

1. **最少假设、无自造维度**：A 只用 SPEC-5.3 已显式点名的 DR/FL 枚举，不引入 spec 外的新判据。B（glide 非空）与 C（alertlevel≠Green）都要引入一个 GDACS **未以「响应」语义背书**的二级闸门——glide 是 ADRC 灾害编号（存在性 ≠ 人道响应）、alertlevel≠Green 是自造阈值——二者都等于在 spec 外私定规则，正是 CLAUDE.md §7/行为泄漏禁区所防。
2. **不让 SPEC-5.3 的 FL 从句蒸发**：实测 glide 5 个非空事件**全为 DR、FL 全空**，alertlevel≠Green 的 DR/FL 在样本内也**全为 DR**——B/C 都让样本内 **FL 永不为 humanitarian**，与 SPEC-5.3「DR/FL」并列枚举直接相悖（§5.2 禁止子句蒸发）。A 使 DR 与 FL 对称落 humanitarian，忠实枚举。
3. **确定、可机械断言**：eventtype 100% 存在，QA 可对 fixture 精确断言（DR/FL 15 事件 → humanitarian、EQ/TC 10 事件 → disaster），无凭空阈值、跨轮询稳定。
4. **产品语境（D1/D3）支持宁宽**：GDACS 的 humanitarian 归类是它相对 EONET（SPEC-5.2 全归 disaster）的**独立价值**——DR/FL（干旱/洪水）正是最与人道危机关联的慢发事件类型，而 EQ/TC 与 EONET 的 disaster 语义对齐。取 A 使 humanitarian 类目有实质内容（15/25）；取 C 则 GDACS 22/25 归 disaster、与 EONET 高度冗余、humanitarian 近乎空置，削弱 GDACS 单列一源的理由。D3「宁静」不受实质影响——球面标记数由 USGS 地震主导，15 vs 3~5 的差异不改变基调。

**代价**（拍板留痕）：A 相对原「且带人道响应字段」放宽了边界——Green（轻微）DR/FL 也入 humanitarian。此为已知取向（宁宽 vs 宁窄）；鉴于「响应字段」不可实现，宁宽的类型判类是最少假设的确定规则，接受此代价。

**限界留痕**：severity Red→3 分支样本无实证（仅 Green/Orange），映射为 SPEC-5.3 既定值保留、不因无实证而删（QA 对 fixture 只能断言 1/2，Red 属规则外推）；样本外 eventtype（VO/WF 等）由「非 {DR,FL}→disaster」天然覆盖，无缺口。

## 4. 裁决② — LL2 换 mode=detailed（成立）

**预算论证复核**：
- `mode=detailed` = 同一 upcoming 端点、同 limit=10、仅 mode 参数变，**仍 1 请求/轮**。轮询 1800s = 2 请求/h ≤ 免费额 15 req/h。**闸门内**。
- 响应体：list 9822 B → detailed 154831 B（约 15.8 倍），**请求数不变**；LL2 限流按请求数非字节数，预算不受体积影响。
- detailed 是**唯一**能拿到工位坐标的路径（list 实测无坐标），且一并给出更优 summary（mission.description）与人读 urls（infoURLs/vidURLs）。
- 提案对方案②（list+逐发射二级请求，22 req/h > 15，爆预算）、方案③（本地 gazetteer，越 M3 T2 边界、违 T1 自带坐标源定义）的驳回**成立**。

**裁定成立**，SPEC-5.5 端点参数由 `mode=list` 改 `mode=detailed`。

## 5. 裁决③ — R-1 过期窗交互（不静默；登记 BUG-018；倾向 Design Y；不阻塞 pin）

**提案 R-1 原述**：GDACS ts 取 datemodified（而非 fromdate，否则 5 月起的干旱一入库即超窗），当前样本内 current 事件 datemodified 均在窗内可存活；残留边界=iscurrent 但久未 modify（datemodified>72h）的稳定事件会被 sweepExpired 清掉。提案将此交 rev、未擅自扩 SPEC-6.3。

**独立核验（本 rev 的加值发现——R-1 比提案框定的更严重）**：

- 读 `src/data/store.ts`：`isExpired(ev, now) = now - ev.ts > expiryMs`（DEFAULT_EXPIRY_MS=72h）——**清扫按事件 ts 判定（Design X）**。
- 读 `src/data/providers/eonet.ts` 第 104 行：`ts = Date.parse(latest.date)`（最新 geometry 日期）；`index.ts`：eonetProvider **已 live 注册**。
- 探查 `eonet_events.json`（status=open&days=7，26 条全 open）：**24/26 的最新 geometry 日期距抓取时刻已超 72h**（野火最旧 171h）。→ 归一化后灌入 EventStore(72h)，**首轮 sweepExpired 即删除 24 条**，EONET 对真实数据**近乎全失**。
- 机制（闪烁）：源每轮仍返回长寿命事件 → upsertMany 以其陈旧 ts 重写 → sweepExpired 因 now-ts 超窗删除 → 下轮再现-再删；稳定态用户看不到该事件，且每轮两次 notify 触发 FM-09 呼吸过渡的「亮起-熄灭」视觉闪烁。
- 潜伏原因：M2-01（eonet 归一化+清扫真龄交互）尚 🔲，M2-02 用合成事件不含真实年龄，故 M2-02 ✅ 未覆盖此路径、缺陷未被发现。
- GDACS 同根因：ts=datemodified，样本内最旧 47.4h 未触发，但生产中持续数月的干旱/洪水一旦 datemodified 超 72h 未刷新即被误清。

**根因定性**：SPEC-6.3①「48–72h **无更新**移除」语义歧义——「无更新」指 (a) 事件 ts 未推进（现实现 Design X），还是 (b) 事件未再被源返回/未再 upsert（按最后见到时刻续期，Design Y）。

**裁决**：
1. **ts=datemodified（GDACS）批准、保持不变**。它是 GDACS 最优事件时间戳；fromdate 更差（慢发事件一入库即超窗），无更优字段。改 ts 无益且更差 → R-1 **不是 GDACS 字段映射问题**，是 store 清扫语义问题。
2. **不在本次 pin 内改 SPEC-6.3**（外科手术式：GDACS/LL2 字段映射 pin 与 SPEC-6.3 清扫语义是两个决策，不捆绑）。**不静默** → 登记 **BUG-018**（spec 契约 SPEC-6.3 过期语义 + store），走 §7 独立 spec 修改路径。
3. **仲裁倾向 Design Y**（清扫按最后 upsert 墙钟时刻续期；事件仍在源内则每轮续期不过期；ts 仍保留事件时间用于展示/排序）。理由：一个源持续返回的事件显然仍活跃，因其 ts 陈旧而清掉它、同时源还在返回，产生误清与闪烁；「无更新移除」的自然读法应是「源不再返回/不再被 upsert」。最终 SPEC-6.3 语义澄清由 BUG-018 的 arch 提案 → rev 仲裁定案，并须新增一条真实年龄场景（eonet fixture 全 open 事件经一轮清扫仍在快照内）+ 复测 M2-02。
4. **不阻塞本次 GDACS/LL2 pin 与 dev 实现**——ts=datemodified 独立正确、清扫缺陷正交（在 store、独立影响 EONET）、本次 fixture 内 GDACS 未触发。但 **BUG-018 应在 M2 签核前解决**：EONET 为 M2 源，带此缺陷对真实数据近乎不可用（签核抽查须留意）。

---

## 6. 可直接应用的修订文本（orch 依 CLAUDE.md §7 应用 + §0 修改记录 + `make pin-spec` + 同步 testplan）

### 6.1 SPEC-5.3 全文（替换现行）

> - **SPEC-5.3 GDACS 灾害/人道** → category `disaster` 或 `humanitarian`
>   - `https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP`，轮询 300s。响应为 GeoJSON FeatureCollection；**同一 `eventid` 出现多条要素**（1 条 `geometry.type='Point'` 中心点 + 若干 Polygon 影响区 / LineString 路径）。归一化按 `eventid` 分组，每组产出一个事件（去重键 `gdacs:{eventid}` 亦合并同 eventid 的多要素）。
>   - 坐标：取该 eventid **全部 `geometry.type='Point'` 中心点要素**坐标的经纬度包围盒中心 `((minLon+maxLon)/2,(minLat+maxLat)/2)`（单点退化为该点本身）；Polygon/LineString 要素仅为几何细节，不单独成事件、不参与取坐标。
>   - 字段（事件级字段跨同 eventid 各要素一致，取该 eventid 的 Point 中心点要素 `properties`）：`id=gdacs:{eventid}`；title=`name`；summary=`htmldescription`（纯文本，无 HTML 标签）；urls=`[url.report]`；ts=`datemodified`——**GDACS 时间戳为 UTC 且无时区后缀，归一化须显式按 UTC 解析（补 `Z` 或等价），不得依赖 `Date.parse` 的本地时区解释**。
>   - severity：`alertlevel` Green/Orange/Red → 1/2/3。
>   - category：`eventtype ∈ {DR, FL}` → `humanitarian`，其余（EQ/TC/…）→ `disaster`。

### 6.2 SPEC-5.5 全文（替换现行）

> - **SPEC-5.5 Launch Library 2 火箭发射** → category `launch`（M2：属 T1 自带坐标源，随首批 provider 接入）
>   - `https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=10&mode=detailed`，轮询 1800s（免费额 15 req/h，预算 ≤2 req/h；`mode=detailed` 仅增大单响应体，请求数不变仍 2 req/h）。改用 `mode=detailed` 因 `mode=list` 响应不含发射工位坐标。
>   - 字段映射：`id=ll2:{results[].id}`；坐标取发射工位 `pad.latitude`/`pad.longitude`（字符串数值，parse 为 number）；title=`name`；summary=`mission.description`；urls 取 `infoURLs[].url` ∪ `vidURLs[].url`，二者皆空时回落自链 `url`（保证 urls≥1）；ts=`net`（T-0，ISO 含 `Z`，`Date.parse` 直接得 UTC）。
>   - severity：以 `net` 相对当前时刻，T-1h 内 3，T-24h 内 2，其余 1。

### 6.3 SPEC-6.3

**本次 pin 不改 SPEC-6.3**（裁决③：清扫语义走 BUG-018 独立路径，不捆绑本次字段映射 pin）。BUG-018 定案后另行修订 SPEC-6.3① 的「无更新」语义（倾向 Design Y：按最后见到时刻续期）。

### 6.4 M2-data.md §2.2 同步改法（一句话）

- 将 §2.2 第 36 行「LL2 走 `mode=list`、limit=10、1800s（SPEC-5.5）」改为「LL2 走 `mode=detailed`、limit=10、1800s（SPEC-5.5）」。
- 附带留痕（非本任务必需，orch 可顺手）：§4.4/§6 关于「LL2 mode=list 是否含坐标」的 G-3 待提案项已由本 REV-008 裁决闭合，可标注为「已裁决，见 REV-008」，避免 DP 与 spec 分叉。

### 6.5 testplan 同步

- **M2-01**：GDACS/LL2 从「按 SPEC-6.1 结构不变量断言」升级为可精确断言字段来源值——GDACS：25 事件、DR/FL 15→humanitarian、EQ/TC 10→disaster、坐标落 Point 中心点包围盒中心、title=name、summary=htmldescription、ts=datemodified（UTC 解析）；LL2：id/坐标=pad.lat/lon、T-24h/T-1h severity 边界、summary=mission.description、urls 回落。QA 断言引用 SPEC-5.3/5.5 条目号，从 spec 推导、不照抄实现。
- 无既有 ✅ 场景被本次 pin 推翻（gdacs/ll2 尚未实现；M2-01 为 🔲）。**注意**：BUG-018 的清扫语义修复将新增一条真实年龄清扫场景并复测 M2-02（不属本次 pin）。

---

## 7. 总结论

**放行**。提案 [实证] 标注逐条属实、detailed [推测] 已升级为实证、三项裁决已定（① 方案 A / ② detailed 成立 / ③ R-1 登记 BUG-018 倾向 Design Y 且不阻塞 pin）。orch 可按 §6 修订文本应用 SPEC-5.3/5.5 + §0 修改记录 + `make pin-spec` + 同步 testplan M2-01 与 M2-data.md §2.2，pin 后即可派 dev 实现 gdacs.ts/ll2.ts 精确映射、qa 依 SPEC-5.3/5.5 精确断言。

**须并行推进（不阻塞本 pin，但影响 M2 签核）**：BUG-018 走 §7 独立路径修复 SPEC-6.3 清扫语义——EONET 已 live 且带此缺陷对真实数据近乎不可用，建议在 M2 签核前闭合。

签名：rev（独立实例）　2026-07-21
