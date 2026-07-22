

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


## [0.2.0] 2026-07-20 M2 开卡——FM-05 场景登记、数据核心 DP 过门禁、G-1 入 spec
- **做了什么**：M2 首切片。① qa 登记 M2-01~04（FM-05 数据核心：归一化/去重过期/轮询限流/退避与故障隔离），FM-05 场景列已回填；② arch 交付 `design-prompt/M2-data.md`（数据核心+T1 provider 框架），REV-007 四项门禁全过（行为泄漏/极简/锚点/与 testplan 一致性），**可派 dev**；③ G-1（EONET 非 Point geometry 降维）经 REV-007 §2 即裁，SPEC-5.2 修订入 spec（v0.2.1）并重 pin；④ F-1 失配修正：M2-02 的 flight-60s 子句在 M2 不可满足，依裁决改挂 M3 FM-12 承接，登记 BUG-016（FIX_READY）；⑤ 另：命名核查完成（doc/research/naming-202607.md），用户裁定保留 Worlens（D4 二次修订），research 角色与两份调研报告入库；CLAUDE.md 权责改写（orch 全权，用户反馈制）。
- **证据**：均为文档/spec 变更，无测试面；门禁与裁决链 doc/review/REV-007-M2-data-gate.md；`make docs-check` 通过。
- **问题**：① G-2（GDACS 字段来源）/G-3（LL2 字段来源与 list 模式坐标）未裁——REV-007 §3 裁定次序：抓 fixture → arch 提案 → rev 仲裁 → pin → dev 才可实现 gdacs/ll2 映射；② CORS 风险（REV-007 §4）：dev 抓 fixture 时须浏览器侧实测各源 CORS 头，某源封死则登记 bugs 走仲裁；③ O-1/O-2 两条非阻塞小项在 REV-007 §5。
- **下一步**：派 dev 实现 REV-007 §3.2 安全范围（types/store/http/scheduler/cache/index/usgs/eonet——G-1 已 pin 故 eonet 解锁）+ 抓四源 fixture（含 CORS 实测）；随后 arch 依 fixture 提 G-2/G-3 映射提案。M2-01~04 测试由 qa 在 dev 交付后接卡。


## [0.2.1] 2026-07-21 数据核心骨架落地——M2-02/03/04 全绿,OpenSky CORS 封死登记
- **做了什么**：① CORS 独立探测（orch 轻量执行，产品负责人指示，样本与响应头留 scratchpad 未入库）：七源中六源（USGS/EONET/GDACS/LL2/GDELT/CoinGecko）ACAO 通配可浏览器直连，**OpenSky 钉死自有域→web 端直连不可行**，登记 BUG-017（SPEC-5.6 可行性假设不成立，M3 FM-12 开卡前仲裁）；GDACS 单响应 634KB 体量已知会。② dev 按 M2-data DP 实现 `src/data/` 骨架（types/store/http/scheduler/cache/index，providers 空数组开口，零 three 依赖），自检 lint+全量单测绿。③ qa 两卡串行：M2-02（store 去重/过期窗）、M2-03（独立轮询）、M2-04（退避×2^n 上限 30min/条件请求/故障隔离）三场景 ✅，证据 doc/evidence/v0.2.0/。M2-01 留 🔲（归一化需 provider，待后续卡）。
- **证据**：doc/evidence/v0.2.0/M2-02.log、M2-03.log、M2-04.log（均 evidence.py 机械生成）；lint+unit 全量 PASS（test-results/）。
- **问题**：① dev 登记两处非阻塞张力待后续判：空轮/304 轮不触发清扫（与 DP §2.5 措辞微张力）、createDataLayer 无参签名致装配级 round-trip 测试需挂全局 fake-indexeddb；② cache（SPEC-3.11/8.4 数据侧）尚无场景覆盖——属 FM-09 范围，开卡时登记；③ BUG-017 悬至 M3。
- **下一步**：provider 卡——dev 实现 usgs.ts+eonet.ts（G-1 已 pin）+ 正式抓四源 fixture（含头注抓取时间；gdacs/ll2 仅捕获原始响应供 arch 提案 G-2/G-3，映射禁实现）；qa 接 M2-01 归一化断言;随后 arch 依 fixture 提 G-2/G-3 → rev 仲裁 → pin。FM-07/08 视觉切片临近,出可视化结果时通知产品负责人验收。


## [0.2.2] 2026-07-21 USGS/EONET provider 落地 + G-2/G-3 仲裁 pin——发现清扫语义缺陷 BUG-018
- **做了什么**：① qa 抓五份正式 fixture 入 tests/fixtures/（usgs×2/eonet/gdacs/ll2-list，README 登记抓取时间），后补 ll2-detailed；② dev 实现 usgs.ts/eonet.ts 并注册 T1_PROVIDERS（G-1 包围盒降维含合成样本自证）；③ qa 登记并测 M2-05（USGS 映射,19 用例）/M2-06（EONET 映射,16 用例）✅，FM-06 场景列回填；④ arch 依 fixture 出 G-2/G-3 提案（GDACS「人道响应字段」实测不存在;LL2 mode=list 实测无工位坐标）→ rev REV-008 放行并三裁：humanitarian 判类=eventtype∈{DR,FL}（方案A）、LL2 端点换 mode=detailed（预算不变）、R-1 过期语义登记 BUG-018 不捆绑;⑤ orch 应用 SPEC-5.3/5.5 全文替换（spec v0.2.2）+ pin，同步 M2-data.md §2.2 与 testplan M2-01 精确断言口径。
- **证据**：doc/evidence/v0.2.1/M2-05.log、M2-06.log（机械生成）；仲裁链 doc/design-prompt/proposal-gdacs-ll2.md → doc/review/REV-008-gdacs-ll2.md；lint+unit 全量 PASS。
- **问题**：**BUG-018（OPEN，rev 建议 M2 签核前闭合）**——store 清扫按事件 ts 判过期,EONET 长寿命 open 事件（fixture 实测 24/26 条真龄>72h）首轮 sweepExpired 即被误清,GDACS ts=datemodified 同根因;rev 倾向 Design Y（按最后见到时刻续期）,须走 §7:arch 提 SPEC-6.3 语义澄清 → rev pin → dev 改 store → qa 补真龄场景并复测 M2-02。
- **下一步**：① BUG-018 修复链（优先,EONET 已 live）;② dev 实现 gdacs.ts/ll2.ts（SPEC-5.3/5.5 已 pin,注意 GDACS UTC 解析陷阱）+ qa M2-07/08;③ qa 关 M2-01（四源齐后精确断言）;④ FM-07 标记层 + FM-08 矢量默认（首个可视化切片,完成后通知产品负责人验收）。


## [0.2.3] 2026-07-21 数据层收口——GDACS/LL2 落地,BUG-018/019 仲裁修复关单,FM-05/06 九场景全绿
- **做了什么**：① dev 实现 gdacs.ts/ll2.ts(照 v0.2.2 pin 的映射,UTC 陷阱处理),qa 登记并测 M2-07/08 ✅,新歧义 BUG-019(LL2 severity 方向性)由 qa 如实登记留白;② arch 出 SPEC-6.3 清扫语义提案 → rev REV-009 双仲裁放行(lastSeen 基准+不进 SPEC-6.1;BUG-019 裁「仅未来方向,net≤now→1」)→ orch 应用 spec v0.2.3+pin;③ dev 修 store/cache/index(lastSeen 内部记帐,upsertMany 增 now 入参)与 ll2 severityFromNet;arch 同步 M2-data DP 七处;④ qa 三卡串行:M2-02 按新语义改写复测、新增 M2-09 真龄清扫(EONET fixture 26 条 0 误清)、M2-08 补 net 已过去断言、M2-01 四源归一化一致性(16 用例含跨源 id 唯一)——**BUG-018/BUG-019 均复验关单(关单人≠修复人)**;⑤ orch 依 qa 观察扩充 BUG-010 观察面(day-night-calibration/zoom-range 同现高并发抖动)。FM-05/06 场景列齐:M2-01~09 全 ✅,全量单测 143 绿。
- **证据**：doc/evidence/v0.2.2/(M2-01/02/07/08/09、BUG-018、BUG-019 七份,均机械生成);仲裁链 proposal-expiry-semantics.md + proposal-gdacs-ll2.md → REV-008/REV-009;qa M2-08 卡全量 regress 三跑后全绿(regress_summary.txt)。
- **问题**：① e2e 高并发抖动观察面扩大(BUG-010 已扩充描述,待处置);② cache lastSeen round-trip 无自动化证据(代码走查依据,FM-09 开卡时补场景);③ M2-09 未覆盖 REV-009 §1.6 列的冷启动局部续期与滚动窗两检查点(FM-09 场景一并承接);④ 并行会话已落 grill 决议(D22 信任层门禁、D2/D4/D12/D14/D16 修订)与 RSS 竞品核查,M3 开卡须按 D22 前置信任层提案;doc/attachment/newsglobeworldmap.com.png 为并行工作遗留未跟踪文件,归属待其处理。
- **下一步**：FM-07 标记层+事件流面板(SPEC-3.4 回补/SPEC-7.4 联动分片/SPEC-3.7/3.8)与 FM-08 矢量默认风格——重大渲染模块,先 arch design-prompt → rev 门禁 → dev/qa;此为首个可视化切片,完成后 orch 起 preview 验收并通知产品负责人。其后 FM-09 缓存启动(承接遗留②③)、FM-10 顶栏+分类过滤、FM-11 性能基线。


## [0.2.4] 2026-07-21 视觉层前置就位——M2-globe DP 过门禁,SPEC-3.2a/2.2a 入 spec,M2-10~17 登记
- **做了什么**：① arch 交付 `design-prompt/M2-globe.md`(FM-07 标记层+面板 / FM-08 矢量默认),对外可见缺口规矩收敛为提案 P-1(矢量视觉参数)/P-2(面板列表行)/C(ASSETS 登记);② rev REV-010 六维门禁全过+四裁:P-1/P-2 裁准并给文本、SPEC-7.4 双向联动 M2 取全双向、R-8 边界成立(本卡不触 atmosphere);③ orch 应用 SPEC-3.2a(深色底 #0a1a2f/海岸线 #4db8ff/网格 #1e3a5f 30°/夜面辉光 #7fd4ff)与 SPEC-2.2a(分类色圆点+标题+相对时间、ts 倒序、空状态)入 spec v0.2.4+pin,DP 检查点 6/7 按 REV-010 §3.2/3.3 对齐;④ qa 两卡登记 M2-10~14(FM-07:分类色/severity 脉冲、instancing、不遮挡真标记+R-6、面板 300px、双向联动)与 M2-15~17(FM-08:矢量昼夜视觉、海岸线坐标对齐、卫星退默认),FM 场景列回填;⑤ 登记 BUG-020(REV-010 §3.1:FM-08 摘卫星默认后 M1-05/M1-14 e2e 将挂,FM-08 交付前须闭合,二选一方案已列)。
- **证据**：纯文档/spec 变更,无测试面;门禁链 M2-globe.md → REV-010-M2-globe-gate.md;docs-check 通过。
- **问题**：① BUG-020 悬,FM-08 卡必办;② M2-16/17 的测试可写性(海岸线数据结构可单测性、卫星不加载的静态断言)待 dev 实现后验证;③ BUG-011(证据跨双层)会影响 M2-10/12 跨层场景登记,沿既定口径留痕。
- **下一步**：dev 双卡——FM-07 标记层+面板+联动(REV-010 判定不被 P-1/P-2 阻塞,现已 pin 更无阻)、FM-08 矢量默认(含 BUG-020 二选一承接+ASSETS 登记);随后 qa 按 M2-10~17 接测;全绿后 orch 起 preview 截图,**通知产品负责人验收首个可视化切片**。


## [0.2.5] 2026-07-21 FM-08 矢量默认风格落地——M2-15/16/17 全绿,BUG-020 关单
- **做了什么**：① dev 实现矢量默认(coastline.ts+coastline-110m.json 76KB/vectorEarth.ts/shaders/vectorEarth.ts,SPEC-3.2a 取值逐条落地),GlobeScene 默认矢量、卫星退出首包(`?style=satellite` DEV/测试钩子=BUG-020 方案 a,orch 拍板),ASSETS.md 登记海岸线出处与卫星纹理天气包标注,tsconfig 加 resolveJsonModule;首包量测 800KB(gzip 224KB)含海岸线,远低于 2MB 预算;② dev 发现 atmosphere-glow 为同机制第三条受影响 e2e(等待门依赖卫星 uniform),纳入 BUG-020 范围;③ qa 卡一:三条 e2e 适配(M1-05/M1-14 挂 `?style=satellite` 卫星路径专属,atmosphere-glow 换风格无关稳定门 waitForSurfaceReady)、新增 satellite-lazy-load.spec(M2-17 ✅:默认 0 纹理请求/卫星路径 2 请求)、BUG-020 复验关单(全量 e2e 20 绿);④ qa 卡二:M2-15 ✅(vector-earth-style.spec:昼夜取样/辉光色相/过渡带,昼夜截图归档)、M2-16 ✅(海岸线投影对齐:几内亚湾窗口+东西经符号防镜像),辅助单测网格 30° 密度;测试基建扩展 findColorInRegion/setSunDirVector。全量 147 单测+23 e2e 绿。
- **证据**：doc/evidence/v0.2.4/(M2-15.log+昼夜双截图、M2-16.log、M2-17.log、BUG-020.log,均机械生成)。
- **问题**：① qa 提醒:夜面辉光「低强度」的实际观感需产品负责人过目(截图已归档,preview 验收一并看);② BUG-012 追加 M2-17 同类观察(行文标「单测」实为 e2e,与 M1-04 同口径待订正,状态位未动);③ M2-15 采样安全区推导依赖 SPEC-3.1 相机参数,spec 若改需复核头注。
- **下一步**：dev FM-07(标记层+事件流面板+双向联动,src/globe+src/ui);qa 按 M2-10~14 三卡接测;全绿后 orch preview 截图,通知产品负责人验收。


## [0.2.7] 2026-07-21 orch UX 验收开缺陷线,BUG-022 修复,M2 签核驳回整改开动
- **做了什么**：① orch 实测 v0.2.6(preview+Playwright 六机位截图)登记 BUG-022~027(叠色发白/微震噪声/排序反直觉/行无severity/占位符泄漏/品牌名),截图 doc/attachment/ux-review-20260721/;② rev REV-011 **驳回 M2 签核**——FM-09/10/11 三行从未开卡,五条 M2 强制 SPEC 子句零覆盖(`make next` 只数已登记场景,误报「可签核」,登记 BUG-028);整改:qa 登记 M2-18/19(FM-10 顶栏/过滤),BUG-027 orch 裁定并入 FM-10(依 spec M2 归属),BUG-010 限 M2 内关;③ dev 修 BUG-022:markers.ts 脉冲环 AdditiveBlending→NormalBlending,重叠恒收敛于分类色不再饱和成白,FIX_READY 待 qa 复验;④ 产品侧同日:D24(视觉分层 LOD)/D25(审美验收官)决议,调研 aesthetic-agent/map-lod 两份入库,spec 提案 stream-order/event-noise-severity 两份入库待 REV-012 仲裁,新增 aes 角色卡+/aes-review skill。
- **证据**：dev 自检 test-results/(lint/unit_markers/e2e_marker 均 PASS;BUG-022 关单证据待 qa 复验机械生成);doc/evidence/v0.2.6/regress_summary.txt(REGRESS=1,100% PASS,驳回前归档仍有效)。
- **问题**：① M2 缺口:FM-09/FM-11 未开卡,M2-18/19 已登记未实现;② REV-012 仲裁进行中(SPEC-2.2a 排序+行编码、SPEC-5.1 门槛、新增 SPEC-5.0a);③ 中国区地图合规(审图号/境内服务器)与零服务器结构冲突,待用户拍板(map-lod §3);④ 跨分类重叠呈中间色,根治靠 D23 聚合(另案)。
- **下一步**：qa 登记 FM-09→FM-11 场景;qa 复验 BUG-022 关单(关单人≠修复人);dev 实现 FM-10(M2-18/19,连带 BUG-027/014);REV-012 回收后 orch 应用+pin,派 dev/qa 落排序与门槛;aes 首张制定卡(D24 配色层次+昼夜对比);全部补齐后重跑 REGRESS=1+重新签核。

## [0.2.6] 2026-07-21 FM-07 收口——标记层+面板+双向联动全绿,BUG-021 修复关单
- **做了什么**：① dev 实现 FM-07:src/globe/markers.ts(双层 InstancedMesh 分类色/severity/脉冲/id-diff/拾取)、src/ui/EventPanel.tsx+GlobeStage.tsx(300px 可折叠面板+React↔three 桥接),App 接线 createDataLayer——真实事件首次上球;② qa 三卡串行:M2-10/11 ✅(六分类色+severity 视觉四截图、instancing 恒 2 对象;e2e 网络拦截解决真实轮询与注入事件抢入口)、M2-12 ✅(大气不遮挡**真标记**像素断言+辉光峰值机械钉边,R-1/R-6 欠账还清)、M2-13 ✅(面板三要素/倒序/空态)+**M2-14 如实 ❌ 登记 BUG-021**(首帧零实例空包围球缓存致 raycast 恒 null,marker→list 100% 失效,行级根因);③ dev 一行外科修复(setEvents 末尾失效缓存),qa 独立复验+补 >256 扩容拾取边界用例,M2-14 ✅、BUG-021 CLOSED。**M2 十七场景全 ✅,全量 159 单测+34 e2e 绿**。
- **证据**：doc/evidence/v0.2.5/(M2-10 四截图、M2-11/12/13/14、BUG-021,均机械生成)。
- **问题**：① M1-07 的 atmosphere-glow 沿用旧 setSunDir 钩子,矢量三材质未全同步(qa 留痕技术债,不影响该场景断言对象);② rings 包围球同机制隐患(无 raycast 依赖,留痕不修);③ M2-10 脉冲幅度量测为合并包围盒代理,拆分量测待未来需要时再建。
- **下一步**：orch preview 验收+截图通知产品负责人(本切片即办);其后 M2 收尾三件:FM-09 缓存启动(承接 cache round-trip/冷启动局部续期/滚动窗检查点)、FM-10 顶栏+分类过滤、FM-11 性能基线;再全量 regress+签核走 M2 三硬条件。


## [0.2.8] 2026-07-21 REV-012 三条 spec 落地——噪声门槛/排序语义/severity 编码,台账同步
- **做了什么**：① orch 依 REV-012 应用三条 spec 文本并 pin(v0.2.8 修改记录):新增 SPEC-5.0a 呈现门槛通则(亚门槛不入球不入流,球/列表共用呈现集);SPEC-5.1 换 USGS M2.5+ 显著性 feed(源侧门槛,BUG-023);SPEC-2.2a 合并替换(排序改「距 now 邻近度升序」BUG-024 + severity 三档单调非色相编码 BUG-025,造型值待 D25);② testplan 同步:M2-05/M2-13 判据改写、✅ 回退 🔲 重测(REV-012 合法性核验:判据经合法 spec 修改而变,原证据旧契约下取得);新增 M2-22(排序邻近度,M2 门槛)、M3-01(severity 单调不变量 B,D25 批次,定值前禁 ✅——与 pin 同切片登记满足 REV-012 §3.6 硬条件);③ feature-matrix:FM-05 补 SPEC-5.0a、FM-07 挂 M2-22/M3-01、FM-09 回填 M2-20/21(qa 已登记缓存启动/呼吸过渡场景)、FM-10 回填 M2-18/19(前一切片)。
- **证据**：本切片纯 spec/台账应用,无新测试证据;裁决依据 doc/review/REV-012-stream-spec-arbitration.md §5/§6 逐字应用。
- **问题**：① M2-05/M2-13 回退后 M2 待测场景 6 条(05/13/18/19/20/21)+M2-22 共 7 条;② dev 尚未实现:USGS 端点切换、排序比较器、FM-09/10 全部、severity 编码(后者等 D25);③ FM-11 尚未开卡(性能基线,M2 最后一行);④ DP 同步(M2-globe/M2-data)待 arch,BUG-010 抖动待 qa,BUG-022 复验进行中。
- **下一步**：dev 卡一(USGS 2.5 feed+排序比较器,连带 M2-05/22 可测)、dev 卡二(FM-10 顶栏+过滤)、dev 卡三(FM-09 缓存启动+呼吸过渡);qa 跟测各卡;FM-11 qa 登记;aes 视觉方案回收后走 arch→rev 二次入 spec;全绿重跑 REGRESS=1+重签核。


## [0.2.9] 2026-07-21 BUG-022 独立复验关单,BUG-023/024 FIX_READY 回填
- **做了什么**：① qa 独立复验 BUG-022(关单人≠修复人):新增 e2e/marker-overlap-blending.spec.ts(12 个同点位 disaster 断言重叠中心可归属分类色且无近白像素,近白阈值 190 从 SPEC-3.7 推导;另跨分类对照点)+ globeDebug.ts 补 countNearWhite 辅助;**判别力验证**——临时还原 AdditiveBlending 后测试如期 FAIL(1001 近白像素),复原后 PASS,证明测试非空转;make evidence BUG=BUG-022 机械关单 CLOSED。② orch 依 dev 交付回填 BUG-023/024 → FIX_READY(usgs.ts 端点切换/EventPanel 排序比较器,src 改动随下切片入库),待 qa 按 M2-05/M2-22 测绿复验关单。
- **证据**：doc/evidence/v0.2.8/BUG-022.log + BUG-022-marker-overlap-blending.png(修复后双簇无白斑)。
- **问题**：① qa M2-05/22 已交卡(双 ✅,166 单测全绿),其 src/tests/testplan 文件随下切片 v0.2.10 入库,本切片不含;② arch 视觉批次一提案在途;③ 复验期间树上有并行未提交 src 改动,qa 已核实不影响像素断言结论,留意并发写树。
- **下一步**：qa M2-05/22 交卡后大切片提交(dev src+qa tests+fixtures+证据,v0.2.10)并复验关单 BUG-023/024;随后 dev FM-10 顶栏、dev FM-09 缓存启动、qa BUG-010 抖动处置;arch 视觉提案→rev 仲裁→应用;全绿 REGRESS=1+重签核。


## [0.2.10] 2026-07-21 USGS 噪声门槛+排序邻近度落地——M2-05/22 ✅
- **做了什么**：① dev(前一卡)实现随本切片入库:src/data/providers/usgs.ts 端点切换 2.5_day/2.5_hour(SPEC-5.1,源侧兑现 M≥2.5 门槛,无客户端过滤)、src/ui/EventPanel.tsx 排序比较器改三级键(ts 与 now 绝对时间差升序/等距未来优先/id 升序,SPEC-2.2a);② qa 独立实例:tests/usgs.test.ts 按新判据重写(端点+2.5 样本映射+severity 含 [2.5,4.5) 内点)、新建 tests/event-panel-sort.test.ts(react-dom/server 真实渲染面板读回行序,判据五点:混合/全未来/全过去/tie-break/空态)、新 fixture usgs_2.5_day.json(真实 curl 抓取 2026-07-21T03:20:15Z,52 features,fixtures/README 登记);M2-05/M2-22 双 ✅(make evidence 机械回填);全量 166 单测零红。
- **证据**：doc/evidence/v0.2.8/M2-05.log、M2-22.log(目录名为生成时版本位,属机械行为)。
- **问题**：① BUG-023/024 仍 FIX_READY——待独立 qa 以证据机械关单(下一卡);② 旧 fixture usgs_all_hour/all_day.json 已无测试引用,保留不删(历史样本);③ severity 3 档无真实样本(当日无 M≥6 地震),由构造输入覆盖,属判据设计而非漏测。
- **下一步**：qa 复验关单 BUG-023/024;dev FM-10 顶栏+过滤(串行,避免与复验并跑写树);dev FM-09;BUG-010 处置;arch 视觉提案→rev;全绿 REGRESS=1+重签核 M2。


## [0.2.11] 2026-07-21 FM-10 顶栏+六分类过滤落地——M2-18/19 ✅,品牌统一 Worlens
- **做了什么**：① dev 实现 FM-10:src/App.tsx 顶栏(品牌名 Worlens/UTC 时钟每秒 getUTC* 刷新/六分类开关 data-category+aria-pressed,分类色取 markers.CATEGORY_COLORS 同源)、App 层 Set 过滤接缝(visibleEvents 同喂标记层与面板,store/data 零改动)、移除「行情 ticker(M3)」占位,index.html title 统一 Worlens;② qa 独立实例:新增 e2e topbar-brand-clock(4 用例,含 UTC 语义环绕容差)与 category-filter(4 用例,像素级验证标记+列表两处同步,含空集),smoke 标题断言按 SPEC-2.1 对齐;M2-18/19 ✅ + M0-02 复登 ✅(判据经 orch 依 SPEC-2.1/REV-011 同步);全量 e2e 43/43 一次过(8 workers,BUG-010 未触发);③ orch 回填 BUG-026/027 FIX_READY。
- **证据**：doc/evidence/v0.2.10/M2-18.log、M2-19.log、M0-02.log+M0-02-smoke.png(均机械生成)。
- **问题**：① M2-19 的 conflict/news/launch/flight 四类仅 DOM 级验证(M2 无该四类信源),事件级过滤用例待 M3 有源后补;② 标记侧判据用分类色像素搜索而非 InstancedMesh.count(高水位不回退,方法选择已注释);③ REV-013 视觉仲裁已回(11 准 1 驳,三硬条件:5/6 绑定、亮度定义 pin、近景网格占位),应用为下一切片。
- **下一步**：qa 复验关单 BUG-026/027 + BUG-014 核对记录(流程类口径);orch 应用 REV-013 条文+pin+testplan 同步(v0.2.12);dev FM-09(缓存启动+呼吸过渡)→ qa 测 M2-20/21;dev 视觉批次一实现 → aes 新实例验收;FM-11 量测;BUG-010/028;REGRESS=1+重签核。


## [0.2.12] 2026-07-21 缺陷线收口:BUG-026/027 机械关单,BUG-014 流程口径关单,登记 BUG-029
- **做了什么**：① qa 复验关单 BUG-026/027(独立实例):核对 v0.2.11 修复落地,e2e/topbar-brand-clock.spec.ts 补「顶栏不含行情占位文本」最小断言(引 SPEC-2.1+BUG-026),make evidence 机械关单;② qa 独立核对 BUG-014(流程类,§5.3-4 口径):SPEC-2.1 UTC 时钟三方互指(FM-10↔M2-18↔证据)闭环成立,顺带核对 SPEC-2.x 全部子句认领面,核对记录入证据库,orch 依记录置 CLOSED;③ 核对发现同构新遗留登记 BUG-029:SPEC-2.2「全屏地球 canvas」子句无场景显式认领(M0-02 只断言非零),期望 M2-13 重测卡承接。
- **证据**：doc/evidence/v0.2.11/BUG-026.log、BUG-027.log(机械生成)、BUG-014-verification.md(独立核对记录)。
- **问题**：① BUG-029 待 M2-13 重测卡承接;② REV-013 视觉条文尚未应用(下一切片);③ UX 验收七单(022~028)已关五,余 025(等视觉实现)/028(工具盲区,重签核前修)。
- **下一步**：orch 应用 REV-013 条文+pin+testplan 同步(v0.2.13);dev FM-09(缓存启动+呼吸过渡,已派)→ qa 测 M2-20/21(连带 M2-13 重测+BUG-029 承接);dev 视觉批次一实现 → aes 新实例验收;FM-11 量测;BUG-010/028;REGRESS=1+重签核。


## [0.2.14] 2026-07-21 FM-09 缓存优先启动+呼吸过渡落地——M2-20/21 ✅
- **做了什么**：① dev:src/globe/markers.ts 过渡状态机(slotAlpha/slotTarget,tick 按真实毫秒推进;新增渐亮、移除渐隐后释放槽、复活同槽不闪断、冷启动缓存 snap 不淡入;rings 取尺寸×alpha 耦合避免第二透明混合面;pick 跳过淡出槽);缓存链路核对结论:现有 start() 顺序已满足 SPEC-3.11,零改动。② qa(重派实例,前一实例配额中断):tests/cache-first-start.test.ts(内存 IDB 替身+永不 settle fetch 桩,三分支:缓存先于网络上屏/无缓存不阻塞/读失败不抛)、e2e/marker-breathing-transition.spec.ts(instanceAlpha 逐帧采样+分类色像素+截图,补 SPEC-3.8 不整表/SPEC-7.5 时间驱动推导断言)、globeDebug 补只读 helper;M2-20/21 ✅;全量 169 单测+9 marker e2e 零回归。③ dev 上报 SPEC-3.11 歧义已登记 BUG-030(无缓存首批 snap/淡入,断言范围已规避,待 rev 仲裁)。
- **证据**：doc/evidence/v0.2.13/M2-20.log、M2-21.log+M2-21-m2-21-mid-late.png(过渡中态:新点渐亮/旧点渐隐/存量满态)。
- **问题**：① SPEC-7.5 严格帧率无关性仅代理断言(e2e 无法变帧率,残留缺口非判据要求);② M2-20 用手写 IDB 替身,cache.ts 扩 API 时需同步;③ 用户反馈已落 D27~D29+BUG-031/032(常驻脉冲否决/面板让位/开源优先/矢量精度),动效批与布局批待启。
- **下一步**：dev 视觉批次一实现(SPEC-3.2a 色值+衰减+网格隐藏、SPEC-3.7 分层、SPEC-2.2a 行明度、SPEC-2.2/3.5 相对契约)→ qa 重测 M2-15/13+新场景 M3-02~05 → aes 新实例验收;FM-11 量测;BUG-010/028;aes 动效批调研(BUG-031);REGRESS=1+重签核。

## [0.2.13] 2026-07-21 REV-013 视觉批次一条文落地——色值体系/昼夜对比契约/severity 分层入 spec
- **做了什么**：orch 依 REV-013 应用 11 项裁准条文并 pin(v0.2.13 修改记录):SPEC-3.2a 前言自洽修订+底面两端 pin `#1f4468`/`#0d1827`+海岸线降饱 `#6690b3`(解 news 撞色)+经纬网默认隐藏+夜面辉光 `#3a5a72`+新增昼夜对比契约([1.8,2.6] 主判据/≥1.3:1 副判据);SPEC-3.2① 补昼半球连续衰减(C-3:与对比契约绑定,rev 复算平涂 luma 比 2.76 超上限故不可分拆);SPEC-3.7 补 severity 明度/饱和/发光三通道分层(乘子规则权威、六类 hex 派生参考);SPEC-2.2a 填 D25 留白(标题明度三档+行首点镜像);SPEC-3.5/2.2 各加最小相对亮度契约(rev 改文)。改动 8(脉冲随新鲜度)驳回另开动效批。testplan 同步:M2-15 回退 🔲 重测(新色值),M2-13 判据澄清(只断不变量 A),M3-01 补全转可测,新增 M3-02(昼夜对比,C-2 量测方法定死)/M3-03(标记分层)/M3-04(星空)/M3-05(面板)/M3-06(近景网格占位,C-1);FM-07 场景列挂 M3-02~06。
- **证据**：本切片纯 spec/台账应用;裁决依据 doc/review/REV-013-visual-batch1-arbitration.md 逐字应用(11 准 1 驳,C-1/C-2/C-3 硬条件均落地)。
- **问题**：① M2-15 回退后 M2 硬门槛待测 = M2-13/15/20/21/23/24 六条;② dev 视觉批次一实现未派(等 FM-09 dev 交付避免 markers.ts 并发);③ M3-02~05 即刻可测但归 D24/D25 批次,勿挂 M2 门槛;④ 动效批(脉冲新鲜度+reduced-motion)择期另立。
- **下一步**：FM-09 dev 交付后 → qa 测 M2-20/21(连带 M2-13 重测+BUG-029 承接);dev 视觉批次一实现(shader 色值/衰减/标记分层/面板)→ qa 测 M2-15+M3-02~05 → aes 新实例 /aes-review 验收;FM-11 量测卡;BUG-010/028;REGRESS=1+重签核 M2。


## [0.2.16] 2026-07-21 M2-15/13 重测双绿+REV-014 冷启动 snap 消歧入 spec——预告红清零
- **做了什么**：① qa 重测卡:e2e/vector-earth-style.spec.ts 按 v0.2.13 pin 重写(3 预告红→3/3 PASS,删与 SPEC-3.2① 衰减契约矛盾的旧「昼侧均匀性」断言,衰减比值归 M3-02;网格判据因 `#1e3a5f` 落在衰减输出容差内改黑盒断言线层 visible),e2e/event-panel.spec.ts 补 canvas 占满视口+面板悬浮不挤占(承接 BUG-029)+圆点色相断言与不变量 A+排序判别用例,M2-15/M2-13 双 ✅(M2-13 行文同步补 BUG-029 子句,属覆盖补齐)。② rev 仲裁 BUG-030:REV-014 三维度一致裁定读法 a——无前态首批 snap 上屏不淡入,呼吸只表达增量;orch 应用 SPEC-3.11 消歧句并 pin(v0.2.16),现实现零改动,M2-20/21 维持 ✅。③ 台账:BUG-030 置 FIX_READY(待 qa 新登 snap 场景机械关单)、BUG-032③ 复核标注已兑现(余①②归视觉第二批)、BUG-033 新登记(evidence.py VISUAL_MARKERS 把 M2-13 行文中「视觉批次」交叉引用误判为视觉场景强索截图,BUG-008 预警残留兑现)、BUG-010 观察面再扩(marker-breathing 纳入负载敏感 flake 家族)。④ D27 补光柱视觉参照(用户拍板:《流浪地球》行星发动机式体积光柱,aes 动效批以此为形态基准)。
- **证据**：doc/evidence/v0.2.15/M2-15.log+M2-15-vector-earth-day.png、M2-13.log+M2-13-event-panel-canvas-layout.png(均 make evidence 机械生成);全量 e2e 46/47(唯一红 marker-breathing 单跑 PASS,已记 BUG-010);lint PASS;REV-014 记录 doc/review/REV-014-cache-snap-arbitration.md。
- **问题**：① M2 开口余 M2-23/24(FM-11 量测)+REV-014 §4-3 要求的 snap 新场景;② BUG-033 使非视觉场景被强索截图,dev 修 evidence.py 时与 BUG-028(docs.py FM 行零场景检查)可并卡,但须避开 qa 用 evidence 的时段;③ M3-02 采样角敏感风险仍在(dev 自验 ±40°=2.03,若量测几何取值不同可能触 1.8 下界,落值可微调 DAY_FLOOR);④ aes 验收与 M3-02~05 未做。
- **下一步**：qa 卡:新登 M2-25 snap 场景+测绿+BUG-030 关单;qa 卡 M3-02+03、M3-04+05;aes 新实例 /aes-review 验收(对照截图给用户);qa FM-11 量测(M2-23/24);dev 卡 BUG-028+BUG-033(scripts,串行窗口);BUG-010 qa 处置;REGRESS=1+M2 重签核(新 rev 实例)→ tag。

## [0.2.15] 2026-07-21 视觉批次一实现落地——色值/连续衰减/severity 分层/面板明度上球
- **做了什么**：dev 视觉批次一实现卡交付(6 个 src 文件):① shaders/vectorEarth.ts 昼半球离日角连续衰减(SPEC-3.2①,dayFalloff=0.25+0.75·t²,数值自验主判据 ±40° 昼:夜=2.03∈[1.8,2.6]、副判据 1.36≥1.3);② vectorEarth.ts 底面两端显式 pin `#1f4468`/`#0d1827`+海岸线 `#6690b3`+夜辉光 `#3a5a72`+经纬网默认隐藏(grid.visible=false,构建/dispose 保留待 LOD);③ markers.ts 新增 deriveSeverityColor(从 CATEGORY_COLORS 按 SPEC-3.7 乘子 sRGB-HSL 派生,不硬编码;六类派生值与 spec 表逐字核对全对)+ringSize 助手(sev1 无环/sev2 静态环/sev3 脉冲,脉冲机制未动待动效批);④ EventPanel.tsx 行首点镜像派生色+行 severity class;⑤ index.css 标题明度三档 `#eef2f7`/`#c2ccd8`/`#8794a3`(走 li class+CSS,避开 event-panel-sort 正则、贴 category-toggle--on 惯例);⑥ starfield.ts 逐星亮度分布,最亮星 luma≈114 < 海岸线≈138(SPEC-3.5)。
- **证据**：本切片为 dev 实现自检:lint PASS+全量 169 单测绿(test-results/lint.log、unit_all.log);e2e severity 专项(色匹配+尺寸/脉冲递增)PASS;`vector-earth-style` 3 红=旧断言(旧色值+昼侧均匀性,与新衰减契约直接冲突)——**预告红,dev 未动测试**,归 qa 重写;marker-breathing 并行下时序 flake,单跑 PASS。场景证据(M2-15 重测+M3-02~05)未登记,归下会话 qa 卡。
- **问题**：① M2-15/M2-13 重测卡未派,M3-02~05 未测,aes 验收未做——本会话按用户指令到 dev 回归即收尾;② 主判据采样角敏感:dev 按 ±40° 调到 2.03,若 qa 量测取 ~30°(t=0.5)比值 ~1.77 可能触 1.8 下界,采样几何以 M3-02 定死的方法为权威,落值可微调 DAY_FLOOR;③ 海岸线共用衰减 shader,非次日点昼侧采样读到压暗值(物理合理,昼端 pin 不变);④ 面板仅满足 SPEC-2.2 亮度契约,DP §5 实底 `#0c1622`/去玻璃属自由度未动,留 aes 验收判断;⑤ marker-breathing e2e 并行 flake 与 BUG-010 同类,qa 侧关注采样稳健性。
- **下一步**：qa 重测 M2-15(按新 pin 重写 vector-earth-style,去旧均匀性断言)+M2-13(承接 BUG-029 canvas 断言)+M3-02~05 → aes 新实例 /aes-review 验收(出对照截图给用户);FM-11 量测卡(M2-23/24);BUG-010 关单、BUG-028 修 docs.py、BUG-030 rev 仲裁;aes 动效批调研(BUG-031/D27 常驻脉冲存废+光柱候选);布局批(D28 面板让位);矢量精度批(BUG-032,D29 开源方案+D24 LOD+D26 国界口径);REGRESS=1+M2 重签核(新 rev 实例)→ tag。


## [0.2.17] 2026-07-21 M2-25 snap 场景落地+BUG-030 机械关单——SPEC-3.11 消歧句有测认领
- **做了什么**：qa 卡:① doc/testplan.md 新登 M2-25(标记层首批 snap 对照增量淡入单测,承接 REV-014 §4-3 防蒸发),feature-matrix FM-09 场景列同步回填;② tests/marker-initial-snap.test.ts 新增(断言 A:无前态首个非空批次 instanceAlpha 初值即满值非从 0 起坡;断言 B 对照:有前态后新增标记从 0 经 tick 坡向 1;期望从 SPEC-3.11 消歧句+SPEC-3.2①+D27 推导,未照抄实现),测绿置 ✅;③ BUG-030 以同一测试 log 机械关单(关单人 qa ≠ 修复人 orch)。行文按 BUG-033 教训规避 VISUAL_MARKERS 误判词。
- **证据**：doc/evidence/v0.2.16/M2-25.log、BUG-030.log(均 make evidence 机械生成);全量单测 22 文件 171 测试零红(test-results/unit_all.log);docs-check OK。
- **问题**：① 观测通道走 dots InstancedMesh 的 instanceAlpha 属性与槽位分配顺序假设(newSlot=1),shader attribute 改名/分配策略变化时测试需同步维护——错位会显式 FAIL 不会假绿,属可控实现耦合;② 首批 pop 观感是否突兀归 aes 另案(REV-014 §2 边界声明),不在本场景;③ M2 开口仅余 M2-23/24(FM-11)。
- **下一步**：qa 卡 M3-02+03(注意采样几何以 C-2 定死方法为权威,若触 1.8 下界属实现落值问题登缺陷)、qa 卡 M3-04+05;aes 新实例 /aes-review 验收(对照截图给用户);qa FM-11 量测(M2-23/24);dev 卡 BUG-028+BUG-033(scripts 串行窗口);BUG-010 qa 处置;REGRESS=1+M2 重签核(新 rev 实例)→ tag。


## [0.2.18] 2026-07-21 M3-02/03 视觉契约实测双绿——昼夜对比与 severity 三通道有测锚定
- **做了什么**：qa 卡实测视觉批次一两大契约场景:① M3-02 昼夜对比(e2e/day-night-hemisphere-contrast.spec.ts 新增):C-2 定死方法落地——±40° 对称采样、Rec.709 luma 直接加权、亮像素排除阈值 90(注释定稿)、采样几何用「同一均匀底面点在对称 sunDir 下两次采样」等价实现+method-sanity 断言;主判据落 [1.8,2.6]、副判据 ≥1.3 均过,未触下界(dev 落值经权威几何验证站住)。② M3-03 severity 三通道(e2e/marker-severity-tri-channel.spec.ts 新增):取 REV-013 §3.1 路径 b,三色相族×三档逐通道 ±6/255、色相不变量 ±2°、L/S 单调、发光通道黑盒读环实例缩放(sev1 恒 0/sev2 静态波动<3%/sev3 脉冲波动>15%,按累计真实毫秒推进防 flake)。globeDebug 增两 helper。qa 自设的 sev1 像素计数下限 40→20 属测试基建阈值自调,非判据变更。
- **证据**：doc/evidence/v0.2.17/M3-02.log+M3-02-day-night-hemisphere-contrast.png、M3-03.log+两张截图(三档分层+发光对照);全量 e2e 49/50(唯一红 marker-breathing 隔离复跑绿,与 BUG-010 已登记条目逐字吻合,不另开单);lint PASS。
- **问题**：① M3-02 采样等价性依赖「矢量底面空间均匀」前提,底面引入纹理/噪声时须改真实异地采样(注释已声明);② M3-03 发光断言耦合 rings 结构假设,改动会显式 FAIL 非假绿;③ 低饱和分类色相反解噪声大,现三类均高饱和未触边界;④ BUG-010 家族 flake 又复现一次(marker-breathing)。
- **下一步**：qa 卡 M3-04+05(星空封顶+面板暗于球);aes 新实例 /aes-review 验收(对照截图给用户);qa FM-11 量测(M2-23/24);dev 卡 BUG-028+BUG-033(scripts 串行窗口);BUG-010 qa 处置;REGRESS=1+M2 重签核(新 rev 实例)→ tag。


## [0.2.19] 2026-07-21 M3-04/05 相对亮度契约双绿——星空封顶+面板暗于球
- **做了什么**：① qa 卡:M3-04(e2e/star-brightness-cap.spec.ts 新增,默认+旋转两组代表性机位,左侧 12% 窄条采样排除大气辉光伪高读数,实测最大 luma 83/95 远低于海岸线阈值 137.6)、M3-05(e2e/panel-brightness-cap.spec.ts 新增,量测口径=面板 CSS 声明底色 RGB 而非合成后像素——spec 将实底/玻璃列为实现自由度,合成像素随叠加位置浮动非契约量,口径引 REV-013 §5.3 同法);两场景 ✅,globeDebug 增 maxLumaInRegion。② orch 回填 BUG-025 至 FIX_READY(spec 侧 v0.2.8+v0.2.13 pin、实现侧视觉批次一 v0.2.15 均已落地,机械复验锚定 M3-01)。
- **证据**：doc/evidence/v0.2.18/M3-04.log+png、M3-05.log+png;全量 e2e 52 例 51 绿(唯一红=BUG-010 家族 marker-breathing,隔离复跑绿);lint PASS。
- **问题**：① M3-04「任意机位」e2e 只取两组代表性采样,穷举不可行(测试注释已声明);② M3-05 折叠态共享同一 background 声明未单独断言;③ M3-05 口径(CSS 声明色 vs 合成像素)属 qa 明确设计选择,如需变更走口径讨论非缺陷;④ 视觉批次一机械场景仅余 M3-01(行明度三档,BUG-025 关单锚点)。
- **下一步**：并行:qa 卡 M3-01+BUG-025 关单、aes 新实例 /aes-review 验收(对照截图给用户);其后 qa FM-11 量测(M2-23/24)、dev 卡 BUG-028+BUG-033(scripts 串行窗口)、BUG-010 qa 处置、REGRESS=1+M2 重签核(新 rev 实例)→ tag。


## [0.2.20] 2026-07-21 M3-01 收口+AES-001 验收放行——视觉批次一全绿闭环,BUG-025 关单
- **做了什么**：① qa 卡:M3-01(e2e/event-row-severity.spec.ts 新增)——标题明度三档单调+对面板底 WCAG 对比全档 ≥4.5:1 AA(实测 5.7~17.7:1)+圆点镜像 severity 分级(色相恒定/明度饱和取 SPEC-3.7 值),✅;BUG-025 机械关单(关单人≠修复人)。② aes 验收(AES-001,与制定不同实例):**放行**——无 Blocker/High,Medium×4/Nit×3 均属已归批次项(晨昏 signature/severity 环形态归 D27 动效批、密集聚合归第二批 D23、「多新」静止态编码归 D27);「做对了什么」八条含夜面辉光 `#3a5a72` 修复历史偏淡关注点、黑名单#1 深底红点 default 被破除、双真实态取证(137 枚当日事件+环太平洋震群压力位)。20 张机位矩阵截图入 doc/attachment/aes-20260721-visual-batch1/(移动档缺省已注明)。无需 arch 落 spec、无需新开 bugs。
- **证据**：doc/evidence/v0.2.19/M3-01.log+截图、BUG-025.log;全量 e2e 54/54(本轮零 flake);doc/review/AES-001-visual-batch1-acceptance.md。
- **问题**：① M3-01 圆点镜像仅 disaster 一类实测(fixture 限制),跨分类通用性由 M3-03 球面侧覆盖+同一派生函数,列表侧全六类为可疑未定性缺口(qa 未开单,非判据要求);② aes 判据演进建议两条(signature 弹性判据/层次 vs 形态质感区分)待动效批时采纳;③ M2 开口仅余 M2-23/24(FM-11)。
- **下一步**：aes 对照截图送用户过目;qa FM-11 量测卡(M2-23/24,M2 最后开口);dev 卡 BUG-028+BUG-033(scripts 串行窗口);BUG-010 qa 处置;REGRESS=1+M2 重签核(新 rev 实例)→ tag;动效批(BUG-031/D27 光柱参照)与视觉第二批(BUG-032/D24 LOD)择期立项。


## [0.2.21] 2026-07-21 FM-11 基线落地+缓存生命周期双缺陷闭环——M2 场景全绿
- **做了什么**：① qa FM-11 卡:M2-23(tests/build-budget.test.ts,首包 raw 810.7KB/gzip 225.1KB 入证据,卫星纹理 2.54MB 物理隔离不计首包)、M2-24(e2e/cold-start-perf.spec.ts,冷启动→可交互 ~300ms、缓存上屏 ~200ms、帧率 ~61fps,vite preview 生产服基线,门禁留 M5),双 ✅——**M2 全部场景就此全绿**;vite.config.ts 补 test.reporters 修 vitest 非 TTY 不回显 console 问题。② 量测中挖出 BUG-034(StrictMode 双调用下 stop() 在 cache.load 未 settle 时空快照覆写 IndexedDB,数据丢失级,dev server 100% 复现、production 不受影响):dev 修复(cacheLoaded 闸门)→ qa 判别力核查复验关单;复验扩检查点又挖出 BUG-035(早停实例晚到 load 翻闸门,二次 stop 复活覆写):dev 修复(闸门翻转收进 !stopped 块)→ 新 qa 实例判别力核查复验关单。两缺陷均 CLOSED,每层有故意红复现测试钉住后修绿。③ BUG-010 第三轮观察面扩充(高并发下 marker-severity-tri-channel 新增像素误读一例)。
- **证据**：doc/evidence/v0.2.20/M2-23.log、M2-24.log、BUG-034.log、BUG-035.log(均机械生成);全量单测 179/179、lint PASS;判别力核查两轮(还原修复→红,恢复→绿,diff 逐字节一致)。
- **问题**：① BUG-035 遗留可选加固点:正常实例重复 stop 属幂等重复写非数据丢失,未补断言(qa 判定非阻塞);② e2e 层 StrictMode 真实浏览器检查点未做(成本高,列遗留);③ M2-24 数值系本机 vite preview,M5 须按真实验收环境重测;④ 全量 e2e 高并发 flake(BUG-010 家族已扩至 3 例)是 REGRESS 100% 的直接威胁,签核前必须处置。
- **下一步**：dev 卡 BUG-028+BUG-033(scripts 修复窗,期间不派用 evidence 的卡);qa 卡 BUG-010 flake 家族治理(负载敏感断言加固);REGRESS=1+M2 重签核(新 rev 实例)→ tag;动效批(BUG-031/D27)与视觉第二批(BUG-032/D24)待 M2 关后立项。


## [0.2.23] 2026-07-21 BUG-010 flake 家族治理+三缺陷收官——e2e 稳定性达标,签核前置全清
- **做了什么**：① qa BUG-010 治理卡(限额中断,orch 回收核对补验):8 个 e2e spec 负载敏感采样加固(idle-spin/day-night-calibration/zoom-range/drag-inertia/marker-breathing/marker-severity-tri-channel/panel-marker-linkage)+globeDebug 新增 125 行稳健采样 helper,断言强度未降;BUG-010 置 CLOSED 挂机械证据(全量 e2e 绿 log)。**中断实例未交汇报,orch 依纪律不采信其口头压力轮次,自行补跑两轮全量 e2e(默认 8-worker)均 PASS——合计三轮全并发绿,关单核验成立**;docs-check OK、bugs.md 表未损坏。② orch 依核对记录(doc/evidence/v0.2.22/BUG-028-033-verification.md,独立 qa 正反两向+判别力抽查全 PASS)置 BUG-028/033 CLOSED。
- **证据**：doc/evidence/v0.2.22/BUG-010.log(机械生成)、BUG-028-033-verification.md;orch 补跑 test-results/e2e_all.log 两轮 PASS。
- **问题**：① 中断实例的 e2e 改动逐行审查未做(diff 251+/57-),数量大但三轮全绿+断言可跑通,残余风险留 M2 重签核 rev 审查兜底;② BUG-036(判据齐备提示无时效校验)未修,本轮签核显式重跑 REGRESS 规避;③ 未关缺陷余 8 条,均 M3+/工具债性质(011/012/013/015/016/017/029/031/032/036),无 M2 阻塞项。
- **下一步**：显式 make regress → make evidence REGRESS=1 → rev 新实例 M2 签核卡(三硬条件核对+signoff-M2.md)→ orch 打 tag。其后 M3 立项:D22 信任层 spec 前置、BUG-017 OpenSky 仲裁、BUG-016 flight-60s 场景登记、动效批(BUG-031/D27 光柱)与视觉第二批(BUG-032/D24)。
- **签核追记(同日)**：regress 三层全 PASS(doc/evidence/v0.2.23/regress_summary.txt,rev 独立核验时效性——晚于末次源码改动,非历史证据);rev 新实例签核**通过**(doc/evidence/signoff-M2.md):三硬条件成立、REV-011 四整改兑现、6ac20a6 的 8 spec e2e 改动逐条审查未降断言强度、10 条开放缺陷无一阻塞 M2;BUG-029 依签核复核节关单(M2-13 已承接,台账卫生滞后)。**M2 关门,tag v0.2.23**。

## [0.2.22] 2026-07-21 scripts 修复窗:BUG-028/033 双修——签核误报与视觉守卫误判消除
- **做了什么**：① dev 卡:BUG-028(docs.py next_action 新增 FM 行零场景检查——当前里程碑存在零场景 FM 行时列出缺卡行、不提示签核;真实台账行为不变+scratch 构造 FM-11 清空态验证)、BUG-033(evidence.py scenario_needs_shot 改分句+交叉引用检测——M2-13 误判消除,全部真视觉场景 M0-02/M1-05/07/08/M2-10/15/21/M3-01~06 拦截保持,双向 CLI 实测;未采纳 bugs.md 期望文本的字面精确匹配,因会漏判 M0-02/M3-01 削弱守卫,理由入注释),两条置 FIX_READY。② orch 依 §5.3 登记 BUG-036(dev 观察上报:make next 判据②③用 any() 扫历史证据目录无时效校验,「三条判据齐备」可能假绿;修复前 orch 签核一律显式重跑 REGRESS 不采信该提示)。
- **证据**：本切片 dev 自检:docs-check OK、make handover/next 输出零回归、lint PASS;两缺陷验证命令与结果详见 bugs.md 回填段。复验归独立 qa(核对记录型,scripts 无 vitest 覆盖,工具侧限制见 BUG-015)。
- **问题**：① BUG-033 分句启发式依赖现台账措辞,新写法出现时需再细化(注释已声明);② BUG-028 检查仅在「场景全 ✅」分支内生效,场景未全绿时零场景 FM 行不提前可见(与登记期望落点一致,扩大可见性需另登缺陷);③ scripts 无机械回归覆盖属系统性风险(dev 建议评估,orch 暂记流程债不立即立项);④ BUG-036 未修,M2 签核走显式重跑。
- **下一步**：并行:qa 核对记录卡(BUG-028/033 复验,§5.3-4 口径)、qa BUG-010 flake 家族治理卡;毕后显式 make regress+evidence REGRESS=1+M2 重签核(新 rev 实例)→ tag。


## [0.3.1] 2026-07-22 BUG-017 航班图层 CORS 定向——OpenSky 改原生端 M6 专属
- **做了什么**：rev 新实例(REV-016)独立 curl 复验 + 仲裁 BUG-017（OpenSky web 直连 CORS 封死）。**独立复验**：带 `Origin` 头 curl `states/all` 实测 ACAO=`https://opensky-network.org`（钉死自有域、非通配），三对照源（USGS/EONET/CoinGecko）均通配——「opensky 独异」成立、登记无失真；候选替代源 airplanes.live 虽 CORS 开放但 D29 商用许可存疑被否、留复议条件。**裁定方向①**：航班图层改原生端（Capacitor）专属挂 M6（§9 零服务器不得代理绕过、比照 SPEC-5.9 先例），OpenSky 保留为源。orch 应用：SPEC-5.6 补平台归属句（源接口/severity 恒 1/关图层停拉不变、web/PWA M5 呈禁用态明示）；涟漪同步——FM-12 摘除 OpenSky/flight-60s（保留 GDELT/CoinGecko 于 M3）、新增 FM-27（M6 原生端航班图层）、BUG-016 flight-60s 承接点从 M3 FM-12 改挂 M6 FM-27 并更新复验条件。SPEC-6.3①/5.10/5.8 语义不变（留痕防误改）。
- **证据**：`doc/review/REV-016-opensky-cors-arbitration.md`（含 curl 实测 ACAO 表 + 三对照源 + 候选替代源探测）；`doc/spec.sha256`（pin-spec 重钉）；bugs.md BUG-017→FIX_READY（rev 回填）、BUG-016 涟漪回填。本轮无 src/tests 改动。
- **问题**：① BUG-017 置 FIX_READY 未关单——复验口径为「M6 native 航班图层开卡时 qa（≠仲裁人）核对 flight-60s 场景已按新平台归属登记」，M6 前挂起；② 方向②（airplanes.live 另择源）的 D29 商用许可未核实，若未来判定 web 航班图层为关键须 orch 核实许可+CORS 稳定性后走 §7 revisit（REV-016 §5 留证）；③ web/PWA（M5）航班图层禁用态的具体 UI 表现留 M5 FM-20 实现。
- **下一步**：动效批 rev 仲裁——arch 提案 `proposal-batch2-motion.md` 已就绪（改写 SPEC-3.7+新增 SPEC-3.7a/b/c+SPEC-3.11a），派 rev 新实例取 REV-017 仲裁（处理 BUG-031、核 reduced-motion P1/sev3 脉冲存废论证/色值表零漂移/呼吸无回退）；通过后 orch pin/bump → arch 出 dev design-prompt（过 rev 门禁）→ dev 实现光柱 → qa（回退重测 M2-10/M3-03+新登场景）→ aes 验收（AES-002）。

## [0.3.0] 2026-07-21 M3 起点——D22 最小信任层 spec 化闭环
- **做了什么**：M2 关门后启动 M3。① research 新实例核查 D22 两项硬前置：GDELT 确有中文源收录+专门中文地理编码管线，但**蓝点网不在 GDELT 索引内**（架构角色错配——GDELT 只对自爬语料地理编码，非任意文本/URL 通用服务，与语言覆盖度无关），已更正 `doc/product-decisions.md` D14 修订②的因果框设，NewsGlobe 中文 feed 交互式实测因调研工具无表单能力仍未闭合。② arch 新实例交付 `doc/design-prompt/proposal-trust-tier.md`（D22 提案）：新增 SPEC-5.10 信源信任分级（权威事件源/新闻报道待验证两级，由 `source` 经表派生、不入 GeoEvent 模型，与 SPEC-5.8 T1–T4 解耦为正交轴）+ 改写 SPEC-2.3 详情卡（信源名+等级、时间语义=复用 `ts`、去重呈现=单事件 `urls[]` 计数、轻量纠错入口=mailto/issue 零服务器）。③ rev 新实例仲裁 `REV-015-trust-tier-arbitration.md`：**通过**，附 1 处必落实文本修正 M-1（去重呈现句纠正「多信源」失真措辞为「单一信源多链接」并禁「N 个信源」式跨源暗示）+ R-1（GDELT `ts=seendate` 映射前向 pin 留待 M3 GDELT 接入卡）+ R-2（testplan 时间断言口径限制）。④ orch 应用：spec.md 新增 SPEC-5.10+改写 SPEC-2.3（含 M-1 修正）+ §0 修改记录，`make pin-spec`，`make bump MILESTONE=M3`（0.2.23→0.3.0）。⑤ arch/qa 各起新实例并行下游同步：feature-matrix FM-12/13/14/25 交付物列追加信任层同步内容；testplan 新增 M3-07~M3-10 四行（映射单测/详情卡展示/纠错入口/L0 负向），均 🔲 占位、断言口径遵守 R-2。
- **证据**：`doc/research/gdelt-newsglobe-zh-prereq-202607.md`（调研报告）、`doc/design-prompt/proposal-trust-tier.md`（提案）、`doc/review/REV-015-trust-tier-arbitration.md`（仲裁记录）、`doc/spec.sha256`（pin-spec 重钉）、`doc/testplan.md` M3-07~M3-10（登记，非测试证据——尚无 src/ 实现，dev 卡未派）。本轮无 src/tests 改动，不涉及 make regress。
- **问题**：① D14 修订②原「GDELT 中文覆盖不足→T3 不成立」的因果表述已被本轮核查证伪并更正，但更正只记于 product-decisions.md，尚未反推 FM-13/FM-12 的 T2/T3/T4 选型（蓝点网类自订 RSS 走 T2 还是 T4，留待 FM-12/13 开卡时 arch 裁定，倾向 T4 因头条显式地名稀少）；② NewsGlobe 中文 feed 交互式实测（D14 硬前置①）连续两轮未闭合，受限于调研工具无浏览器自动化能力，需人工手测或换调研手段；③ R-1（SPEC-5.4 GDELT `ts` 映射）尚未落 pin，M3-08 时间语义断言范围届时可能需复核。
- **下一步**：M3 详情卡 dev 卡待派（需 arch 先出 M3 详情卡 design-prompt，重大模块须过 rev 门禁，见 proposal-trust-tier.md §4.2）；GDELT provider 接入（FM-12）落 SPEC-5.4 `ts` 映射时一并处理 R-1；其余排队项——BUG-017 OpenSky CORS 仲裁、BUG-016 flight-60s 场景登记（均待 FM-12 开卡）、动效批（BUG-031/D27，aes 先行设计）、视觉第二批（BUG-032/M3-06，aes 先行设计）。


## [0.3.2] 2026-07-22 动效批·光柱标记 spec 应用（D27/BUG-031，REV-017 整改后通过）
- **做了什么**：动效批 aes→arch→rev 全链路收束、orch 应用 5 条 SPEC 落点。① aes 制定 `visual-batch2-motion.md`（三正交通道:柱高=severity、发光热度=新鲜度、alpha=呼吸;一举解 AES-001 M2 靶环+M4 静态新鲜度遗留）。② arch 提案 `proposal-batch2-motion.md`（忠实转写 aes 取值,REV-013 两项强制论证义务兑现）。③ rev 仲裁 `REV-017`：整改后通过——4 落点准，SPEC-3.7c 因近档 `d<1.8` 撞 SPEC-7.2 相机下限 1.8 不可达阻断（R-1）。④ aes 出 R-1 新值（三可达档:远 d≥3.0/中 2.4≤d<3.0/近 1.8≤d<2.4，角距 5°/2.5°/0.8°）+ /aes-review 判据补「硬边轮廓判不达标」。⑤ orch 应用（rev 预授权 R-1 delta）：改写 SPEC-3.7（圆球+尺寸→等径光柱+柱高阶梯、发光列脉冲→三档静态体积辉光、**删「severity 3 必须持续脉冲环」硬句**、权重句改静态；色相表/HSL 乘子/派生 hex 全程不动）+ 新增 SPEC-3.7a（光柱形态+静态辉光+白热核护栏+Y≤220）/3.7b（静态新鲜度 F(a)=0.5+0.5·exp(−a/8h) 地板 0.5）/3.7c（标记 LOD 三档,R-1 修正落 [1.8,6]）/3.11a（reduced-motion P1）+ §0 记录 + pin + bump 0.3.2。依 REV-017 §5.2 撤销 M2-10/M3-03 的 ✅→🔲（旧脉冲判据失据，判据重写待 qa 走 §7）；同步 FM-07/FM-09。
- **证据**：`doc/design-prompt/visual-batch2-motion.md`（含 R-1 修订）、`doc/design-prompt/proposal-batch2-motion.md`、`doc/review/REV-017-batch2-motion-arbitration.md`、`doc/spec.sha256`（重钉）、`.claude/skills/aes-review/SKILL.md`（判据演进）。本轮无 src/tests 改动。BUG-031 维持 OPEN（bugs.md 已加 REV-017 摘要）。
- **问题**：① BUG-031 未关单——须 dev 实现光柱（删常驻脉冲）后 qa 重测 M2-10/M3-03（稳态两帧无差异+三档静态辉光）+ reduced-motion 稳态验证，`make evidence BUG=BUG-031` 机械关单（关单人≠修复人）。② M2-10/M3-03 已撤 ✅、判据文字仍是旧脉冲语义，待 qa 依 REV-017 §5.2 从新 SPEC 重写并重测（此前 M2 签核针对旧脉冲 spec，此撤销由动效批 spec 演进驱动、非签核瑕疵）。③ **D31「蜕变论·世界表」落地（用户 2026-07-22 新增 doc/product-vision.md + product-decisions.md D31，两轮反馈认可方向）**：把产品从「新闻地球仪」重铸为「第一块世界表」，附推倒重来 R1–R12（ticker 处死/面板退位为「今日刻痕」抽屉/GDELT 降选装/安好态取代空状态/通知宪法/watchlist→守望/付费重构买断 ¥30–68/M3 重排「守望闭环」/演化光柱回放）。product-vision.md §7 明列「动效批 visual-batch2 光柱即守夜烛,原样推进」——故本切片与 D31 同向、不冲突。**product-vision.md 与 D31 属用户战略文档,未并入本动效批提交,留用户处置;R1–R12 各走 §7、待 orch 与用户确定排期。**
- **下一步**：动效批实现——派 arch 出动效批 dev design-prompt（光柱几何/shader/衰减曲线系数/instancing/LOD 聚合算法/reduced-motion 接线，过 rev 门禁）→ dev 实现 `src/globe/markers.ts` 光柱渲染（rings 层几何/材质换光柱、去 sev3 脉冲、径向拉伸、静态新鲜度、reduced-motion 门）→ qa 回退重测 M2-10/M3-03 + 新登场景（光柱形态/柱高阶梯/新鲜度/LOD/reduced-motion/质量/负向,含 N-1 两半球可读）→ aes 验收 AES-002（新实例）。**并行待决：D31 R1–R12 的 §7 排期（尤其 R11 M3 重排「守望闭环」可能重排 M3 范围，需与用户确认优先级后再动）。**


## [0.3.3] 2026-07-22 叙事净化批·世界表自我定义 spec 化（D31 per-R ①R1+R10+②R2，REV-019 放行）
- **做了什么**：「世界表」蜕变（D31）写进单一事实源的第一笔。链路 aes 无涉、arch×2 出提案（proposal-r1-r10-identity + proposal-r2-ticker）→ 用户拍板首句/北极星 → rev 一次仲裁 REV-019 放行 → orch 同批应用。**R1**：SPEC-1 首句从「新闻信息流地球仪（对标 Ambient News Globe）」重铸为**候选 B「个人专属的世界表（instrument-object 仪物）——交付安心而非信息条目的安静仪器」**（用户拍板；北极星四句不纳入保持精简）+ 删对标句 + 移除「加密行情」球面事件枚举（REV-018 F-1 一处）。**R10**：§9 追加**产品宪法「永不引入」清单**（无限滚动/算法推荐流/停留时长优化/红点角标/BREAKING/假实时感，显式不适用阶段二翻案通道）+ **通知宪法负向底线预置**（默认静音/永不召回，orch 依 REV-018 §5-E 决定纳入；正向机制承接 M4/FM-19/SPEC-8.3）。**R2**：ticker 处死——删 SPEC-2.1 加密行情句、整条删 SPEC-5.7 CoinGecko、scrub SPEC-5.10 两处残留（F-1 二处「行情聚合」+「不入本表」注）+ §9 加市场/公司信号后置候选注记（改地理形态后置、非永绝，论纲六）+ FM-12 删 CoinGecko/FM-14 删 2.1-ticker 锚点。pin + bump 0.3.3。幽灵锚点自查干净（SPEC-5.7 无活跃引用、残留均为「已删除」留痕）。
- **证据**：`doc/design-prompt/proposal-r1-r10-identity.md`、`doc/design-prompt/proposal-r2-ticker.md`、`doc/review/REV-019-narrative-cleanse-arbitration.md`（16 条应用清单）、`doc/spec.sha256`（重钉）。本轮无 src/tests 改动。
- **问题**：① **testplan/e2e 涟漪未落**（REV-019 §7.5 + F-A，待 qa）：M2-18 尾注 scrub ticker（✅ 不受影响）；`e2e/topbar-brand-clock.spec.ts` **line 6 头注 + line 65–66 守卫注**两处 re-anchor spec 锚点（现引已删的「SPEC-2.1 加密行情 ticker（M3）」→ 改指「SPEC-2.1 顶栏无 ticker + §9 后置候选/论纲六」），**断言 not.toContain('行情') 不动、守卫强化、机位不变无 re-run 失败风险**。② R1+R2 同批 pin 已消除叙事不一致窗口（SPEC-1/2.1/5.7/5.10 ticker 引用一次清净）。
- **下一步**：派 qa 处理上述 e2e/M2-18 re-anchor（F-A 两处，只改注释锚点不动断言）。其后 per-R 续批：**③R7（立守望：watchlist→守望概念+首启第一问+守望前移 SPEC-8.6/8.1/8.2、「人」新对象类型）→ ④R3+R5（默认态批：面板退位「今日刻痕」抽屉 SPEC-2.2 + 安好态文案 SPEC-2.2a，含 F-2 M2-13/14/19/M3-01 涟漪 + F-3/C 安好态触发条件 per-R 细化）→ ⑤R4（GDELT/T2/T3 改挂 M4 + SPEC-2.5 gazetteer 搜索 co-resolve F-3）**。并行仍挂：动效批光柱 dev 实现（需 arch dev-DP 过 rev 门禁）。
