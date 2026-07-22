# spec 修改提案 — R2「加密行情 ticker 处死」（D31 蜕变论 per-R 批②）

> arch 起草，**提案性质，未改任何正式文档**。经 rev 仲裁后由 orch 应用：**删 SPEC-2.1 ticker 句** + **整条删除 SPEC-5.7** + **scrub SPEC-5.10 两处 CoinGecko 残留** + **§9 追加后置候选注记** + §0 修改记录 + `make pin-spec` + 同步 feature-matrix（FM-12 删 CoinGecko / FM-14 删「2.1-ticker」锚点）+ testplan 涟漪核对（M2-18 注释 scrub，qa 执行；本批**无新增场景**）。
>
> 触发：`doc/product-decisions.md` **八、D31 R2**（加密行情 ticker 处死，用户 2026-07-22 已确认删除而非后置）+ `doc/product-vision.md` 论纲六「地理是唯一的语法」（line 70）/ §6 R2（line 138）。**非 BUG-ID 触发。**
>
> 本卡 = REV-018 §6.3 排期 **②R2（可并行①）**，落实 §6.3 第 2 项 + §6.4 **F-1 第二处** scrub 清单。**论纲六首次执法**——清空默认球面之外唯一的非地理器官（ticker）。
>
> 依据源（只读，未整读入上下文）：
> - `doc/spec.md`（pin v0.3.2）：SPEC-2.1（line 37）、SPEC-5.7（line 161–162）、SPEC-5.10（line 171 / 185）、§9（line 235–242）、及交叉引用面 SPEC-1（line 27）/SPEC-6.1 `source` 枚举（line 203）
> - `doc/product-vision.md` 论纲六（line 70）、§6 R2（line 138）；`doc/product-decisions.md` D31 R2
> - `doc/review/REV-018-roadmap-m3-watch-arbitration.md`：§6.3 第 2 项、§6.4 F-1、§1.1（②CoinGecko 真删除 + 两处孤儿定位）
> - `doc/feature-matrix.md`：FM-12（扩展信源）、FM-14（详情卡+搜索）
> - `doc/design-prompt/proposal-r1-r10-identity.md`（批①，SPEC-1「加密行情」枚举项由其 F-1 第一处吸收，本卡不重复删）
> - 提案范式：`doc/design-prompt/proposal-trust-tier.md`

---

## 0. scope 与硬边界（本卡只做 ticker 处死的 scrub）

**只删 ticker（CoinGecko 非地理器官）及其残留交叉引用**，逐项落 REV-018 §6.3 第 2 项 + §6.4 F-1 第二处的 scrub 清单：

| # | scrub 对象 | spec/FM 位置 | 归属 |
| --- | --- | --- | --- |
| 1 | SPEC-2.1 顶栏「加密行情 ticker」句 | spec line 37 | 本卡 §1.1 |
| 2 | SPEC-5.7 CoinGecko 行情源整条 | spec line 161–162 | 本卡 §1.2 |
| 3a | SPEC-5.10「CoinGecko…不入本表」注 | spec line 185 | 本卡 §1.3 |
| 3b | SPEC-5.10「权威事件源」举例「行情聚合」（**F-1 第二处**） | spec line 171 | 本卡 §1.3 |
| 4 | §9 追加「市场/公司信号须地理形态、后置候选不立项」注记 | spec §9（line 235–242） | 本卡 §1.4 |
| 5 | FM-12 删 CoinGecko 部分 / FM-14 删「2.1-ticker」锚点 | FM line 20 / 22 | 本卡 §2 |

**不碰（各归其批）**：
- **SPEC-1 line 27「…外加火箭发射、航班动态、加密行情」的「加密行情」枚举项**——F-1 第一处，属**批① R1**（`proposal-r1-r10-identity.md` §1.6 显式删「、加密行情」，改「…外加火箭发射、航班动态。」）。本卡不重复删该处。
- **GDELT / FM-12 GDELT 部分 / FM-13**——批⑤ R4（GDELT 改挂 M4、SPEC-5.4 定位）。本卡删 FM-12 的 CoinGecko 部分时，**GDELT 部分与 FM-12 里程碑（现 M3）原样保留**，不代 R4 改挂。
- **watchlist（R7 批③）、面板/安好态（R3/R5 批④）**。
- **§0 修改记录（line 21 等）中 CoinGecko/ticker 的历史提及**——追加式历史，**不 scrub**（REV-018 §1.1 line 41）。

---

## 1. SPEC 修订文本（现行 / 建议 / 理由）

### 1.1 SPEC-2.1 顶栏——删「加密行情 ticker」句

**现行**（spec line 37）：

> - **SPEC-2.1** 顶栏（48px）：品牌名「**Worlens**」（M2）· 加密行情 ticker（M3，SPEC-5.7）· **UTC 时钟（M2，实时刷新，格式 HH:MM:SS UTC）**。

**建议**：

> - **SPEC-2.1** 顶栏（48px）：品牌名「**Worlens**」（M2）· **UTC 时钟（M2，实时刷新，格式 HH:MM:SS UTC）**。

**理由**：删除中缀「· 加密行情 ticker（M3，SPEC-5.7）」，顶栏保留品牌名 + UTC 时钟两项（M2 均已实现，M2-18 ✅）。ticker 是默认球面之外唯一的非地理器官，其死为论纲六「地理是唯一的语法」首次执法（D31 R2）。同时移除对 SPEC-5.7 的交叉引用（该条整条删除，见 §1.2）。

### 1.2 SPEC-5.7 CoinGecko 行情源——整条删除

**现行**（spec line 161–162）：

> - **SPEC-5.7 CoinGecko 行情 ticker**（非地理事件，只进顶栏）
>   - `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true`，轮询 60s；币种清单 M4 起可配置。

**建议**：整条删除（**无承接行**）。

**理由**：CoinGecko 是「非地理事件、只进顶栏」的独立契约，与 ticker 同生共死。**真删除**（契约整体移除、非后置留承接行）——删除后该 spec 子句本身不存在，无「掉出全部场景」问题（区别于 GDELT/T2 后置须保留 FM 承接行，REV-018 §1.1①②）。孤儿核验见 §3：SPEC-6.1 `source` 枚举本不含 `coingecko`（非 GeoEvent），无该侧悬空。删除后 SPEC-5.8/5.9/5.10 自动上移编号相邻，**其余 SPEC-5.x 编号不变**（保持 pin 稳定，无需重排编号）。

### 1.3 SPEC-5.10 信任分级——scrub 两处 CoinGecko 残留

**3a — 现行**（spec line 185，末条 bullet）：

> - CoinGecko 行情 ticker（SPEC-5.7）非 GeoEvent（仅顶栏），不入本表；未来自定义 RSS 信源（SPEC-5.9，M6）一律归「新闻报道（待验证）」，显示名取 feed 标题。

**3a — 建议**：

> - 未来自定义 RSS 信源（SPEC-5.9，M6）一律归「新闻报道（待验证）」，显示名取 feed 标题。

**3a — 理由**：CoinGecko 与 SPEC-5.7 已删（§1.2），「CoinGecko…不入本表」注失去指称对象，成孤儿——scrub 前半句；保留后半句 RSS 前向兼容契约（与 CoinGecko 无关，不动）。

---

**3b — 现行**（spec line 171，**F-1 第二处**，REV-018 §1.1/§6.4）：

> - **权威事件源**：信源本身即事件的系统级记录（传感网/官方机构/发射登记/航迹遥测/行情聚合）。

**3b — 建议**：

> - **权威事件源**：信源本身即事件的系统级记录（传感网/官方机构/发射登记/航迹遥测）。

**3b — 理由**：括号内五个举例中「行情聚合」唯一挂靠 CoinGecko；ticker 处死后成残留举例（REV-018 F-1 第二处点名）。scrub「/行情聚合」。**其余四例均有活源承接、不动**：传感网（USGS/EONET/GDACS 传感/监测网）、官方机构（GDACS 官方灾害机构）、发射登记（LL2）、航迹遥测（OpenSky ADS-B，M6/FM-27 仍在产品范围、SPEC-5.10 表内 `opensky` 权威分级不变）。

### 1.4 §9 非目标——追加市场/公司信号后置候选注记

**现行**（spec §9，line 235–242，ACLED 条为体例参照）：

> - ACLED 冲突专库需注册，默认不接（冲突类由 GDELT 判类兜底）；接入作为可选增强另行提案。

**建议**（在 §9 新增一条 bullet，建议置于 ACLED 条之后——同为「数据源类后置候选，另行提案」体例）：

> - **加密行情 ticker（原 SPEC-5.7）已删除**（论纲六「地理是唯一的语法」首次执法，D31 R2）：凡不能落在地表的信号不呈现于表上。**市场/公司类信号未来若做，须以地理事件形态存在**——如公司事件亮在其总部所在地，产品把信号放回其发生地、**不替用户解读**；列为**后置候选源、暂不立项**，届时另起 spec 提案（比照 ACLED「可选增强另行提案」口径）。此为「**改地理形态后置**」而非「永绝」——与 R10 产品宪法（§9「永不引入」清单：无限滚动/算法推荐流/停留时长优化/红点角标/BREAKING 横幅/假实时感）的**永久禁入**性质不同。（市场信号的 AI 聚类/消化仍归付费阶段二，SPEC-8.5、本节 AI 后置条。）

**理由**：
1. **兑现 D31 R2 + 论纲六**：明示 ticker 之死是「语法执法」（删非地理器官），非砍功能。
2. **措辞区分「后置」与「永绝」（任务硬要求）**：市场信号本身**未被永久禁入**（论纲六「假想 Anthropic 上市…你会看到旧金山亮起一根光柱」正是市场信号的地理化未来形态）；被处死的只是 **ticker 这一非地理形态**。故用「后置候选源、暂不立项」+「改地理形态后置」，并**显式对照 R10 永久禁入清单**以防被误读为「删了就永不做」。
3. **§9 自承接、无 FM 行、非蒸发**：本注记比照 §9 ACLED 条（后置候选源，无 FM 行，§9 内自登记）——§9 即其承接位，不需 feature-matrix 行、不触 §5.2 蒸发（区别于有编号 SPEC 子句的后置须留 FM 承接行）。
4. **AI/聚类不重复立规**：R2 附带的「AI 分析归订阅阶段、本地聚类可行性留档」（product-vision R2）已被 §9 现行「AI 摘要/聚类/区域周报后置为付费」（line 241）+ SPEC-8.5 覆盖，本注记仅括号交叉引用、不新增 AI 子句。

**行为泄漏自查**：本注记为**负向/后置范围声明**（非目标章），不定义任何对外可见运行行为（无 UI 语义、无交互、无数据映射）；ticker 的「不呈现」是删除既有契约的自然结果，非新增可断言行为。合行为泄漏禁区。

---

## 2. feature-matrix 同步（现行 / 建议 / 理由）

### 2.1 FM-12 扩展信源——删 CoinGecko 部分

**现行**（FM line 20）：

> | FM-12 | M3 | 扩展信源 | providers/（GDELT/CoinGecko；SPEC-5.4, 5.7；SPEC-5.10：GDELT 归「新闻报道（待验证）」，分级由 `source` 经表派生，provider 不加字段。**OpenSky 航班图层（SPEC-5.6）与 SPEC-6.3① flight-60s 已移出 M3、改挂 M6 FM-27——REV-016/BUG-017 裁定原生端专属**） | （M3 开卡登记） |

**建议**：

> | FM-12 | M3 | 扩展信源 | providers/（GDELT；SPEC-5.4；SPEC-5.10：GDELT 归「新闻报道（待验证）」，分级由 `source` 经表派生，provider 不加字段。**OpenSky 航班图层（SPEC-5.6）与 SPEC-6.3① flight-60s 已移出 M3、改挂 M6 FM-27——REV-016/BUG-017 裁定原生端专属**） | （M3 开卡登记） |

**理由**：删「/CoinGecko」与 SPEC 锚点「, 5.7」；**GDELT 部分与里程碑 M3 原样保留**（GDELT 改挂 M4 属批⑤ R4，本卡不碰；REV-018 §6.1「FM-12 改后 = GDELT, M4」的 M4 归属由 R4 落地，非本卡）。OpenSky 承接句不动。

### 2.2 FM-14 详情卡 + 搜索——删「2.1-ticker」锚点

**现行**（FM line 22）：

> | FM-14 | M3 | 详情卡 + 搜索 | src/ui/ 详情卡 + 缓存/地名搜索（SPEC-2.3, 2.1-ticker, 2.5；SPEC-7.4 点击飞行+详情卡分片；SPEC-2.3 改写 + SPEC-5.10：信源名/等级、`urls` 计数去重呈现、轻量纠错反馈入口） | （M3 开卡登记） |

**建议**：

> | FM-14 | M3 | 详情卡 + 搜索 | src/ui/ 详情卡 + 缓存/地名搜索（SPEC-2.3, 2.5；SPEC-7.4 点击飞行+详情卡分片；SPEC-2.3 改写 + SPEC-5.10：信源名/等级、`urls` 计数去重呈现、轻量纠错反馈入口） | （M3 开卡登记） |

**理由**：删锚点「2.1-ticker」——该锚点指向 SPEC-2.1 顶栏 ticker 交付物，ticker 删除后成幽灵引用（docs-check 会拦截失配锚点）。FM-14 的详情卡/搜索交付物本与 ticker 无关（顶栏 ticker 曾误挂 FM-14），删锚点后 FM-14 范围更准。SPEC-2.3/2.5/5.10 锚点不动。

---

## 3. 无孤儿自查 + §5.2 防蒸发核验

**全量 grep（spec / FM / testplan / src / tests / e2e）核对无残留活跃交叉引用：**

| 引用位置 | 内容 | 处置 |
| --- | --- | --- |
| spec line 27 SPEC-1 | 「…外加火箭发射、航班动态、**加密行情**」 | **批① R1** 处理（F-1 第一处，`proposal-r1-r10-identity.md` §1.6）；本卡不动，co-pin 衔接见 §6 |
| spec line 37 SPEC-2.1 | ticker 句 | 本卡 §1.1 删 |
| spec line 161–162 SPEC-5.7 | CoinGecko 契约 | 本卡 §1.2 整条删 |
| spec line 171 SPEC-5.10 | 「行情聚合」举例 | 本卡 §1.3-3b scrub（F-1 第二处） |
| spec line 185 SPEC-5.10 | 「CoinGecko…不入本表」注 | 本卡 §1.3-3a scrub |
| spec line 21 §0 修改记录 | CoinGecko/ticker 历史提及 | **不 scrub**（追加式历史，REV-018 §1.1 line 41） |
| **SPEC-6.1 `source` 枚举**（line 203） | `'usgs'\|'eonet'\|'gdacs'\|'gdelt'\|'ll2'\|'opensky'` | **本不含 `coingecko`**（CoinGecko 非 GeoEvent）——无该侧孤儿，删 SPEC-5.7 后模型零悬空 |
| FM line 20 / 22 | CoinGecko / 2.1-ticker | 本卡 §2 删 |
| testplan line 42 M2-18 | ticker 注释 | 涟漪 scrub（qa 执行，见 §4） |
| e2e/topbar-brand-clock.spec.ts | BUG-026 守卫的 spec 锚点注释 | 涟漪 re-anchor（qa 执行，见 §4） |
| bugs.md line 34 BUG-026 / line 24 BUG-017 | CoinGecko/ticker 历史 | **不 scrub**（CLOSED/FIX_READY 缺陷历史记录，同 §0 记录性质） |

**§5.2 防蒸发结论**：CoinGecko/ticker 是**真删除**（契约整体移除、非后置留承接行）——删除后 spec 子句本身不存在，**无「掉出全部场景」问题**（与 GDELT/T2 后置保留 FM 承接行性质不同，REV-018 §1.1①②）。§9 新增的市场信号后置注记为**§9 自承接的负向后置声明**（比照 ACLED，无 FM 行、§9 内自登记，非蒸发）。全量 grep 确认删除后**无孤儿引用悬空**（唯一潜在悬空 = SPEC-6.1 `source` 枚举，实测本不含 coingecko）。

---

## 4. 受影响面（供 orch 派单 / rev 门禁 / qa 涟漪核对）

### 4.1 testplan 涟漪（arch 只列，**不改 testplan 正文、不写断言**——qa 执行）

| 涟漪对象 | 现状 | R2 后处置 | ✅ 是否受影响 |
| --- | --- | --- | --- |
| **M2-18**（testplan line 42，`make e2e TEST=topbar-brand-clock`） | 判据尾注「加密行情 ticker 为 M3 范围（SPEC-2.1 + SPEC-5.7），不入本场景判据」 | **scrub 该注**（SPEC-5.7 已删、SPEC-2.1 已无 ticker，注失效）。M2-18 **判据本身不含 ticker 断言**（只判品牌名/48px/UTC 时钟四项），**✅ 不受影响、不降级** | 否 |

REV-018 §6.2 独立复核结论一致：「M2-18 判据本身不含 ticker 断言，无 ✅ 受影响」。

### 4.2 e2e 测试文件涟漪（arch 只列，**不改测试** —— qa 执行）

- **e2e/topbar-brand-clock.spec.ts 第 65–72 行**（BUG-026 复验守卫 `顶栏不含行情 ticker 占位文本`）：断言 `expect(text).not.toContain('行情')`。
  - **断言本身不变、且 R2 后更强锚定**：ticker 从「M3 待做（现不渲染）」变为「**已删除、永不以此形态呈现**」——顶栏不含「行情」在 R2 后成永久判据（不再是「M2 尚未做」的临时态）。**判据未蒸发、反而强化**（守卫升格）。
  - **须 re-anchor 注释**：第 65–66 行注释现引「SPEC-2.1「加密行情 ticker（M3，SPEC-5.7）」」——该 spec 文本 R2 后不存在。qa 应把 spec 锚点从「M3 待做」改指「SPEC-2.1（顶栏无 ticker）+ §9 后置候选/论纲六」。**仅改注释锚点，断言不动**。
  - 该守卫随 M2-18 的 `topbar-brand-clock` e2e 命令一并跑（同文件），**无独立 testplan 行**。

### 4.3 无新增 testplan 场景

R2 为纯删除 + 负向声明，**无新增可断言运行行为**，本批无新增场景（与批① R1/R10 同——REV-018 §7.3「纯文本、无 src、无新增场景」认定同理适用于删除类）。§9 后置注记为非目标声明，不生成正向断言。

### 4.4 design-prompt / DEV

**无**。R2 零 src 增量（删除契约 + FM/spec 文本 scrub），不派 DEV、不出 design-prompt。orch 应用 pin 即闭环。

---

## 5. 极简边界（本提案不做）

- **不删 SPEC-1「加密行情」枚举项**（批① R1 的 F-1 第一处，已由 `proposal-r1-r10-identity.md` §1.6 吸收）。
- **不改 GDELT / FM-12 GDELT 部分里程碑 / FM-13**（批⑤ R4）。删 FM-12 CoinGecko 时保留 GDELT 与 M3 归属原样。
- **不重排 SPEC-5.x 编号**（删 SPEC-5.7 后 5.8/5.9/5.10 编号不变，维持 pin 稳定与既有交叉引用）。
- **不新增市场信号地理化的实现契约**（§9 只登记「后置候选、暂不立项」，具体形态待未来另起 spec 提案）。
- **不改 SPEC-6.1 / SPEC-5.10 信任表 opensky 分级 / SPEC-5.8**（航迹遥测举例保留，opensky 权威分级正交不变）。
- **不 scrub §0 修改记录 / bugs.md 的历史提及**（追加式历史）。

---

## 6. 遗留风险 / 待仲裁 / 衔接项

1. **与批① R1 的同批 pin 衔接（orch 应用期）**：本卡删 SPEC-2.1/5.7/5.10/§9 + FM，**不含** SPEC-1「加密行情」枚举项（R1 的 F-1 第一处）。若 R1 与 R2 **分批** pin，会出现短暂叙事不一致窗口（SPEC-1 已删枚举但 SPEC-2.1/5.7 尚存，或反之）。REV-018 §6.3 注「R2 可并行①」、R1 提案（§5 item 2）亦建议 orch **将 R1+R2 尽量同批 pin**。**建议：orch 同批应用 R1+R10+R2 于一次 pin**，一次性消除 CoinGecko/ticker 全部交叉引用，无中间不一致态。若确须分批，本卡的 §1.1–1.4 与 R1 的 SPEC-1 删除**互不重叠**（本卡明确不动 SPEC-1），可任意先后应用，无重复删除冲突。

2. **§9 注记对 R10 宪法清单的软引用**：本卡 §1.4 §9 注记内「对照 R10 产品宪法（§9 永不引入清单）」引用了**批① R10 追加的 §9 宪法条**。R10 属批①（与 R1 同卡 `proposal-r1-r10-identity.md`），若 R1+R10+R2 同批 pin（建议），引用即时解析；若 R2 先于 R10 落地，该「对照 R10」表述短暂悬空（不影响本注记语义完整——其核心是「后置非永绝」的正向声明，R10 对照仅为强化区分）。**登记为 co-pin 顺序软依赖，非阻断**。orch 同批可完全规避。

3. **testplan / e2e 涟漪清单**（§4，qa 执行，arch 不改测试/testplan 正文）：
   - M2-18 尾注 scrub（无 ✅ 受影响）。
   - e2e/topbar-brand-clock.spec.ts BUG-026 守卫**注释 re-anchor**（断言不动、判据强化，非降级）。
   - 无新增场景。
   须 orch 在应用 R2 时一并派 qa 执行 testplan/e2e 注释 scrub（机位不变，无 re-run 失败风险——断言本就要求「不含行情」，R2 后依旧成立）。

4. **docs-check 幽灵引用核对**：删 FM-14「2.1-ticker」与 FM-12「5.7」后，orch 应用前建议跑 `make docs-check` 确认无残留幽灵 SPEC 锚点（FM「场景」列引用 testplan 编号的校验之外，SPEC 锚点为交付物列内文本，非 docs-check 强校验对象，但一并核对更稳）。

5. **依赖裁决**：本提案须经 rev 仲裁通过后由 orch 应用（删 SPEC-2.1 ticker 句 + 删 SPEC-5.7 + scrub SPEC-5.10 两处 + §9 追加 + §0 修改记录 + `make pin-spec` + 同步 FM-12/FM-14 + 派 qa 执行 §4 testplan/e2e 涟漪）。在此之前不得抢改 spec/FM 正文。
