---
name: dispatch
description: 派单卡组装——orch 派 arch/dev/qa/rev 任务前按固定模板组装输入、选档位、过隔离自查。每次派发 subagent 之前执行。
---

# 派单流程（orch 专用）

## 1. 选档位（Agent 调用的 model 参数；不传则用 agents 默认 opus）

- **低档 haiku**：机械改动——回填表格、搬文件、格式化、按明确指令的小修。
- **中档 sonnet**：常规编码——结构清晰的组件/单个 provider/按模板写测试场景、证据登记。
- **高档 opus**：架构设计、渲染管线/shader、跨模块改动、疑难 debug、仲裁与里程碑签核。

## 2. 组装任务卡（只放清单内的输入，防共模泄漏）

先 `make next` 拿机械推导的行动清单，再按卡型组卡：

| 卡型 | 必给输入 | 禁放内容 |
| --- | --- | --- |
| arch 设计输入 | SPEC 条目号（或新需求描述）、feature-matrix 范围、doc/design-prompt/_template.md 路径 | orch 对实现的预设结论 |
| arch spec 提案 | 歧义/适配点的 BUG-ID 或描述、涉及 SPEC 条目号 | 任何一方的期望裁决方向 |
| dev 新功能 | design-prompt 路径（重大模块，**须已过 rev 门禁**）或直接的 SPEC 条目号、feature-matrix 编号、相关 src/ 文件路径 | QA 断言代码/推理、arch 被打回的草稿 |
| dev 修复 | bugs.md 条目 ID（现象/最小复现/SPEC 依据）、相关 src/ 文件路径 | QA 期望值推导、调试过程的推理 |
| qa 场景 | testplan 行 ID、SPEC 条目号、src/ 模块导出签名（接口，非实现体）、fixtures 抓取要求 | DEV 的实现思路、实现内部细节、design-prompt |
| qa 复验 | bugs.md 条目 ID、登记的复现命令、需带跑的回归范围 | DEV 修复过程的推理（只给修复 commit 号） |
| rev 门禁/审查/仲裁/签核 | 审查对象清单（文件/条目）、判据出处（SPEC 条目 / CLAUDE.md §5.1） | 任何一方的口头结论转述（让 rev 自己读原始材料） |

## 3. 派单前自查（逐条确认）

- [ ] 全新实例；不复用做过同一模块另一角色任务的实例；arch 与 rev 分实例（CLAUDE.md §0 硬规则）。
- [ ] 卡内只有文件路径、SPEC 条目号、条目 ID——没有其他实例的推理过程。
- [ ] 派 dev 做重大模块前，design-prompt 已过 rev 门禁（行为泄漏检查）。
- [ ] 缺陷派单前已在 bugs.md 登记（禁止口头派单）。
- [ ] 任务卡写明交付判据（rev 门禁通过 / lint 干净+相关单测过 / 场景 PASS+证据 / 审查记录路径）。
- [ ] **写共享台账的卡一律串行**：`doc/bugs.md`、`doc/testplan.md` 同一时刻只允许一张卡在写。判断依据只有一条——**这张卡是否可能写该文件**，按卡的实际写入面判断，不按角色、不按「回填目标是否不同」。qa 卡除 evidence 回填外还会登记新缺陷，dev 卡修复后要回填 FIX_READY，rev 做**仲裁**时要写 bugs.md 的裁决与状态列（rev 只有门禁/审查/签核三类任务才是只读），都会落到 bugs.md。**不给任何角色开无条件豁免**——BUG-007 首轮修复就栽在「如 rev 不受此限」这句举例上，把判断依据偷换回了角色刻板印象。
- [ ] **改 scripts/ 的卡与用 scripts/ 的卡不并行**：dev 改证据脚本期间，qa 跑 `make evidence` 会拿到中间状态。
- [ ] 单卡范围上限约 2 个场景 / 2 条缺陷。超出就拆——5 场景的卡曾整卡空转 55 分钟无产出，拆成 2 场景后 3.6 分钟完成。

## 4. 回收核对

- 对照角色 md 的"交付汇报"固定格式验收；缺项就退回补齐。
- 证据只认 `make evidence` 生成的文件（首行复跑命令+生成戳）；状态由脚本现算（`make next` 查看），orch 不维护任何状态位。
- 状态位（testplan/bugs）由 evidence.py 回填；`make docs-check` 过一遍再收单。
