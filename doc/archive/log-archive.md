

## [0.0.1] 2026-07-19 M0 基建
- **做了什么**：工作流体系落地（doc 体系+scripts 四件+Makefile+pre-commit；orch+arch/dev/qa/rev 角色卡与 handover/dispatch/evidence/closeout 四 skill）；Vite+TS+React+three.js 骨架（占位线框球+布局壳）；Vitest/Playwright/lint 测试链路全通；spec v0 编写并 pin；NASA 昼/夜纹理入库（ASSETS.md 登记）；REV-001 八角度审查、8 项确认问题全部整改。
- **证据**：doc/evidence/v0.0.1/（M0-01/02/03.log、M0-02-smoke.png、regress_summary.txt、BUG-001.log、signoff-M0.md）。
- **问题**：BUG-001（MSIX Python 容器看不到 AppData 的 Playwright 浏览器）已关单，regress 层因此用 Node；接受不改项清单见 doc/review/REV-001.md。
- **下一步**：`make bump MILESTONE=M1` 进入地球仪里程碑——qa 登记 M1 场景（昼夜 shader/晨昏线/天文单测/交互/纹理对齐 SPEC-3.6 校准），arch 出 globe 渲染 design-prompt 过 rev 门禁后派 dev。


## [0.1.0] 2026-07-20 M1 地球仪
- **做了什么**：三模块交付——`src/astro/solar.ts`（Cooper 赤纬/均时差/直下点，纯数值零 three 依赖）、`src/globe/`（昼夜混合 shader + 菲涅尔大气 + 程序化星空 + 纹理加载与深色占位 + sunDir 60s 节流，`GlobeScene` 为组合根并预留 `markerRoot` 给 M2 标记层）、`src/globe/controls.ts`（拖拽/缩放/惯性/空闲自转，零 three 依赖的纯状态机，可无 WebGL 单测）。spec 经 REV-002 仲裁升至 v0.1 并 pin：新增 SPEC-7.5（时间基准），SPEC-4.1 明确年积日起点、SPEC-3.1 补初始视角、SPEC-3.2 补纹理未就绪/失败期表现、SPEC-7.1/7.3 明确拖拽与自转的作用对象。testplan 13 个场景全 ✅（M1-13 为 SPEC-3.8 性能判据的有据豁免，见 REV-002 G-1；M1-14 由 REV-003 裁决新增）。
- **证据**：`doc/evidence/v0.1.0/`——13 个场景 log + 4 张视觉截图（M1-05 格林尼治校准、M1-07 大气辉光、M1-08 星空、M1-14 昼侧增益对照）、`regress_summary.txt`（lint+unit+e2e 全绿）、`signoff-M1.md`（rev 有条件通过，C1~C3 已闭合）、8 份缺陷复验 log 与 `BUG-007-review.md`。裁决记录 `doc/review/REV-002/003/004.md`，设计 `doc/design-prompt/M1-globe.md`。
- **问题**：本里程碑登记 15 条缺陷、关闭 8 条，其中 6 条是证据工具链自身的失效——`make evidence` 的 `LINT` 参数与 GNU Make 3.81 内置变量同名导致**每次调用都被静默注入 `--lint`**（BUG-004，证据可能记成 lint 日志）、表格分列遇字面竖线静默写坏整行（BUG-002/005）、`docs-check` 对畸形行静默跳过使守卫无声失效（BUG-009）、视觉场景无截图照样置 ✅（BUG-008，M1-07 即由此漏过、经 REV-003 退回重做）。已全部修复并复验。M1-07 的退回是本轮最重要的一次纠正：原断言 `uPower>0 && uIntensity>0` 对 shader 改成向内增强仍全绿，重做后用径向像素采样（峰值定位 + 向外 ≥90% 步进不增 + 末端 <30% 峰值）真正覆盖 SPEC-3.4 的衰减判据。另：orch 冒烟时观察到的相机漂移经 e2e 实测未复现（rAF 在页面隐藏时暂停所致的观测假象），未登记缺陷。
- **下一步**：`make bump MILESTONE=M2` 进入事件数据层。**M2 开卡必须先核对四笔跨里程碑欠账**（散在 REV-002/003/004，勿遗漏）：① SPEC-7.4 相机飞行+详情卡（M1 无标记层无法验证，首轮登记时即推迟）；② SPEC-3.8 性能判据（M1 豁免，须在 FM-07 标记层 ≥200 标记场景回补）；③ SPEC-3.4「不遮挡标记」（M1 只有材质代理断言，M2 须换成对标记的真实断言）；④ SPEC-2.1 UTC 时钟无任何 FM 行与场景认领（BUG-014）。另有 5 条 OPEN 缺陷待处理：BUG-010（idle-spin 疑似 flaky，rev 要求 M2 内闭合且不得靠放宽判据消除）、BUG-011（证据无法覆盖判据跨单测与 e2e 两层的场景）、BUG-012/013（表述失真）、BUG-015（流程类缺陷无法机械关单）。


## [0.1.1] 2026-07-20 工作流文档——新增「小步快跑」准则与去重
- **做了什么**：CLAUDE.md 行为准则新增第 5 条「小步快跑」——按最小可闭环功能切片推进，切片闭环（测试可复跑、证据可登记）即走 `/closeout` 提交并 push，不把整个里程碑攒成一笔大提交（用户拍板的新纪律）。同轮文档审计：① 去重两处——§0 档位选择细节归并到 `/dispatch` skill（原文与其 §1 几乎逐字重复）、§2 的 BUG-001 环境说明归并到 §4；② 修正 §5.3 编号重复——原有两个第 4 条，「上游 API 与 spec 不符」改为第 5 条，「流程/规则类关单口径」保持第 4 条，bugs.md 中「§5.3 第 4 条」的援引不受影响；③ 同步 BUG-004 参数改名漏改的两处——`.claude/agents/qa.md` 与 `.claude/skills/evidence/SKILL.md` 中 `LINT=1` 更正为 `DO_LINT=1`（旧写法传给现 Makefile 会被静默忽略，QA 以为登了 lint 证据实际没登）。另：撤销了一次空跑的 `bump MILESTONE=M2`（骨架无对应真实工作，经用户确认回退），M2 尚未开卡。
- **证据**：纯文档变更，无测试面；`make docs-check` 通过（守卫含表格结构与幽灵引用校验），见本块所在提交 diff。
- **问题**：CLAUDE.md 审计结论——123 行不算臃肿，规范（CLAUDE.md）/程序（skills）/角色细则（agents）三层分工基本清楚。两处「疑似重复」经权衡保留：§0 角色表的边界列（orch 派单与回收时的速查，agent md 是给实例自己读的）、§5.3 第 4 条全文（bugs.md 援引的规范原文，且教训性理由值得留在宪法层）。
- **下一步**：开 M2 事件数据层（FM-05/06/07）。开卡前先核对四笔跨里程碑欠账：SPEC-7.4 相机飞行+详情卡、SPEC-3.8 性能判据（≥200 标记场景回补）、SPEC-3.4「不遮挡标记」真实断言、SPEC-2.1 UTC 时钟归属（BUG-014）；并处置 6 条 OPEN 缺陷（BUG-010/011/012/013/014/015，其中 010 rev 要求 M2 内闭合）。按新准则，M2 按 provider/模块切片逐一 closeout，不攒整里程碑。


## [0.1.2] 2026-07-20 Git 约定补明「commit 即 bump」
- **做了什么**：CLAUDE.md §6 新增约定「commit 即 bump」——每次提交都伴随 `version.json` 的 x.y.z 版本递增（`make bump`），没有不带版本递增的提交（用户拍板补明）。此前该要求散在 §5.1「实质性变更要 bump」与 /closeout 步骤里，未与 commit 动作显式绑定。
- **证据**：纯文档变更，无测试面；`make docs-check` 通过。
- **问题**：无。
- **下一步**：同 0.1.1 块——开 M2 事件数据层（FM-05/06/07），先核对四笔跨里程碑欠账与 6 条 OPEN 缺陷。


## [0.1.3] 2026-07-20 路线图重排 v2——产品定位收敛与 spec v0.2 落地
- **做了什么**：产品负责人两轮定位讨论收敛为 21 条决议（新增 `doc/product-decisions.md`，D1–D21：glanceable「世界的表盘」定位、产品名 Worlens、个性化前移、矢量默认+付费风格包、解析分层 T1–T4、分阶段架构等）。arch 出重排提案 `doc/design-prompt/proposal-roadmap-v2.md`，rev 首轮打回（REV-005，K-1~K-4：SPEC-7.4/3.4 蒸发、搜索缺正文、首启引导缺地理维度），arch 修订后 REV-006 放行。orch 应用 spec v0.2（改 13 处 + 新增 SPEC-2.5/3.9/3.10/3.11/5.8/5.9/8.6/8.7/8.8 共 22 项，按 REV-006 勘误口径含 SPEC-1 与 §9）+ pin；feature-matrix 换 v2 新表（FM-05~26，里程碑 M2–M6，场景列待各 M 开卡登记）；BUG-014 置 FIX_READY（UTC 时钟落 FM-10/M2）。补打 tag v0.1.2。**M1-05/06/14 再归属留痕（REV-005 A3 裁决）**：三场景 ✅ 保留，其实证的是卫星纹理路径的昼夜表现，不覆盖 SPEC-3.2 重写后的「矢量默认风格」——矢量默认昼夜是零覆盖新行为，M2 FM-08 必须建真实场景，否则构成新蒸发。
- **证据**：纯文档/spec 变更，无测试面；仲裁链 doc/review/REV-005-roadmap-v2.md（打回）→ doc/review/REV-006-roadmap-v2-recheck.md（放行）；`make docs-check` 通过。
- **问题**：orch 落地携带的两项开放依赖（REV-006 记录在案）——① A4：M5 合规收口需 BUG-015 工具扩展或独立签核子件二选一，M5 前决；② A5：遥测明示载体与时序（M3 引导预留位或 M5 独立提示），M3 开卡前决。
- **下一步**：开 M2（`make bump MILESTONE=M2`）——首卡为 qa 登记 M2 场景行（提案 §4 覆盖点清单），并按提案 §4.1 带入 REV-004 欠账 R-1/R-2/R-3(列表联动分片)/R-5/R-6/R-8/R-11 与 BUG-010/012/013/015 的 M2 处置；BUG-014 复验（核对记录型）由独立 qa 出具。
