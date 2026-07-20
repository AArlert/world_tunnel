# log — 交接日志（新的在上；仓库内最多 4 块，超限 `make docs-archive`）

## [0.2.4] 2026-07-21 视觉层前置就位——M2-globe DP 过门禁,SPEC-3.2a/2.2a 入 spec,M2-10~17 登记
- **做了什么**：① arch 交付 `design-prompt/M2-globe.md`(FM-07 标记层+面板 / FM-08 矢量默认),对外可见缺口规矩收敛为提案 P-1(矢量视觉参数)/P-2(面板列表行)/C(ASSETS 登记);② rev REV-010 六维门禁全过+四裁:P-1/P-2 裁准并给文本、SPEC-7.4 双向联动 M2 取全双向、R-8 边界成立(本卡不触 atmosphere);③ orch 应用 SPEC-3.2a(深色底 #0a1a2f/海岸线 #4db8ff/网格 #1e3a5f 30°/夜面辉光 #7fd4ff)与 SPEC-2.2a(分类色圆点+标题+相对时间、ts 倒序、空状态)入 spec v0.2.4+pin,DP 检查点 6/7 按 REV-010 §3.2/3.3 对齐;④ qa 两卡登记 M2-10~14(FM-07:分类色/severity 脉冲、instancing、不遮挡真标记+R-6、面板 300px、双向联动)与 M2-15~17(FM-08:矢量昼夜视觉、海岸线坐标对齐、卫星退默认),FM 场景列回填;⑤ 登记 BUG-020(REV-010 §3.1:FM-08 摘卫星默认后 M1-05/M1-14 e2e 将挂,FM-08 交付前须闭合,二选一方案已列)。
- **证据**：纯文档/spec 变更,无测试面;门禁链 M2-globe.md → REV-010-M2-globe-gate.md;docs-check 通过。
- **问题**：① BUG-020 悬,FM-08 卡必办;② M2-16/17 的测试可写性(海岸线数据结构可单测性、卫星不加载的静态断言)待 dev 实现后验证;③ BUG-011(证据跨双层)会影响 M2-10/12 跨层场景登记,沿既定口径留痕。
- **下一步**：dev 双卡——FM-07 标记层+面板+联动(REV-010 判定不被 P-1/P-2 阻塞,现已 pin 更无阻)、FM-08 矢量默认(含 BUG-020 二选一承接+ASSETS 登记);随后 qa 按 M2-10~17 接测;全绿后 orch 起 preview 截图,**通知产品负责人验收首个可视化切片**。

## [0.2.3] 2026-07-21 数据层收口——GDACS/LL2 落地,BUG-018/019 仲裁修复关单,FM-05/06 九场景全绿
- **做了什么**：① dev 实现 gdacs.ts/ll2.ts(照 v0.2.2 pin 的映射,UTC 陷阱处理),qa 登记并测 M2-07/08 ✅,新歧义 BUG-019(LL2 severity 方向性)由 qa 如实登记留白;② arch 出 SPEC-6.3 清扫语义提案 → rev REV-009 双仲裁放行(lastSeen 基准+不进 SPEC-6.1;BUG-019 裁「仅未来方向,net≤now→1」)→ orch 应用 spec v0.2.3+pin;③ dev 修 store/cache/index(lastSeen 内部记帐,upsertMany 增 now 入参)与 ll2 severityFromNet;arch 同步 M2-data DP 七处;④ qa 三卡串行:M2-02 按新语义改写复测、新增 M2-09 真龄清扫(EONET fixture 26 条 0 误清)、M2-08 补 net 已过去断言、M2-01 四源归一化一致性(16 用例含跨源 id 唯一)——**BUG-018/BUG-019 均复验关单(关单人≠修复人)**;⑤ orch 依 qa 观察扩充 BUG-010 观察面(day-night-calibration/zoom-range 同现高并发抖动)。FM-05/06 场景列齐:M2-01~09 全 ✅,全量单测 143 绿。
- **证据**：doc/evidence/v0.2.2/(M2-01/02/07/08/09、BUG-018、BUG-019 七份,均机械生成);仲裁链 proposal-expiry-semantics.md + proposal-gdacs-ll2.md → REV-008/REV-009;qa M2-08 卡全量 regress 三跑后全绿(regress_summary.txt)。
- **问题**：① e2e 高并发抖动观察面扩大(BUG-010 已扩充描述,待处置);② cache lastSeen round-trip 无自动化证据(代码走查依据,FM-09 开卡时补场景);③ M2-09 未覆盖 REV-009 §1.6 列的冷启动局部续期与滚动窗两检查点(FM-09 场景一并承接);④ 并行会话已落 grill 决议(D22 信任层门禁、D2/D4/D12/D14/D16 修订)与 RSS 竞品核查,M3 开卡须按 D22 前置信任层提案;doc/attachment/newsglobeworldmap.com.png 为并行工作遗留未跟踪文件,归属待其处理。
- **下一步**：FM-07 标记层+事件流面板(SPEC-3.4 回补/SPEC-7.4 联动分片/SPEC-3.7/3.8)与 FM-08 矢量默认风格——重大渲染模块,先 arch design-prompt → rev 门禁 → dev/qa;此为首个可视化切片,完成后 orch 起 preview 验收并通知产品负责人。其后 FM-09 缓存启动(承接遗留②③)、FM-10 顶栏+分类过滤、FM-11 性能基线。

## [0.2.2] 2026-07-21 USGS/EONET provider 落地 + G-2/G-3 仲裁 pin——发现清扫语义缺陷 BUG-018
- **做了什么**：① qa 抓五份正式 fixture 入 tests/fixtures/（usgs×2/eonet/gdacs/ll2-list，README 登记抓取时间），后补 ll2-detailed；② dev 实现 usgs.ts/eonet.ts 并注册 T1_PROVIDERS（G-1 包围盒降维含合成样本自证）；③ qa 登记并测 M2-05（USGS 映射,19 用例）/M2-06（EONET 映射,16 用例）✅，FM-06 场景列回填；④ arch 依 fixture 出 G-2/G-3 提案（GDACS「人道响应字段」实测不存在;LL2 mode=list 实测无工位坐标）→ rev REV-008 放行并三裁：humanitarian 判类=eventtype∈{DR,FL}（方案A）、LL2 端点换 mode=detailed（预算不变）、R-1 过期语义登记 BUG-018 不捆绑;⑤ orch 应用 SPEC-5.3/5.5 全文替换（spec v0.2.2）+ pin，同步 M2-data.md §2.2 与 testplan M2-01 精确断言口径。
- **证据**：doc/evidence/v0.2.1/M2-05.log、M2-06.log（机械生成）；仲裁链 doc/design-prompt/proposal-gdacs-ll2.md → doc/review/REV-008-gdacs-ll2.md；lint+unit 全量 PASS。
- **问题**：**BUG-018（OPEN，rev 建议 M2 签核前闭合）**——store 清扫按事件 ts 判过期,EONET 长寿命 open 事件（fixture 实测 24/26 条真龄>72h）首轮 sweepExpired 即被误清,GDACS ts=datemodified 同根因;rev 倾向 Design Y（按最后见到时刻续期）,须走 §7:arch 提 SPEC-6.3 语义澄清 → rev pin → dev 改 store → qa 补真龄场景并复测 M2-02。
- **下一步**：① BUG-018 修复链（优先,EONET 已 live）;② dev 实现 gdacs.ts/ll2.ts（SPEC-5.3/5.5 已 pin,注意 GDACS UTC 解析陷阱）+ qa M2-07/08;③ qa 关 M2-01（四源齐后精确断言）;④ FM-07 标记层 + FM-08 矢量默认（首个可视化切片,完成后通知产品负责人验收）。
