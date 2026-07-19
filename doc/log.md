# log — 交接日志（新的在上；仓库内最多 4 块，超限 `make docs-archive`）

## [0.1.0] 2026-07-20 M1 地球仪
- **做了什么**：三模块交付——`src/astro/solar.ts`（Cooper 赤纬/均时差/直下点，纯数值零 three 依赖）、`src/globe/`（昼夜混合 shader + 菲涅尔大气 + 程序化星空 + 纹理加载与深色占位 + sunDir 60s 节流，`GlobeScene` 为组合根并预留 `markerRoot` 给 M2 标记层）、`src/globe/controls.ts`（拖拽/缩放/惯性/空闲自转，零 three 依赖的纯状态机，可无 WebGL 单测）。spec 经 REV-002 仲裁升至 v0.1 并 pin：新增 SPEC-7.5（时间基准），SPEC-4.1 明确年积日起点、SPEC-3.1 补初始视角、SPEC-3.2 补纹理未就绪/失败期表现、SPEC-7.1/7.3 明确拖拽与自转的作用对象。testplan 13 个场景全 ✅（M1-13 为 SPEC-3.8 性能判据的有据豁免，见 REV-002 G-1；M1-14 由 REV-003 裁决新增）。
- **证据**：`doc/evidence/v0.1.0/`——13 个场景 log + 4 张视觉截图（M1-05 格林尼治校准、M1-07 大气辉光、M1-08 星空、M1-14 昼侧增益对照）、`regress_summary.txt`（lint+unit+e2e 全绿）、`signoff-M1.md`（rev 有条件通过，C1~C3 已闭合）、8 份缺陷复验 log 与 `BUG-007-review.md`。裁决记录 `doc/review/REV-002/003/004.md`，设计 `doc/design-prompt/M1-globe.md`。
- **问题**：本里程碑登记 15 条缺陷、关闭 8 条，其中 6 条是证据工具链自身的失效——`make evidence` 的 `LINT` 参数与 GNU Make 3.81 内置变量同名导致**每次调用都被静默注入 `--lint`**（BUG-004，证据可能记成 lint 日志）、表格分列遇字面竖线静默写坏整行（BUG-002/005）、`docs-check` 对畸形行静默跳过使守卫无声失效（BUG-009）、视觉场景无截图照样置 ✅（BUG-008，M1-07 即由此漏过、经 REV-003 退回重做）。已全部修复并复验。M1-07 的退回是本轮最重要的一次纠正：原断言 `uPower>0 && uIntensity>0` 对 shader 改成向内增强仍全绿，重做后用径向像素采样（峰值定位 + 向外 ≥90% 步进不增 + 末端 <30% 峰值）真正覆盖 SPEC-3.4 的衰减判据。另：orch 冒烟时观察到的相机漂移经 e2e 实测未复现（rAF 在页面隐藏时暂停所致的观测假象），未登记缺陷。
- **下一步**：`make bump MILESTONE=M2` 进入事件数据层。**M2 开卡必须先核对四笔跨里程碑欠账**（散在 REV-002/003/004，勿遗漏）：① SPEC-7.4 相机飞行+详情卡（M1 无标记层无法验证，首轮登记时即推迟）；② SPEC-3.8 性能判据（M1 豁免，须在 FM-07 标记层 ≥200 标记场景回补）；③ SPEC-3.4「不遮挡标记」（M1 只有材质代理断言，M2 须换成对标记的真实断言）；④ SPEC-2.1 UTC 时钟无任何 FM 行与场景认领（BUG-014）。另有 5 条 OPEN 缺陷待处理：BUG-010（idle-spin 疑似 flaky，rev 要求 M2 内闭合且不得靠放宽判据消除）、BUG-011（证据无法覆盖判据跨单测与 e2e 两层的场景）、BUG-012/013（表述失真）、BUG-015（流程类缺陷无法机械关单）。

## [0.0.1] 2026-07-19 M0 基建
- **做了什么**：工作流体系落地（doc 体系+scripts 四件+Makefile+pre-commit；orch+arch/dev/qa/rev 角色卡与 handover/dispatch/evidence/closeout 四 skill）；Vite+TS+React+three.js 骨架（占位线框球+布局壳）；Vitest/Playwright/lint 测试链路全通；spec v0 编写并 pin；NASA 昼/夜纹理入库（ASSETS.md 登记）；REV-001 八角度审查、8 项确认问题全部整改。
- **证据**：doc/evidence/v0.0.1/（M0-01/02/03.log、M0-02-smoke.png、regress_summary.txt、BUG-001.log、signoff-M0.md）。
- **问题**：BUG-001（MSIX Python 容器看不到 AppData 的 Playwright 浏览器）已关单，regress 层因此用 Node；接受不改项清单见 doc/review/REV-001.md。
- **下一步**：`make bump MILESTONE=M1` 进入地球仪里程碑——qa 登记 M1 场景（昼夜 shader/晨昏线/天文单测/交互/纹理对齐 SPEC-3.6 校准），arch 出 globe 渲染 design-prompt 过 rev 门禁后派 dev。
