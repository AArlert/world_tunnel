---
name: evidence
description: 登记测试证据——用 evidence.py 从 regress.mjs 产出的测试 log 机械生成证据文件并自动回填 testplan/bugs。任何场景要置 ✅ 或缺陷要 CLOSED 之前执行。
---

# 证据登记流程（机械生成，禁止手写证据文件）

1. 前提：测试已真实跑完（`make test [TEST=模式]` / `make e2e` / `make lint`，log 落在 test-results/）。FAIL 的 log 不登证据——场景置 ❌/⚠️，疑似缺陷走 bugs.md。
2. 场景证据：`make evidence SCEN=<场景ID> TEST=<模式> [E2E=1] [DO_LINT=1] [SHOT=截图路径] [SPEC_REF=SPEC-x.y]`
   —— 脚本校验 log 的机械判定尾行为 PASS、写 `doc/evidence/v<版本>/<ID>.log`（首行=复跑命令）、归档截图、自动回填 testplan 行（✅/证据/复跑）。视觉类场景必须带 SHOT。
3. 缺陷复验关单：`make evidence BUG=<BUG-ID> TEST=<模式> [E2E=1]`（自动置 CLOSED + 复验证据；关单人 ≠ 修复人）。
4. 脚本拒绝时（log 缺失 / FAIL / 找不到表行）按真实情况处理，不得绕过脚本手工造文件。
5. 里程碑级证据：`make regress` 后 `make evidence REGRESS=1` 归档回归总判定 + rev 签核记录（signoff-M<N>.md）。
