# log — 交接日志（新的在上；仓库内最多 4 块，超限 `make docs-archive`）

## [0.2.5] 2026-07-21 FM-08 矢量默认风格落地——M2-15/16/17 全绿,BUG-020 关单
- **做了什么**：① dev 实现矢量默认(coastline.ts+coastline-110m.json 76KB/vectorEarth.ts/shaders/vectorEarth.ts,SPEC-3.2a 取值逐条落地),GlobeScene 默认矢量、卫星退出首包(`?style=satellite` DEV/测试钩子=BUG-020 方案 a,orch 拍板),ASSETS.md 登记海岸线出处与卫星纹理天气包标注,tsconfig 加 resolveJsonModule;首包量测 800KB(gzip 224KB)含海岸线,远低于 2MB 预算;② dev 发现 atmosphere-glow 为同机制第三条受影响 e2e(等待门依赖卫星 uniform),纳入 BUG-020 范围;③ qa 卡一:三条 e2e 适配(M1-05/M1-14 挂 `?style=satellite` 卫星路径专属,atmosphere-glow 换风格无关稳定门 waitForSurfaceReady)、新增 satellite-lazy-load.spec(M2-17 ✅:默认 0 纹理请求/卫星路径 2 请求)、BUG-020 复验关单(全量 e2e 20 绿);④ qa 卡二:M2-15 ✅(vector-earth-style.spec:昼夜取样/辉光色相/过渡带,昼夜截图归档)、M2-16 ✅(海岸线投影对齐:几内亚湾窗口+东西经符号防镜像),辅助单测网格 30° 密度;测试基建扩展 findColorInRegion/setSunDirVector。全量 147 单测+23 e2e 绿。
- **证据**：doc/evidence/v0.2.4/(M2-15.log+昼夜双截图、M2-16.log、M2-17.log、BUG-020.log,均机械生成)。
- **问题**：① qa 提醒:夜面辉光「低强度」的实际观感需产品负责人过目(截图已归档,preview 验收一并看);② BUG-012 追加 M2-17 同类观察(行文标「单测」实为 e2e,与 M1-04 同口径待订正,状态位未动);③ M2-15 采样安全区推导依赖 SPEC-3.1 相机参数,spec 若改需复核头注。
- **下一步**：dev FM-07(标记层+事件流面板+双向联动,src/globe+src/ui);qa 按 M2-10~14 三卡接测;全绿后 orch preview 截图,通知产品负责人验收。

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
