# CLAUDE.md

world_tunnel（产品对外名 Worlens）——个人专属新闻信息流地球仪 App。可交互 3D 地球（晨昏线/夜景灯光/大气层），
全球事件地理定位实时弹出（新闻/灾害/冲突/人道危机 + 航班/火箭/加密行情），点击见信源摘要，watchlist 过滤。
技术栈 TypeScript + Vite + React + three.js，最终 Capacitor 包 iOS（云 macOS CI 出包）。
**产品目标：小而美，且足够吸引人付费。**
核心纪律：**厚存储 · 薄读口，机械交脚本 · 语义留 Agent，单一事实源 + 文档守卫**。

## 0. 角色与调度（orch = 主会话）

**权责（2026-07-20 用户拍板）**：**orch 全权负责本项目**——产品取舍、路线推进、里程碑判定、执行与收尾均由 orch 决策并直接推进，不等待逐项批准。**用户只负责反馈**：反馈是最高优先级输入，可随时否决或改向任何决定；重大产品转向在 doc/product-decisions.md 留痕。例外（仍须用户明示同意）：花钱、对外发布/上架、法律与合规承诺类动作。

主会话即 orchestrator（orch）：**纯指挥家**——拆解任务、组卡派单与回收核对、维护记忆系统与台账、
应用已仲裁的 spec 修改并 pin、bump/tag/push、把关里程碑。**不产出技术工件**——代码、design-prompt、
测试、审查记录一律派发给 `.claude/agents/` 下的角色：

| 角色 | 职责 | 边界 |
| --- | --- | --- |
| `arch` | spec 修改提案、模块/接口/数据契约设计（design-prompt）、feature-matrix 行 | 不写 src/tests 实现；**对外可见行为必须进 spec，不得只写在 design-prompt**（行为泄漏禁区）；spec 只能提案，经 rev 仲裁后由 orch 应用并 pin |
| `dev` | src/ 实现 + 自检（lint + 相关单测跑通） | 不改 tests/e2e/testplan 状态位；期望 QA 补的场景只列检查点 |
| `qa` | tests/ e2e/ fixtures/、testplan 场景登记、测试执行与证据登记、缺陷登记与复验关单 | 断言期望值只准从 spec 推导（标注 SPEC-x.y），禁止照抄实现行为；不改 src/ |
| `rev` | arch 交付门禁、代码/测试审查、仲裁、里程碑签核 | 只读分析 + 书面记录（doc/review/、signoff），不直接改代码 |

**实例隔离（硬规则）**：同一模块的 dev 与 qa 必须不同实例；arch 与 rev 必须不同实例；实例交付即终止。
任务卡里禁止粘贴其他实例的推理过程——只允许共享文件路径、SPEC 条目号、条目 ID。
目的：切断共模错误传播（注意边界：隔离切不断同模型对同一 spec 的共同误读，所以歧义前置登记 + rev 锚定 spec 的审查同样重要）。

**派单前用 skill `/dispatch` 组卡**（档位选择与隔离自查见该 skill）；交付按各角色 md 的"交付汇报"固定格式回收。

## 1. 行为准则（全局五条，所有角色适用，优先级最高）

1. **先想后写**：显式陈述假设；多种解读并陈不默选；有更简单方案要说；不清楚就停下来问。
2. **极简优先**：只写解决问题的最少代码；不写没被要求的功能/抽象/「灵活性」；不给不可能场景写错误处理。自问「资深工程师会说这过度设计吗」。
3. **外科手术式改动**：只动必须动的行；不顺手改邻近代码/注释/格式；发现无关死代码只提不删；自己改动产生的孤儿 import/变量要清掉。每一行改动都应能追溯到需求。
4. **目标驱动**：动手前把任务转成可验证判据（「修 bug」→「先写复现测试再修绿」）；多步任务先列步骤+每步验证方式；判据强了才能自主循环。
5. **小步快跑**：按最小可闭环的功能切片推进——一个切片 = 一段可独立验证的活（测试可复跑、证据可登记）；切片闭环就走 `/closeout` 提交并 push，不把整个里程碑攒成一笔大提交。切不出验证边界的活，先回到第 4 条补出判据再动手。

## 2. 仓库结构

```
doc/       spec.md（单一事实源）+ 记忆系统 + testplan.md + feature-matrix.md + bugs.md
           + design-prompt/（arch 产出）+ evidence/ + review/（rev 记录）+ archive/（默认不读）+ attachment/
scripts/   机械工作脚本（docs.py / bump.py / evidence.py / regress.mjs），iverif-workflow kernel 适配版
           （regress 用 Node 不用 Python 的原因见 §4 与 BUG-001）
.claude/   agents（arch/dev/qa/rev）与 skills（handover/dispatch/evidence/closeout）
src/       astro/（天文纯函数）globe/（three.js 场景+shader）data/（GeoEvent+providers+scheduler）
           ui/（React 面板）store/（状态）
public/assets/textures/   NASA 公版纹理（出处登记 ASSETS.md）
tests/     Vitest 单测 + fixtures/（各 API 真实响应 JSON 样本，头注抓取时间）
e2e/       Playwright 冒烟与截图
ios/       M5 由 Capacitor 生成
```

语言与风格：注释、文档、commit message 用简体中文；标识符用英文；TypeScript strict，匹配现有代码风格。

## 3. 记忆系统 ★

**接手两步**：`make handover` + `make next`（skill `/handover`）。禁止靠通读文件来接手。

三个滚动文件（doc/ 下）：
1. `status.jsonl` — 首行 = 当前总览（date/version/summary ≤200 字符）；历史快照在下。
2. `log.md` — 交接日志，块头 `## [版本] 日期 标题`，新的在上；仓库内最多 4 块，超限 `make docs-archive`。
3. `testplan.md` — 场景真值表，状态位 ✅/❌/⚠️/🔲（✅ 及证据由 evidence.py 回填）。

`make bump` 自动插入 TODO 骨架，只填语义；docs-check 拦截未填的 TODO。归档件统一放 `doc/archive/`，**默认不读**。

**Token 纪律**：grep 定位再精读，不通读大文件；不读归档件；不读已 ✅ 条目细节；spec.md 按章节定位（`grep -n "^#" doc/spec.md` 取目录）。

## 4. 环境与命令

Windows 11 host：node 24 / npm 11 / GNU make 3.81（老版本，Makefile 只用基础语法）/ Python 3.14（MSIX 容器版，勿在其下挂需访问 AppData 的子进程，见 BUG-001）。
入口（Makefile 薄转发 npm scripts 与 scripts/）：

| 命令 | 作用 |
| --- | --- |
| `make handover` / `make next` | 接手：状态总览 / 机械推导下一步 |
| `make dev` | 起 dev server（浏览器预览） |
| `make test [TEST=模式]` / `make e2e [TEST=模式]` | 单测 / Playwright，产 test-results/*.log |
| `make lint` | eslint + tsc --noEmit，产 log |
| `make regress` | 全量回归（lint+unit+e2e），产 regress_summary.txt |
| `make evidence SCEN=<ID> TEST=<模式> [E2E=1] [DO_LINT=1] [SHOT=路径]` | 从测试 log 机械生成证据并回填 testplan |
| `make evidence BUG=<ID> ...` / `make evidence REGRESS=1` | 缺陷复验关单 / 归档回归总判定 |
| `make bump [MILESTONE=M<n>]` / `make docs-check` / `make docs-archive` | 版本推进 / 文档守卫 / 滚动归档 |
| `make pin-spec` | spec.md 修改后重新钉住 sha256 |

## 5. 开发工作流（`make next` 告诉你现在该干什么）

1. `make handover` + `make next` 接手。
2. 场景微循环（全部经 `/dispatch` 派单流转）：**qa 在 testplan.md 先登记场景行** →（重大模块：arch 出 design-prompt → rev 门禁）→ dev 实现+自检 → qa 测试 PASS 后 `make evidence` 机械登记（视觉场景附截图）→ rev 审查（按需）。
3. 交互冒烟：orch 用 preview 起 dev server 验收拖拽/缩放/点击，截图留证。
4. 收尾走 skill `/closeout`：bump → 填 log 四问 + status summary → docs-check → commit → **push**。

### 5.1 版本与里程碑

- 版本 `0.M.P` 存于 `version.json`（M0 基建 / M1 地球仪 / M2 事件数据层 / M3 全信源+详情 / M4 个性化 / M5 iOS 打包 → v1.0.0）。所有实质性变更都要 bump；里程碑完成打 git tag `v0.M.P`。
- **M 完成判据（三条硬条件，`make next` 机械核对）**：① 该 M 的 testplan 场景全 ✅；② `make regress` 100% PASS 且证据归档（REGRESS=1）；③ rev 签核记录存 doc/evidence/（signoff-M<N>.md）。

### 5.2 证据规则 ★（防验证造假）

- **没有测试 log 就没有 ✅**。证据一律 `make evidence` 机械生成（首行 = 可复跑命令）；**禁止手写证据文件**（脚本拒收 FAIL log）。
- 汇报必须与 log 一致；测试没跑、跑挂了，如实写 ❌/⚠️，不许「应该能过」。
- **✅ 的撤销**：任何角色不得自行降级他人登记的状态位；错误登记由 **orch 依 rev 书面裁决**撤销，须在 log.md 援引裁决记录（如「REV-003 §1」）。撤销时状态/证据/复跑三列一并回退，**不得顺手修改场景判据文字**——判据要改走 §7 路径。
- **判据不得向实现看齐**：发现场景判据与实际所测不符时，默认补齐测试，而非把判据改小到与实现齐平。改判据前先问「改后是否有 spec 子句掉出全部场景之外」——会掉出的一律驳回（否则该子句因所在行呈 ✅ 而永不再被 `make next` 提示，静默蒸发）。

### 5.3 缺陷闭环 ★

1. **登记**：发现问题先在 `doc/bugs.md` 登记——最小复现命令、现象、期望及 SPEC 依据。**禁止只在对话里口头传递**。复杂的开 `doc/bugs/<BUG-ID>.md` 详情页。
2. **归属与修复**：orch 依 bugs 条目派单（实现问题→dev；测试自身问题→qa；spec 歧义→rev 仲裁）。修复者回填根因与修复 commit，置 FIX_READY，禁止自关。
3. **复验关单**：qa 用登记的复现命令复跑 + 相关回归，`make evidence BUG=<ID> ...` 机械关单。**关单人 ≠ 修复人**。
4. **流程/规则类缺陷的关单口径**（无自动化复现手段者，如派单调度、文档约定类）：复验证据为**独立 qa 出具的核对记录**（存 `doc/evidence/`，写明核对对象、逐条结论、遗留漏洞、署名），状态由 orch 依该记录置 CLOSED。**严禁挂一份与该缺陷无关的测试 log 冒充复验证据**——那比不关单更坏，会让证据链里混进查不出的假绿。适用边界严格限于**确实写不出复现命令**的缺陷；凡能写出复现命令的一律走上一条的机械关单，不得借此口径绕过测试证据。工具侧支持见 BUG-015。
5. 上游 API 行为与 spec 不符 → 属 spec 缺陷，走 spec 修改路径（§7）。

## 6. Git 约定

- 中文 Conventional Commits（`feat:` `fix:` `docs:` `chore:` `test:`）。提交自包含：源码+测试+文档同一提交。
- **commit 即 bump，纯文档改动除外**：涉及 `src/`/`tests/`/`e2e/`/`scripts/` 或 `doc/spec.md` 的提交都伴随版本号 x.y.z 递增（`make bump` 写入 `version.json`，patch 位随切片走，里程碑进位见 §5.1）；只改 `CLAUDE.md`、`.claude/`（agents/skills）或不改变产品行为的说明性文档时不 bump，直接 commit。
- **每次 `/closeout` 收尾 commit 后立即 `git push`**（用户长期授权动作）；push 失败如实汇报，不静默跳过、不 force push。
- 首次克隆后执行 `git config core.hooksPath .githooks` 启用软门禁（pre-commit docs-check）。

## 7. 单一事实源

- `doc/spec.md` 是产品/视觉/数据契约的单一事实源，sha256 pin（`doc/spec.sha256`）。每次修改必须：① 「修改记录」表加条目；② `make pin-spec` 重新钉住；③ 同步受影响的 testplan 条目。禁止悄改正文。
- **修改路径唯一**：发现歧义/新行为 → 登记 bugs.md 或 arch 提案 → rev 仲裁 → orch 应用 + pin。
- 代码中的期望值（分类颜色、轮询间隔、severity 映射等）只准从 spec 推导；测试断言引用 SPEC 条目号。
- 上游 API 响应样本存 `tests/fixtures/`，是 provider 单测的事实依据；样本更新须在 commit message 说明抓取时间。
