# spec 修改提案 — SPEC-6.3① 过期清扫语义澄清（BUG-018）

> arch 起草，**提案性质，未改任何正式文档**。经 rev 仲裁后由 orch 应用 SPEC-6.3 正文 + §0 修改记录 + `make pin-spec` + 同步 testplan M2-02（复测口径）+ 新增真实年龄清扫场景 + 同步 `doc/design-prompt/M2-data.md`。
>
> 触发：`doc/bugs.md` BUG-018（EONET 长寿命 open 事件首轮被误清）+ REV-008 §5 裁决③（R-1 独立核验，rev 倾向 Design Y「按最后见到时刻续期」，正式定案须走本提案 + 仲裁）。
>
> 依据源（只读，未整读入上下文）：
> - 现行 `doc/spec.md` SPEC-6.3 / SPEC-6.1 / SPEC-3.11 / SPEC-8.4
> - `src/data/store.ts`（`isExpired = now - ev.ts > expiryMs`，Design X）、`src/data/cache.ts`、`src/data/index.ts`（装配 wiring）、`src/data/providers/eonet.ts:104`（`ts = Date.parse(latest.date)`）
> - `doc/design-prompt/M2-data.md` §2.3/§2.4/§2.5/§3.3/§3.6/§5.2
> - `doc/testplan.md` M2-02（现 ✅ v0.2.0）、`doc/review/REV-008-gdacs-ll2.md` §5

---

## 0. 问题陈述（根因与实证）

现行 `src/data/store.ts` 的过期判定为 **Design X**：`isExpired(ev, now) = now - ev.ts > expiryMs`，即以**事件时间 `ts`** 为过期基准。

`ts` 是**事件时间**（SPEC-6.1：EONET 取最新 geometry 日期、GDACS 取 `datemodified`、LL2 取 `net`），源每轮仍返回长寿命事件时以其**原始（陈旧）`ts`** 重写。故对「源仍在返回、但 `ts` 已超窗」的长寿命事件：

1. `upsertMany` 以陈旧 `ts` 覆盖 → 2. 同轮 `sweepExpired(now)` 因 `now - ts > expiryMs` 删除 → 3. 下轮源再返回 → 再现 → 再删。稳定态用户看不到该事件，且每轮两次 `notify` 触发 FM-09 呼吸过渡的「亮起-熄灭」闪烁。

**EONET 已 live 显现（非未来边界）**：`tests/fixtures/eonet_events.json`（`status=open&days=7`，抓取 `2026-07-20T14:18:49Z`）26 条全为 open，其中 **24 条**最新 geometry 日期距抓取时刻已超 72h（野火最旧 171h）。归一化后灌入 `EventStore(72h)`，首轮 `sweepExpired` 即删除 24 条，EONET 对真实数据近乎全失。GDACS 同根因：`ts=datemodified`，生产中持续数月的干旱/洪水一旦 `datemodified` 超 72h 未刷新即被误清。

**根因定性**：SPEC-6.3①「48–72h **无更新**移除」语义歧义——「无更新」指 (a) 事件 `ts` 未推进（现实现 Design X），还是 (b) 事件未再被源返回/未再 upsert（按最后见到时刻续期，Design Y）。本提案定案 (b)。

---

## 1. 设计选择：过期基准（不默选，列替代方案取舍）

### 1.1 建议：Design Y —— 过期基准 = 最后见到时刻 `lastSeen`

引入**存储层内部的**最后见到墙钟时刻 `lastSeen`（= 该事件最后一次被 `upsert` 时的 `now`），过期判定改为 `now - lastSeen > expiryMs`。

- 事件只要出现在**某轮源响应中被 upsert** 即视为「见到」→ `lastSeen` 刷新 → 过期计时重置（续期）。
- `lastSeen` 与 `ts` **相互独立**：`ts` 保留为事件时间（SPEC-6.1），仅供展示与排序；`lastSeen` 仅供过期判定。长寿命事件即便 `ts` 陈旧超窗，只要源持续返回即续期留屏，不被误清。

### 1.2 替代方案及取舍（逐一评估后否决）

| 替代方案 | 机制 | 否决理由 |
| --- | --- | --- |
| **A. 事件 ts 加权（抵达即刷新 ts）** | upsert 时把存储的 `ts` 顶到 `max(ts, now)`，复用现 `now - ts` 判定，无需新增 `lastSeen` | **摧毁 `ts` 的事件时间语义**（SPEC-6.1：`ts` = 事件时间）：详情卡的时间展示与任何按时间排序都会把长寿命事件显示为「刚刚」。把「事件时间」与「存活性」两个正交概念混为一谈——正是本缺陷的镜像。**否决**。 |
| **B. 纯 ts 基准 + 加宽窗 / per-category 窗** | 保留 `now - ts` 判定，靠更大的窗或按类窗容纳陈旧事件 | 治标不治本：任何固定窗都拦不住「genuinely 老但仍活跃」的事件（如持续数月的干旱）；per-category TTL 属 M4，本期不引入（见 §4）。**否决**。 |

**结论**：只有 Design Y（独立 `lastSeen`）能**同时**满足「保住 `ts` 事件时间语义」与「修掉误清/闪烁」。这是与 REV-008 §5 裁决③倾向一致的独立论证结果，而非照搬。

---

## 2. 关键交互覆盖（任务四点）

### 2.1 ① 事件不再出现在源响应中后，从 lastSeen 起算过期

某轮起源不再返回该事件 → 不再 `upsert` → `lastSeen` 停在最后见到时刻 → `now - lastSeen` 持续增长 → 连续超过过期窗后由 `sweepExpired` 移除。这正是「无更新移除」的自然读法：**无更新 = 源不再返回/不再被 upsert**，而非「ts 不再推进」。

**滚动窗口源的累积不被破坏**：USGS `all_hour` 等源每轮只返回近一段时间的事件，**「本轮未返回」≠「已死」**。Design Y 下，只被见到过一次的事件其 `lastSeen` 停在首见时刻，仍存活到 `首见 + 窗`——48–72h 累积窗按设计跨多轮积累，不被单轮响应收窄。

### 2.2 ② 冷启动从缓存回填的事件，lastSeen 如何初始化

**建议：回填事件沿用其持久化的 `lastSeen`（关机前最后见到墙钟时刻），离线时段一并计入「无更新」时长。** 这要求 `lastSeen` **随缓存一并持久化**（实现见 §3）。

避开任务点名的两个坑：

| 坑 | 若踩中的表现 | 本方案为何避开 |
| --- | --- | --- |
| **重启即全清** | 回填事件 `lastSeen` 被初始化为极旧值 → 首轮清扫全删 | 回填沿用持久化的真实 `lastSeen`（多在窗内）；且清扫在**首轮 upsert 之后**执行——仍被源返回者已续期（`lastSeen=now`）→ 存活。仅真正超窗且未被返回者熄灭（= SPEC-3.11 呼吸式收敛的本意）。 |
| **离线越久越永生** | 回填 `lastSeen` 每次重启都重置为 `now` → 已死事件每次重启获满窗新租约 → 频繁重启永不过期 | 回填沿用持久化 `lastSeen`（不重置为 `now`）→ 离线时段计入无更新时长 → 已死事件在 `真实最后见到 + 窗` 到期，与在线时一致。 |

**否决的替代（probation 初始化）**：回填时置 `lastSeen = now − 窗`（不持久化 `lastSeen`，省一次缓存改动）。虽也避开两坑，但对**滚动窗口源致命**：`all_hour` 首轮只返回近一小时事件，缓存中一条 5h 前、仍在 72h 窗内的合法地震因未被首轮返回而无法续期，probation 令其在冷启动后约一个轮询间隔即被清空——**跨重启摧毁累积窗**（§2.1）。故必须持久化真实 `lastSeen`，**否决 probation**。

与 SPEC-3.11 的交互：回填事件不论 `lastSeen` 早晚，`load` 后即入 `store` 快照 → 冷启动立即上屏（不空网络等待）；首轮刷新后按 SPEC-3.11 呼吸式过渡收敛。语义一致，无冲突。

### 2.3 ③ 与同 id 覆盖更新（SPEC-6.3 首句）的关系

SPEC-6.3 **首句不变**：「同 id 事件再次出现视为更新（覆盖 ts/severity/summary），不新增标记」。

每次 `upsert` **同时**发生两件事：**更新**（覆盖 `ts/severity/summary` 等可变字段，首句语义）+ **续期**（刷新 `lastSeen`，①语义）。二者不冲突：`ts` 可能因源回送相同陈旧值而不推进，但 `lastSeen` 每次 upsert 必推进。这正是本提案的钥匙——把「是否更新/去重」（按 `id`）与「是否存活」（按 `lastSeen`）解耦。去重键仍是 `id`（SPEC-6.1），不变。

### 2.4 ④ GeoEvent 是否需要新增字段

**建议：不给 SPEC-6.1 的 `GeoEvent` 新增 `lastSeen` 字段（SPEC-6.1 修订文本 = 无）。** `lastSeen` 作为**存储层内部记帐**，随缓存以实现私有的记录形态持久化。理由：

1. SPEC-6.1 是「归一化模型（全源统一）」——其字段应为**各 provider 从源数据归一化产出**的项。`lastSeen` 是存储写入时的墙钟记帐，**无任何 normalizer 会设置它**；放进对外模型会产生「声明了却不被归一化设置」的契约异味，扰乱 QA 的 M2-01 结构断言与每份 fixture 的归一化预期。
2. 缓存的持久化记录形态属**实现私有**（SPEC-8.4：缓存可重建、「不承诺离线数据完整性」），在其中夹带 `lastSeen` **不需要 spec 表面**。
3. 过期机制封装在 `store` 内（`isExpired` 已是唯一入口，`store.ts:63-68`），与既有设计一致；对外读口 `snapshot()` 仍吐纯 `GeoEvent[]`，UI/globe 无感。

**替代（否决）**：给 `GeoEvent` 加 `lastSeen?: number` 可让缓存持久化自动完成（零 cache 改动），但污染归一化模型、并制造「normalizer 不设、store 才设」的可选字段歧义。权衡后取「模型干净、机制内聚」，接受 store/cache 内部多一处记录形态改动的代价。

> **对外可见行为归属声明（行为泄漏禁区自查）**：本提案把「过期基准 = lastSeen」「冷启动沿用持久化 lastSeen、离线计入无更新时长」这两条**用户可感知行为**全部写入 §3 的 SPEC-6.3① 修订文本（走 spec 修改路径）；`lastSeen` 的存储/持久化**机制**（内部记录形态、`upsertMany` 新增 `now` 入参等）仅落 §5 的 DP 同步项，属实现私有，不定义任何 spec 之外的对外行为。

---

## 3. SPEC-6.3① 修订文本（现行 / 建议 / 理由）

### 现行（`doc/spec.md` SPEC-6.3，整条）

> - **SPEC-6.3** 同 id 事件再次出现视为更新（覆盖 ts/severity/summary），不新增标记。过期与保留：①默认过期窗 **48–72h** 无更新移除（具体值视本地存储预算定，可配）；flight 60s 不变。②**用户收藏的事件永久本地保存**，不受过期窗影响（M4）。③为未来时间滑块**预留缓存窗口**（滑块 UI 不进早期版本，见 §9）。

### 建议（仅重写 ①；首句与 ②③ 原样保留，此处引全条便于 pin 替换）

> - **SPEC-6.3** 同 id 事件再次出现视为更新（覆盖 ts/severity/summary），不新增标记。过期与保留：①默认过期窗 **48–72h 无更新移除**——「无更新」以事件**最后一次被写入存储（upsert）的墙钟时刻 `lastSeen`** 为过期计时基准，而非事件时间 `ts`：事件只要出现在某轮源响应中被 upsert 即视为「见到」，其 `lastSeen` 刷新、过期计时重置（续期）；连续 48–72h（具体值视本地存储预算定，可配）未再被任何源 upsert 才移除。`lastSeen` 与 `ts` 相互独立——`ts`（事件时间，SPEC-6.1）仅供展示与排序、不参与过期判定，故长寿命事件即便 `ts` 陈旧超窗，只要仍被源持续返回即续期留屏、不被误清。**冷启动**从本地缓存回填的事件沿用其持久化的 `lastSeen`（关机前最后见到时刻），离线时段一并计入「无更新」时长；回填后首轮刷新按 SPEC-3.11 呼吸式过渡收敛（仍被返回者续期、超窗未返回者熄灭），滚动窗口源（如 USGS `all_hour`）的累积窗跨重启不被清空。flight 60s 不变（同以 `lastSeen` 计窗）。②**用户收藏的事件永久本地保存**，不受过期窗影响（M4）。③为未来时间滑块**预留缓存窗口**（滑块 UI 不进早期版本，见 §9）。

### 理由

- 修掉 BUG-018 的误清与闪烁根因（§0）：把过期与「事件时间陈旧」解耦，改绑「最后见到时刻」。
- 不动 `ts` 语义（SPEC-6.1 无需改）：`ts` 仍是展示/排序用事件时间，GDACS/LL2 的 `ts=datemodified/net`（REV-008 §6 已 pin）保持正确、无需改动——它们的陈旧 `ts` 不再导致误清。本提案与 SPEC-5.3/5.5 字段映射 pin 正交。
- 明确冷启动初始化规则（原文缺失，是 BUG-018 的第二个坑），闭合「重启即全清 / 离线越久越永生」两个歧义。
- 首句、②（收藏保护，M4）、③（时间滑块缓存窗）**不改**，本期不扩范围（§4）。

### SPEC-6.1

**不改**（决定见 §2.4）。修订文本 = 无。

---

## 4. 极简边界（本提案不做）

- **不引入用户收藏保护集**（SPEC-6.3②，M4/FM-17）：`isExpired` 仍是唯一入口，保护集的插入点保留即可（`store.ts:63-68` 现注释已述），本期不建。
- **不引入 per-category TTL**：flight 60s 仍是唯一按类特例，且其测试已由 BUG-016 改挂 M3 FM-12，M2 不实现 opensky。本期只把过期基准从 `ts` 换成 `lastSeen`，窗值与按类结构不动。
- **不引入时间滑块缓存窗**（SPEC-6.3③）。
- **不动去重键 / 首句更新语义 / 呼吸过渡渲染**（后者属 FM-09）。

---

## 5. 受影响面（供 orch 派单 / rev 门禁核对）

### 5.1 实现点（dev，src/data/）

| 文件 / 位置 | 改动性质（实现私有，非 spec） |
| --- | --- |
| `src/data/store.ts:67-68` `isExpired` | 判定改为 `now - lastSeen > expiryMs`（原 `now - ev.ts`）。 |
| `src/data/store.ts:38` `upsertMany` | 需拿到 `now` 以设 `lastSeen`：新增 `now` 入参（`upsertMany(events, now)`）或注入时钟；每条被 upsert 的事件记 `lastSeen = now`。 |
| `src/data/store.ts:45` `load`（缓存回填） | 接受携带持久化 `lastSeen` 的记录并恢复之（非置 `now`）；仍不触发清扫（§2.5 顺序不变）。 |
| `src/data/store.ts` 内部结构 | 新增 `lastSeen` 记帐（如 `Map<id, number>` 平行于 `events`，或 `{ event, lastSeen }` 记录）；`snapshot()` 仍返回纯 `GeoEvent[]`（读口契约不变）。删除条目时一并清 `lastSeen`。 |
| `src/data/cache.ts:32-42` `persist`/`load` | round-trip `lastSeen`：持久化实现私有记录（如 `{ ...GeoEvent, lastSeen }` 或 `{ event, lastSeen }`，keyPath 仍 `id`）；`load` 返回带 `lastSeen` 的记录供 `store.load` 恢复。 |
| `src/data/index.ts:42-47` wiring | 一轮内单一 `now` 同时传 `upsertMany(events, now)` 与 `sweepExpired(now)`（现为 `upsertMany(events)` + `sweepExpired(Date.now())`）。 |

> 以上均为实现自由度内的机制细节，dev 可择等价形态；提案只锁定对外行为（§3）与数据流向不变量（`snapshot()` 吐纯 GeoEvent、去重键仍 `id`、load 不清扫）。

### 5.2 testplan（qa）

**M2-02 复测口径**（现 ✅ v0.2.0 → 判据 ① 半改写、须重测）：

- **去重半（SPEC-6.3 首句）不变**：同 id 覆盖 `ts/severity/summary` 且总数不增——仍有效，保留。
- **过期半（SPEC-6.3①）改写**：由「未再出现更新的事件在 48–72h 窗后移除」（现文隐含按 `ts`）改为——事件在其 `lastSeen` 之后连续超过期窗**未被再次 upsert** 才移除；只要每轮仍被 upsert（**即便 `ts` 陈旧、即便 `ts` 早于过期窗**）即续期留屏。窗常量仍落 [48h,72h]。
- **新增关键断言**（直接锁 BUG-018 根因）：陈旧 `ts` 但持续被 upsert 的事件不被 `sweepExpired` 清扫。

> 说明：M2-02 现 ✅ 是在 Design X 下取得；本判据经 rev 仲裁 + orch 应用（§7 路径）后，dev 改 `store` 为 Design Y，M2-02 须重新推导断言并重跑登记。此为判据经合法 spec 修改而变，非 §5.2 禁止的「判据向实现看齐」，也非他人 ✅ 的非法降级。

**新增场景（REV-008 §5 强制、承接 BUG-018 复现命令，qa 登记新行，如 M2-07）**：

- **真实年龄清扫**：`normalizeEonet(eonet_events.json, now=Date.parse('2026-07-20T14:18:49Z'))` → `store.upsertMany(evts, now)` → `sweepExpired(now)` → 快照仍含全部 open 事件（Design X 下会被清 24 条，Design Y 下 0 条被清）。断言引用 SPEC-6.3①，从 spec 推导。
- **冷启动续期/熄灭（建议同场景或并入 M2-02 覆盖点）**：`load` 携旧 `lastSeen` 的记录 → 首轮 upsert 再见到者存活、超窗未见到者移除；并验证「滚动窗口源某事件本轮未返回但仍在窗内 → 不被清」（锁 §2.2 两坑与累积窗）。

### 5.3 DP 同步条目（`doc/design-prompt/M2-data.md`，orch 应用 pin 后由 arch/dev 同步）

| DP 条目 | 需同步的点 |
| --- | --- |
| §2.3 去重与更新 | 补注：`upsert` 在覆盖字段（首句）之外**同时刷新 `lastSeen`（续期）**（SPEC-6.3①）。 |
| §2.4 过期清扫 | 改写清扫基准：由（隐含）`ts` 改为 `lastSeen`；「超窗且无更新 = 连续超窗未被再次 upsert」；`isExpired` 唯一入口/插入点表述保留。 |
| §2.5 缓存优先启动数据侧顺序 | 补：缓存 round-trip `lastSeen`；冷启动回填**沿用持久化 `lastSeen`**（离线计入无更新时长），籍此保住滚动窗口源跨重启的累积窗（SPEC-6.3① + 3.11 + 8.4）。 |
| §3.3 存储与读口（store.ts 接口块） | `upsertMany` 增 `now` 入参；`load` 接受并恢复 `lastSeen`；`sweepExpired` 按 `lastSeen` 判定；`snapshot()` 仍纯 `GeoEvent[]`。 |
| §3.4 / §3.6 装配 | index.ts 单一 `now` 传 upsert+sweep（§5.1）。 |
| §5.2 检查点 6/7/8 | 更新为 `lastSeen` 基准；新增「持续 upsert 的陈旧-`ts` 事件不被清（续期）」检查点；检查点 8 的「load 不触发清扫」不变。 |

---

## 6. 与既有裁决/缺陷的关系

- **REV-008 §5 裁决③**：本提案即其指定的「BUG-018 的 arch 提案」，独立论证落定 Design Y（§1），与 rev 倾向一致但非照搬。GDACS/LL2 的 `ts=datemodified/net`（SPEC-5.3/5.5 pin）保持不变、与本提案正交——它们的陈旧 `ts` 在 Design Y 下不再致误清，REV-008 §5 关于 GDACS 长寿命干旱/洪水的残留担忧随之闭合，无需再动 SPEC-5.3。
- **BUG-016（M2-02 flight-60s 已改挂 M3 FM-12）**：不受本提案影响；flight 60s 窗值不变，只是同以 `lastSeen` 计窗，M2 无 opensky 源。
- **`src/data/providers/eonet.ts:104`**（`ts = Date.parse(latest.date)`）：无需改——`ts` 语义正确，问题在 store 清扫基准，本提案不动 provider。

---

## 7. 遗留风险 / 待仲裁项

1. **过期窗常量取值**：SPEC-6.3① 仍留「48–72h 可配」，现实现取 72h（`store.ts:10` `DEFAULT_EXPIRY_MS`）。本提案不改窗值，仅改基准。若 rev 认为 `lastSeen` 基准下应重估窗值，属另一议题、不在本提案。
2. **持久化形态选择**（`lastSeen` 存 GeoEvent 字段 vs store 内部记录）：§2.4 已建议后者并给理由；若 rev 判「加 SPEC-6.1 字段」更简，则本提案 SPEC-6.1「不改」结论需相应调整为给出 `lastSeen?: number` 字段修订文本。此为待 rev 拍板的实现-模型边界取舍，已列替代与取舍。
3. **依赖裁决**：本提案须经 rev 仲裁通过后，由 orch 应用 SPEC-6.3 正文 + `make pin-spec` + 同步 testplan/DP，dev 方可改 `store`。在此之前 dev 不得按任一 Design 抢改（现 Design X 保持，M2-02 现 ✅ 暂不动）。
