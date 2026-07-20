# REV-009 — SPEC-6.3① 清扫语义提案仲裁 + BUG-019 severity 方向性仲裁

- 日期：2026-07-21　审查员：rev（独立实例，未参与 proposal-expiry-semantics.md 的 arch 撰写、未参与 REV-008）
- 审查对象：
  1. `doc/design-prompt/proposal-expiry-semantics.md`（SPEC-6.3① 语义澄清提案，BUG-018 修复的 spec 前置）
  2. `doc/bugs.md` **BUG-019**（SPEC-5.5 severity「T-1h 内/T-24h 内」对 net 已过去时的方向性未明说）
- 触发：REV-008 §5 裁决③（R-1 独立核验，登记 BUG-018，倾向 Design Y，定案须走本提案 + 仲裁）；BUG-019（M2-08 编写阶段 QA 从 spec 独立判断发现，断言留白待裁）
- 判据出处（均独立读原始材料，不采信提案/缺陷条转述）：
  - `doc/spec.md` SPEC-6.3 / 6.1 / 5.5 / 3.11 / 8.4 现行文本（§0 修改记录读至 v0.2.2）
  - `src/data/store.ts`（`isExpired = now - ev.ts > expiryMs`，Design X）、`src/data/cache.ts`（keyPath='id'、纯 GeoEvent round-trip）、`src/data/providers/ll2.ts`（`severityFromNet` 取 `Math.abs`）
  - `doc/design-prompt/M2-data.md` §2.3/2.4/2.5/3.3/3.4/3.6/5.2（检查点 4/6/7/8）
  - `doc/testplan.md` M2-01~M2-08 行；`tests/ll2.test.ts`（现断言范围）
  - `doc/review/REV-008-gdacs-ll2.md` §5；`doc/product-decisions.md` D1（glanceable「世界的表盘」）/D11
  - `doc/bugs.md` BUG-018 / BUG-019 / BUG-016 条

## 结论速览

| 项 | 结论 |
| --- | --- |
| 裁决一·lastSeen 过期基准（Design Y） | **成立**。误清/闪烁根因（EONET 24/26 open 事件首轮即被误清）实证清楚；Design Y 独立论证正确，替代方案 A/B 否决理由成立。 |
| 裁决一·冷启动初始化（沿用持久化 lastSeen） | **成立**。两坑（重启即全清 / 离线越久越永生）逐一核验均被避开；probation 否决（摧毁滚动窗口源累积窗）成立。 |
| 裁决一·分叉（lastSeen 是否进 SPEC-6.1） | **拍板：不加字段，作存储层内部记帐。SPEC-6.1 不改。** 加字段反而把实现私有记帐塞进对外归一化模型，制造「声明却不被 normalizer 设置」的契约异味。 |
| 裁决一·行为泄漏禁区（arch 门禁） | **通过**。两条对外可见行为（过期基准=lastSeen、冷启动沿用持久化 lastSeen）全部写入 §3 SPEC-6.3① 文本走 spec 路径；机制（upsertMany 加 now 入参、内部记录形态）仅落 DP，属实现私有、不定义 spec 外对外行为。 |
| 裁决二·BUG-019 severity 方向性 | **拍板：仅未来方向计入。net 已过去（net ≤ now）时归「其余」档 = 1**，不取绝对值双向对称。现实现 `Math.abs` 双向对称为错误，须改。 |
| **总结论** | **放行**（orch 可应用 spec + pin + 同步 testplan/DP + 派单）。两项裁决各自的落地清单见 §1.6 / §2.5。 |

---

## 1. 裁决一 —— SPEC-6.3① 清扫语义（proposal-expiry-semantics.md）

### 1.1 lastSeen 过期基准是否成立（成立）

**根因实证独立复核**：`store.ts:67-68` 现为 `isExpired(ev, now) = now - ev.ts > expiryMs`（Design X，`DEFAULT_EXPIRY_MS=72h`），以事件时间 `ts` 为过期基准。而 `ts` 是 provider 归一化产出的事件时间（EONET=最新 geometry 日期、GDACS=datemodified、LL2=net），源每轮仍返回长寿命事件时以其陈旧 `ts` 重写（`upsertMany` 仅 `events.set(ev.id, ev)`，覆盖含 ts）。故对「源仍返回、ts 已超窗」的长寿命事件：upsert（陈旧 ts）→ 同轮 sweepExpired（now-ts 超窗）删除 → 下轮再现再删。这与 REV-008 §5 独立核验的 EONET 24/26 open 事件首轮被误清、每轮两次 notify 触发 FM-09 呼吸过渡「亮起-熄灭」闪烁完全一致。缺陷真实、非理论。

**Design Y 判定**：以「最后一次被写入存储（upsert）的墙钟时刻 `lastSeen`」为过期计时基准，`now - lastSeen > expiryMs`。把「事件时间」（ts，展示/排序）与「存活性」（lastSeen，过期）两个正交概念解耦——这正是本缺陷的对症解法。**成立**。

**替代方案否决复核**：
- **A（upsert 时把 ts 顶到 max(ts, now)，复用 now-ts 判定）**：否决成立。它摧毁 SPEC-6.1 `ts=事件时间` 语义——详情卡时间展示与按时间排序会把长寿命事件显示为「刚刚」，把「事件时间」与「存活性」混为一谈，是本缺陷的镜像。
- **B（纯 ts 基准 + 加宽窗 / per-category 窗）**：否决成立。任何固定窗都拦不住「genuinely 老但仍活跃」的事件（如持续数月的干旱）；per-category TTL 属 M4，本期不引入。

只有 Design Y 能同时满足「保住 ts 事件时间语义」与「修掉误清/闪烁」，与 REV-008 §5 裁决③倾向一致且为独立论证。

### 1.2 冷启动初始化 —— 沿用持久化 lastSeen（成立，两坑逐一核验）

裁决建议：**回填事件沿用其持久化的 `lastSeen`（关机前最后见到墙钟时刻），离线时段一并计入「无更新」时长**（要求 `lastSeen` 随缓存持久化）。逐坑独立核验：

| 坑 | 独立核验 | 判定 |
| --- | --- | --- |
| **重启即全清** | 沿用真实 lastSeen（多在窗内）；且清扫在首轮 upsert 之后（DP §2.5：load 不清扫、sweep 每轮刷新后随 now 执行）——仍被源返回者已续期（lastSeen=now）→ 存活，仅真正超窗且未返回者熄灭（= SPEC-3.11 呼吸式收敛本意）。**不踩坑**。 |
| **离线越久越永生** | 沿用持久化 lastSeen（不重置为 now）→ 离线时段计入无更新时长 → 已死事件在「真实最后见到 + 窗」到期，与在线一致，频繁重启不再续命。**不踩坑**。 |

**probation 初始化（`lastSeen = now − 窗`，不持久化 lastSeen）否决复核**：否决成立。虽也避开两坑，但对滚动窗口源致命——USGS `all_hour` 首轮只返回近一小时事件，缓存中一条 5h 前、仍在 72h 窗内的合法地震因未被首轮返回而无法续期，probation 令其冷启动后约一个轮询间隔即被清空，跨重启摧毁累积窗（SPEC-6.3① 的 48–72h 累积窗设计意图）。故必须持久化真实 lastSeen。

**与 SPEC-3.11 的交互核验**：回填事件不论 lastSeen 早晚，load 后即入 store 快照 → 冷启动立即上屏（不空网络等待，SPEC-3.11）；lastSeen 已超窗且首轮源仍不返回者，首轮 sweep 后熄灭，正是 SPEC-3.11「已过期/被替换的旧标记渐隐熄灭」。语义一致，无冲突。

### 1.3 分叉裁决 —— lastSeen 不进 SPEC-6.1（拍板：不加字段）

arch 在 §2.4/§7 遗留 2 把「lastSeen 作存储层内部记帐」与「给 SPEC-6.1 加 `lastSeen?: number` 字段」的取舍留给 rev。

**拍板：不给 SPEC-6.1 的 `GeoEvent` 新增 `lastSeen` 字段；lastSeen 作存储层内部记帐，随缓存以实现私有记录形态持久化。SPEC-6.1 修订文本 = 无。** 依据：

1. **模型语义**：SPEC-6.1 明写「归一化模型（全源统一）」——其每个字段都是 provider normalizer 从源数据归一化产出的项（id/category/severity/title/summary/urls/lat/lon/ts/source 皆有源出处）。`lastSeen` 是 store 写入时的墙钟记帐，**无任何 normalizer 会设置它**。放进对外模型即制造「声明了却不被归一化设置」的可选字段歧义，直接扰乱 QA 的 M2-01 结构断言与每份 fixture 的归一化预期。
2. **行为泄漏方向相反**：加字段不是「更透明」，而是把实现私有的存活性记帐塞进对外数据契约——这才是模型污染。保持 lastSeen 内部，snapshot() 仍吐纯 `GeoEvent[]`，UI/globe 无感、读口契约不变。
3. **持久化归属**：缓存的持久化记录形态属实现私有（SPEC-8.4：缓存可重建、不承诺离线数据完整性），在其中夹带 lastSeen 不需要 spec 表面；过期机制封装在 store（`isExpired` 已是唯一入口）内即可。

**代价拍板留痕**：cache/store 内部需多一处 lastSeen 记录形态改动（相较加字段的「零 cache 改动」多一点实现代价）。接受此代价换取「归一化模型干净、机制内聚」。此为实现-模型边界取舍，非判据缩水。

### 1.4 可直接应用的 SPEC-6.3① 修订文本（确认提案 §3 文本，可整条 pin 替换）

复核提案 §3 建议文本，语义完整、正确、与本裁决一致，**确认可直接应用**（整条 SPEC-6.3 替换，仅重写 ①，首句与 ②③ 原样保留）：

> - **SPEC-6.3** 同 id 事件再次出现视为更新（覆盖 ts/severity/summary），不新增标记。过期与保留：①默认过期窗 **48–72h 无更新移除**——「无更新」以事件**最后一次被写入存储（upsert）的墙钟时刻 `lastSeen`** 为过期计时基准，而非事件时间 `ts`：事件只要出现在某轮源响应中被 upsert 即视为「见到」，其 `lastSeen` 刷新、过期计时重置（续期）；连续 48–72h（具体值视本地存储预算定，可配）未再被任何源 upsert 才移除。`lastSeen` 与 `ts` 相互独立——`ts`（事件时间，SPEC-6.1）仅供展示与排序、不参与过期判定，故长寿命事件即便 `ts` 陈旧超窗，只要仍被源持续返回即续期留屏、不被误清。**冷启动**从本地缓存回填的事件沿用其持久化的 `lastSeen`（关机前最后见到时刻），离线时段一并计入「无更新」时长；回填后首轮刷新按 SPEC-3.11 呼吸式过渡收敛（仍被返回者续期、超窗未返回者熄灭），滚动窗口源（如 USGS `all_hour`）的累积窗跨重启不被清空。flight 60s 不变（同以 `lastSeen` 计窗）。②**用户收藏的事件永久本地保存**，不受过期窗影响（M4）。③为未来时间滑块**预留缓存窗口**（滑块 UI 不进早期版本，见 §9）。

**限界留痕（不阻塞，供 orch 应用时知悉）**：文本以 `lastSeen`/`upsert` 命名语义概念（最后被写入存储的墙钟时刻 / 写入存储），其中括注「（upsert）」为语义澄清，不构成对代码标识符的强制约束——dev 可择等价机制形态（DP §5.1 已列自由度）。此为可接受的命名，非行为泄漏。

### 1.5 行为泄漏禁区自查（arch 交付门禁：通过）

逐项核对提案是否把 spec 外对外可见行为只写在 DP：
- 「过期基准=lastSeen」「冷启动沿用持久化 lastSeen、离线计入无更新时长」——两条用户可感知行为**全部写入 §3 SPEC-6.3① 修订文本**（走 spec 修改路径）。✔
- 「upsertMany 新增 now 入参」「lastSeen 内部记录形态（Map 或 {event,lastSeen}）」「cache round-trip lastSeen」——仅落 §5 的 DP 同步项，属实现私有机制，不定义任何 spec 之外的对外行为。✔

**门禁通过**：无行为泄漏，所有对外行为均经 spec 路径，机制细节留 DP。

### 1.6 裁决一落地清单

| 落地面 | 具体项 |
| --- | --- |
| **spec 应用点** | ① SPEC-6.3 整条替换为 §1.4 确认文本（首句/②/③ 不变，仅重写 ①）；② SPEC-6.1 **不改**（分叉裁决 §1.3）；③ §0 修改记录加条目（援引 REV-009 + BUG-018）；④ `make pin-spec` 重钉 sha256。 |
| **DP 同步（M2-data.md，pin 后 arch/dev 同步）** | §2.3 去重与更新：补注 upsert 覆盖字段之外同时刷新 lastSeen（续期）；§2.4 过期清扫：清扫基准由（隐含）ts 改为 lastSeen，「超窗且无更新=连续超窗未被再次 upsert」，isExpired 唯一入口/插入点表述保留；§2.5 缓存优先启动数据侧顺序：缓存 round-trip lastSeen、冷启动回填沿用持久化 lastSeen（离线计入无更新时长）；§3.3 store 接口块：upsertMany 增 now 入参、load 接受并恢复 lastSeen、sweepExpired 按 lastSeen 判定、snapshot() 仍纯 GeoEvent[]；§3.4/3.6 装配：index.ts 单一 now 同传 upsert+sweep；§5.2 检查点 6/7/8：更新为 lastSeen 基准、新增「持续 upsert 的陈旧-ts 事件不被清（续期）」检查点、检查点 8「load 不触发清扫」不变。 |
| **testplan 受影响行** | **M2-02 复测口径**（现 ✅ v0.2.0，判据 ① 半改写须重测）：去重半（SPEC-6.3 首句）不变保留；过期半（SPEC-6.3①）改写为「事件在其 lastSeen 之后连续超过期窗未被再次 upsert 才移除；只要每轮仍被 upsert——即便 ts 陈旧、即便 ts 早于过期窗——即续期留屏」，窗常量仍落 [48h,72h]，并新增关键断言「陈旧 ts 但持续被 upsert 的事件不被 sweepExpired 清扫」。**新增真龄清扫场景 = M2-09**（M2-01~08 均已占用，提案 §5.2「如 M2-07」为笔误，M2-07 已属 GDACS）：`normalizeEonet(eonet_events.json, now=Date.parse('2026-07-20T14:18:49Z'))` → `upsertMany(evts, now)` → `sweepExpired(now)` → 快照仍含全部 open 事件（承接 BUG-018 复现命令，断言引用 SPEC-6.3① 从 spec 推导）；并覆盖「冷启动携旧 lastSeen 记录→首轮再见到者存活、超窗未见到者熄灭」与「滚动窗口源本轮未返回但仍在窗内→不被清」（锁 §1.2 两坑与累积窗）。 |
| **判据合法性声明** | M2-02 判据经合法 spec 修改（§7 路径：本裁决→orch 应用→pin）而变，dev 改 store 为 Design Y 后 qa 须重新推导断言并重跑登记——此为「判据经合法 spec 修改而变」，非 CLAUDE.md §5.2 禁止的「判据向实现看齐」，也非他人 ✅ 的非法降级。改后无 spec 子句掉出全部场景之外（去重/过期/续期均有场景承接）。 |
| **dev 派单要点** | 改 `src/data/store.ts`（isExpired 改 now-lastSeen、upsertMany 增 now 入参并记 lastSeen、load 恢复持久化 lastSeen 不置 now、内部新增 lastSeen 记帐、删条目一并清 lastSeen、snapshot 仍纯 GeoEvent[]）+ `src/data/cache.ts`（persist/load round-trip lastSeen，keyPath 仍 id）+ `src/data/index.ts`（一轮单一 now 同传 upsert+sweep）。锁定不变量：snapshot() 吐纯 GeoEvent、去重键仍 id、load 不清扫；机制形态 dev 自由。 |
| **qa 派单要点** | 重测 M2-02（去重半保留、过期半按 lastSeen 改写、加陈旧-ts 续期断言）+ 登记并测 M2-09 真龄清扫（承接 BUG-018 复现命令）；断言只从 SPEC-6.3① 推导标注条目号；`make evidence` 机械登记。**实例隔离**：改 store 的 dev 与测 store 的 qa 必须不同实例。 |
| **BUG-018 闭环** | 本裁决为 BUG-018 指定的「arch 提案 + rev 仲裁」定案环节。orch 应用 spec + pin + 派 dev/qa 后，BUG-018 由 qa 用其登记的复现命令（node 读 eonet_events.json 归一化灌 EventStore(72h) sweepExpired 观察快照）复验：Design Y 下应 0 条被清（原 Design X 24 条被清）。关单人≠修复人（CLAUDE.md §5.3）。 |

---

## 2. 裁决二 —— BUG-019 severity 方向性（SPEC-5.5）

### 2.1 现状与歧义独立复核

`src/data/providers/ll2.ts:32-37` `severityFromNet` 现取 `const diff = Math.abs(netTime - now)`，**双向对称**：net=now−5min（刚发射完）与 net=now+5min（5 分钟后即将发射）同判 severity 3。SPEC-5.5 现文：「severity：以 net 相对当前时刻，T-1h 内 3，T-24h 内 2，其余 1」——未明说 net 已过去（发射已发生、记录仍存在，如源尚未清理或短暂延迟同步）时的时间距离计算方向。M2-08 现断言（`tests/ll2.test.ts`）已按任务卡指示限定在「net 严格晚于 now」的无歧义区间（真实 fixture 10 条 net 全晚于 NOW；构造用例 net 均 now 之后），不覆盖 net 已过去的方向性——QA 未采信实现的 `Math.abs` 行为作期望，处理正确。

### 2.2 裁决：仅未来方向计入（net 已过去归「其余」档 = 1）

**拍板：severity 以 net 相对当前时刻的剩余时间、仅未来方向计入；net 已过去（net ≤ now）时归「其余」档 = severity 1。** 即否决现实现的双向对称（Math.abs），也不另立独立语义档。

### 2.3 理由（从产品语义出发）

1. **SPEC-5.5 severity 是倒计时紧迫度刻度**：「T-1h 内 3」的自然读法是「还有不到 1 小时就要发射」——刻度编码的是「距发射还剩多久」，越临近越高。发射一旦已发生，倒计时语义即失效，「T-1h 内」不再适用于一个已过去的时刻。双向对称把「即将发生」与「刚发生」混为一谈，与倒计时语义相悖。
2. **D1 glanceable 定位（「世界的表盘」，三秒看见此刻正在发生什么）**：severity 驱动球面标记的视觉显著度/紧迫度。一个「发射已发生」的事件若携 severity 3（最亮/最紧迫），会让用户三秒扫视时误判为「有紧迫的即将发射」，扭曲格局感知——而发射已发生后该事件不再携带紧迫度语义（关注度应降）。归 severity 1 使其仍可见（不误删、记录仍在）但不抢占注意力，与「记录仍存在但低紧迫」的展示语义吻合。
3. **极简优先（CLAUDE.md §1.2）否决「另立独立语义」**：SPEC-6.1 severity 严格为 {1,2,3}。若为「已发射」新立一档需引入第 4 个 severity 值或新增 status 字段，扩大范围且无产品需求背书；而 LL2 由 `launch/upcoming/` 端点驱动，net 已过去仅是「源尚未清理/短暂延迟同步」的瞬态边界（非主线态），为瞬态边界建独立语义属过度设计。归入既有「其余」档=1 无需任何新字段/新档，最少假设。
4. **不使 SPEC-5.5 任何子句蒸发**：T-1h/T-24h/其余三档均保留，只是明确「已过去」落入「其余」；无子句掉出场景之外（M2-08 补断言即承接）。

### 2.4 可直接应用的 SPEC-5.5 severity 条款补句文本（替换 SPEC-5.5 第 4 子条）

现行：

> - severity：以 `net` 相对当前时刻，T-1h 内 3，T-24h 内 2，其余 1。

修订为：

> - severity：以 `net` 相对当前时刻的**剩余时间（仅未来方向）**分档——T-1h 内 3，T-24h 内 2，其余 1；**`net` 已过去（发射已发生，`net ≤ now`）时归「其余」档 = 1**，不取绝对值双向对称、不因刚发射而按时间距离判为高档（记录仍在则以最低紧迫度留屏）。

### 2.5 裁决二落地清单

| 落地面 | 具体项 |
| --- | --- |
| **spec 应用点** | SPEC-5.5 severity 子条替换为 §2.4 修订文本；§0 修改记录加条目（援引 REV-009 + BUG-019）；`make pin-spec` 重钉。（其余 SPEC-5.5 字段映射 v0.2.2 已 pin，不动。） |
| **DP 同步（M2-data.md）** | §5.2 检查点 4「LL2：… T-24h/T-1h/其余的 severity（注入 now 打三个边界）」补一句「net 已过去（net≤now）方向 → 归其余档=1」；§4 待提案/限界项若有「net 方向性未裁」表述一并标注「已裁决，见 REV-009」。 |
| **testplan 受影响行** | **M2-08 补断言口径**：现行文「net 已过去时的方向性 spec 未明确，登记 BUG-019，不在本场景断言范围内」的留白须移除并补断言——构造 net≤now 的用例（如 net=now−30min、net=now−5min、net=now−2h）→ severity 恒 1（引用 SPEC-5.5 修订条款从 spec 推导）；「无歧义区间」表述改为覆盖全区间（含已过去方向）。此为 spec 歧义经合法修改而消解后的判据补齐，非判据向实现看齐（现实现 Math.abs 恰与裁决相反，补断言反而会照出实现缺陷）。 |
| **dev 派单要点** | 改 `src/data/providers/ll2.ts` `severityFromNet`：去掉 `Math.abs`，改用有向差 `netTime - now`，net≤now（差≤0）→ 返回 1，否则按未来剩余时间分 3/2/1。仅动此函数，外科手术式（CLAUDE.md §1.3）。 |
| **qa 派单要点** | 按 §2.4 修订条款补 M2-08 的 net 已过去→severity 1 断言（真实 fixture 无已过去样本，走构造输入），期望值从 SPEC-5.5 推导标注条目号；`make evidence` 机械重登 M2-08。**实例隔离**：改 ll2.ts 的 dev 与测 ll2 的 qa 必须不同实例。 |
| **BUG-019 闭环** | 本裁决消解 SPEC-5.5 severity 方向性歧义（属 CLAUDE.md §7 spec 歧义类）。orch 应用 spec + pin 后派 dev 改 severityFromNet、qa 补 M2-08 断言；BUG-019 由 qa 用登记的复现命令（构造 net=now−30min 观察 severity）复验，裁决后期望应为 1（现实现 Math.abs 判 3 即缺陷已修）。关单人≠修复人。 |

---

## 3. 总结论

**放行。** 两项裁决均定案：

- **裁决一（SPEC-6.3① 清扫语义）**：Design Y（lastSeen 过期基准）成立、冷启动沿用持久化 lastSeen 成立（两坑核验通过、probation 否决成立）、分叉拍板「不加 SPEC-6.1 字段、作存储层内部记帐」、行为泄漏门禁通过。§1.4 SPEC-6.3① 修订文本可直接 pin，SPEC-6.1 不改。
- **裁决二（BUG-019 severity 方向性）**：拍板「仅未来方向、net 已过去归其余档=1」，§2.4 SPEC-5.5 severity 补句可直接 pin。现实现 `Math.abs` 双向对称为缺陷须改。

orch 可据 §1.6 / §2.5 落地清单应用 spec + `make pin-spec` + §0 修改记录 + 同步 testplan（M2-02 复测、M2-08 补断言、新增 M2-09 真龄场景）+ 同步 M2-data.md DP，pin 后派 dev（改 store/cache/index.ts 与 ll2.ts）、qa（重测 M2-02、补 M2-08、登记 M2-09）。

**派单隔离与并发提示（供 orch）**：两项裁决落地均需写 doc/testplan.md（M2-02/M2-08/M2-09）——按 dispatch skill「派单前自查」，写同一台账的卡串行；数据模块的 dev 与 qa 必须不同实例（arch 与本 rev 亦已不同实例）。BUG-018/BUG-019 复验关单人须≠修复人。

**遗留风险留痕（不阻塞放行）**：
1. **过期窗常量取值**：SPEC-6.3① 仍留「48–72h 可配」，现实现 72h（`store.ts:10`）。本裁决只改基准、不改窗值；lastSeen 基准下窗值是否重估属另一议题，暂不动。
2. **BUG-011（证据跨双层留痕）**：M2-02/M2-09 若判据跨 store 单测层，仍受 evidence.py 单 log 限制影响，按 BUG-011 既定口径登记留痕、M2 修工具后补齐，不构成未挣得 ✅。
3. **M2 签核依赖**：BUG-018 系 REV-008 §5 标注「应在 M2 签核前解决」的 EONET 真实数据可用性缺陷；本裁决放行后须实际完成 dev 修复 + qa 关单，签核抽查须核 M2-09 真龄场景证据（Design Y 下 0 条被误清）。

签名：rev（独立实例）　2026-07-21
