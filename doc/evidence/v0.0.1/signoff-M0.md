# signoff-M0 — 里程碑签核

- 日期：2026-07-19　版本：0.0.1　结论：**通过**
- 审查记录：doc/review/REV-001.md（8 角度审查，8 项确认问题全部整改后复归回归）

## 三条硬条件核对（CLAUDE.md §5.1）

1. **M0 场景全 ✅**：M0-01/M0-02/M0-03 均由 evidence.py 机械登记（整改后重新生成），复跑命令 `make test` / `make e2e` / `make lint`。
2. **regress 100% PASS**：doc/evidence/v0.0.1/regress_summary.txt（lint+unit+e2e 全 PASS，整改后重跑）。
3. **签核记录**：本文件 + REV-001.md。

## 抽查明细

- M0-01.log：首行 `make test`，vitest 3/3 通过，断言锚 SPEC-6.2。
- M0-02.log + M0-02-smoke.png：标题/canvas 非零/无 pageerror；截图与骨架布局一致（顶栏+线框球+侧栏）。
- M0-03.log：eslint 0 警告 + tsc 0 错误。
- BUG-001.log：MSIX Python 容器问题复验关单，修复载体 regress.mjs，`make e2e` 复跑 PASS。

## 遗留风险

- e2e 本地允许复用已起的 dev server（vite dev 按盘上源码即时服务，风险低；CI 强制新起）。
- 接受不改项清单见 REV-001「明确接受不改」节，改动相关文件时需带上同步责任。
