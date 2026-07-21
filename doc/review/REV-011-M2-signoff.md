# REV-011 — M2（事件数据层）里程碑签核审查记录

- 日期：2026-07-21
- 版本：v0.2.6
- 审查人：rev（独立实例，未参与 M2 任何 arch/dev/qa 任务）
- 任务：M2 里程碑完成签核（CLAUDE.md §5.1 三条硬条件）
- 结论文件：`doc/evidence/v0.2.6/signoff-M2.md`（结论：**驳回**）

本文件记录核对了什么、怎么核对、发现了什么；结论与整改项在 signoff-M2.md。

---

## 1. 核对方法（不采信转述）

三条硬条件与证据链一律**独立复跑/独立复算**，不采信 `make next` 输出、不采信 qa/orch 交付汇报的文字转述：

- testplan M2 场景状态位：直接读 `doc/testplan.md` 逐行核对。
- 证据链：读 17 个 M2 证据文件首行（复跑命令）/次行（evidence.py 署名+source log）+ 抽查 log 尾部 PASS + grep FAIL 标记。
- spec pin：`sha256sum doc/spec.md` 与 `doc/spec.sha256` 逐字比对 + `python scripts/docs.py --check`。
- 回归时序：`stat` 比对回归产出 mtime 与最新 src/tests/e2e 改动 mtime，换算 UTC↔本地。
- 视觉截图：Read 工具亲自判读 M2-10、M2-15 三张 PNG。
- 里程碑范围：交叉核对 `feature-matrix.md` M2 行 × `design-prompt/M2-*.md` 边界段 × `product-decisions.md` × `log.md`/`status.jsonl`。

## 2. 已成立项（证据侧全绿）

1. **17 条已登记 M2 场景全 ✅**（M2-01~17），证据文件实际存在、首行可复跑、次行 evidence.py 署名、source log 与场景名匹配、无 `--lint` 污染、无 FAIL 标记。
2. **回归 100% PASS 且归档**：`doc/evidence/v0.2.6/regress_summary.txt` = lint/unit/e2e 全 PASS，exit 0；unit 19 files/159 tests、e2e 34 passed。回归产出（本地 12:42:38）晚于最新 src（`markers.ts` 06:31:39）/tests（05:12:32）/e2e（06:39:27）约 6 小时，覆盖最终代码。
3. **spec 未悄改**：sha256 = `42b9602b1abe4ff954d8d0781f4ac6584b830306db6828f4a634fd88d693f9a3`，pin 逐字一致；`docs-check` OK；§0 修改记录六条与裁决对应。
4. **视觉截图达标**：M2-10 六分类色互异且对应 SPEC-3.7；M2-15 昼/夜矢量风格符合 SPEC-3.2a（深色底/青蓝海岸线/30° 网格/夜端更暗），无镜像翻转。
5. **无造假、无未挣得 ✅、无判据向实现看齐**：抽查断言均可指回 SPEC 条目；M2-13 甚至显式断言「行不含 severity」以拒绝向实现扩权。

## 3. 关键发现——里程碑范围不完整（驳回主因）

### 3.1 现象

feature-matrix M2 七行（FM-05~11）中 **FM-09 / FM-10 / FM-11** 三行场景列仍为「（M2 开卡登记）」占位——**从未开卡、零 testplan 场景**。grep `src/` 确认 FM-10 **零实现**：无 UTC 时钟代码（`grep -niE "utc|clock|时钟|toISOString"` src/ui + App.tsx 零命中）、无分类过滤控件（src/ui 只有面板折叠按钮）、顶栏品牌名仍「World Tunnel」。

### 3.2 这些行确属 M2、且无降级决议（排除误判）

逐源交叉确认，非本审查人臆断：

- **SPEC 正文**：SPEC-2.1「品牌名 Worlens（M2）· UTC 时钟（M2）」、SPEC-2.4①「基础分类过滤前移至 M2」、SPEC-3.10「M2 建基线量测」、SPEC-3.11 缓存优先启动（D9 升格为启动路径）。
- **design-prompt**：`M2-globe.md` §2.3 行 21/23/24 显式把「顶栏品牌名+UTC 时钟/分类过滤 predicate」→ FM-10、「缓存优先启动 wiring」→ FM-09、「性能预算基线量测」→ FM-11；`M2-data.md` §17-18 同构改挂。M2-11 行文与 M2-globe.md 检查点 6 把 60fps 量测显式挂 FM-11。
- **product-decisions**：D6（分类过滤前移 M2/M3）、D9（缓存优先启动升格）。
- **orch 自陈**：`log.md` [0.2.6]「其后 M2 收尾三件：FM-09 缓存启动、FM-10 顶栏+分类过滤、FM-11 性能基线；再全量 regress+签核」；`status.jsonl` 首行「再 FM-09/10/11」。

结论：三行是**待办 M2 工作**，非已豁免；无任何降级/移出 M2 的决议。

### 3.3 为何 `make next` 误报可签核

`make next` 机械核对「已登记场景是否全 ✅ + 回归是否归档」，二者均真，故提示"跑签核"。但它**不核对"该 M 的 feature-matrix 行是否都有场景"**——零场景的 FM 行对它不可见。这正是 REV-002 §4 G-1 与 BUG-014 预警的"spec 子句无人认领而静默蒸发"模式，此次升级到 feature-matrix 层：若据 `make next` 签核并打 tag，SPEC-2.1/2.4①/3.10/3.11/3.8 的 M2 子句将因所属 FM 行标"M2"而永不再被后续里程碑提示，静默蒸发。已在 signoff §五整改项 4 建议堵此盲区。

### 3.4 定性：驳回而非有条件通过

M1 签核用「有条件通过」，其条件 C1~C3 均为不涉 src/tests 返工的台账收尾动作。本次缺口 G-A~G-F 需要 dev 实现整个顶栏（品牌名+UTC 时钟+六分类过滤）、缓存启动 wiring+呼吸式过渡、性能基线量测，外加 qa 场景与证据——属核心里程碑工作，非收尾。故取**驳回**。

## 4. 全部非 CLOSED 缺陷阻塞性核对

14 条非 CLOSED 缺陷逐条判断见 signoff-M2.md §四。要点：

- **阻塞（2 条）**：BUG-014（SPEC-2.1 UTC 时钟改挂 FM-10 但 FM-10 未开卡，复验前置未满足）、BUG-027（对外名仍「World Tunnel」，违反 SPEC-2.1「品牌名 Worlens（M2）」）——均并入 FM-10 缺口。
- **不阻塞但推翻性已核（4 条 spec/质量类）**：BUG-022（不推翻 M2-10 ✅）、BUG-023（不推翻 M2-05 ✅）、BUG-024/025（不推翻 M2-13 ✅，M2-13 断言的正是 SPEC-2.2a 现文）——均为新登记的 spec 级设计缺口或重叠态劣化，走 §7 或质量收口，不撤既有状态位。
- **不阻塞（工具/文档/M3/逾期）**：BUG-010（逾期义务，假红非假绿）、BUG-011/012/013/015（工具+文档卫生）、BUG-016/017（M3 FM-12 延后）、BUG-026（M3 交付前修的 UI 代号泄漏）。

特别核对：新登记的 BUG-022~027 **无一推翻现有 M2 ✅**——逐条比对其现象与对应场景的实际判读对象，确认相关 ✅ 断言的语义仍成立，缺陷描述的是场景判据**未覆盖**的新面（密集重叠、入球门槛、排序语义、行内 severity、UI 代号、品牌名），符合"补测/走 §7"而非"撤 ✅"路径。故不出具任何状态位撤销裁决。

## 5. 未越权声明

本次仅只读分析 + 书面记录，未改 src/tests/e2e、未改 bugs.md、未动任何状态位。认定的阻塞缺陷（BUG-014/027）与 make next 盲区整改，均以整改项形式移交 orch，未自行执行。

审查人：rev
签核记录：`doc/evidence/v0.2.6/signoff-M2.md`
