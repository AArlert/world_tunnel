

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
