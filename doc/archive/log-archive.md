

## [0.0.1] 2026-07-19 M0 基建
- **做了什么**：工作流体系落地（doc 体系+scripts 四件+Makefile+pre-commit；orch+arch/dev/qa/rev 角色卡与 handover/dispatch/evidence/closeout 四 skill）；Vite+TS+React+three.js 骨架（占位线框球+布局壳）；Vitest/Playwright/lint 测试链路全通；spec v0 编写并 pin；NASA 昼/夜纹理入库（ASSETS.md 登记）；REV-001 八角度审查、8 项确认问题全部整改。
- **证据**：doc/evidence/v0.0.1/（M0-01/02/03.log、M0-02-smoke.png、regress_summary.txt、BUG-001.log、signoff-M0.md）。
- **问题**：BUG-001（MSIX Python 容器看不到 AppData 的 Playwright 浏览器）已关单，regress 层因此用 Node；接受不改项清单见 doc/review/REV-001.md。
- **下一步**：`make bump MILESTONE=M1` 进入地球仪里程碑——qa 登记 M1 场景（昼夜 shader/晨昏线/天文单测/交互/纹理对齐 SPEC-3.6 校准），arch 出 globe 渲染 design-prompt 过 rev 门禁后派 dev。
