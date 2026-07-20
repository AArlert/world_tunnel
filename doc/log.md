# log — 交接日志（新的在上；仓库内最多 4 块，超限 `make docs-archive`）

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

## [0.2.1] 2026-07-21 数据核心骨架落地——M2-02/03/04 全绿,OpenSky CORS 封死登记
- **做了什么**：① CORS 独立探测（orch 轻量执行，产品负责人指示，样本与响应头留 scratchpad 未入库）：七源中六源（USGS/EONET/GDACS/LL2/GDELT/CoinGecko）ACAO 通配可浏览器直连，**OpenSky 钉死自有域→web 端直连不可行**，登记 BUG-017（SPEC-5.6 可行性假设不成立，M3 FM-12 开卡前仲裁）；GDACS 单响应 634KB 体量已知会。② dev 按 M2-data DP 实现 `src/data/` 骨架（types/store/http/scheduler/cache/index，providers 空数组开口，零 three 依赖），自检 lint+全量单测绿。③ qa 两卡串行：M2-02（store 去重/过期窗）、M2-03（独立轮询）、M2-04（退避×2^n 上限 30min/条件请求/故障隔离）三场景 ✅，证据 doc/evidence/v0.2.0/。M2-01 留 🔲（归一化需 provider，待后续卡）。
- **证据**：doc/evidence/v0.2.0/M2-02.log、M2-03.log、M2-04.log（均 evidence.py 机械生成）；lint+unit 全量 PASS（test-results/）。
- **问题**：① dev 登记两处非阻塞张力待后续判：空轮/304 轮不触发清扫（与 DP §2.5 措辞微张力）、createDataLayer 无参签名致装配级 round-trip 测试需挂全局 fake-indexeddb；② cache（SPEC-3.11/8.4 数据侧）尚无场景覆盖——属 FM-09 范围，开卡时登记；③ BUG-017 悬至 M3。
- **下一步**：provider 卡——dev 实现 usgs.ts+eonet.ts（G-1 已 pin）+ 正式抓四源 fixture（含头注抓取时间；gdacs/ll2 仅捕获原始响应供 arch 提案 G-2/G-3，映射禁实现）；qa 接 M2-01 归一化断言;随后 arch 依 fixture 提 G-2/G-3 → rev 仲裁 → pin。FM-07/08 视觉切片临近,出可视化结果时通知产品负责人验收。
