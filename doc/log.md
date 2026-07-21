# log — 交接日志（新的在上；仓库内最多 4 块，超限 `make docs-archive`）

## [0.2.9] 2026-07-21 BUG-022 独立复验关单,BUG-023/024 FIX_READY 回填
- **做了什么**：① qa 独立复验 BUG-022(关单人≠修复人):新增 e2e/marker-overlap-blending.spec.ts(12 个同点位 disaster 断言重叠中心可归属分类色且无近白像素,近白阈值 190 从 SPEC-3.7 推导;另跨分类对照点)+ globeDebug.ts 补 countNearWhite 辅助;**判别力验证**——临时还原 AdditiveBlending 后测试如期 FAIL(1001 近白像素),复原后 PASS,证明测试非空转;make evidence BUG=BUG-022 机械关单 CLOSED。② orch 依 dev 交付回填 BUG-023/024 → FIX_READY(usgs.ts 端点切换/EventPanel 排序比较器,src 改动随下切片入库),待 qa 按 M2-05/M2-22 测绿复验关单。
- **证据**：doc/evidence/v0.2.8/BUG-022.log + BUG-022-marker-overlap-blending.png(修复后双簇无白斑)。
- **问题**：① qa M2-05/22 已交卡(双 ✅,166 单测全绿),其 src/tests/testplan 文件随下切片 v0.2.10 入库,本切片不含;② arch 视觉批次一提案在途;③ 复验期间树上有并行未提交 src 改动,qa 已核实不影响像素断言结论,留意并发写树。
- **下一步**：qa M2-05/22 交卡后大切片提交(dev src+qa tests+fixtures+证据,v0.2.10)并复验关单 BUG-023/024;随后 dev FM-10 顶栏、dev FM-09 缓存启动、qa BUG-010 抖动处置;arch 视觉提案→rev 仲裁→应用;全绿 REGRESS=1+重签核。

## [0.2.8] 2026-07-21 REV-012 三条 spec 落地——噪声门槛/排序语义/severity 编码,台账同步
- **做了什么**：① orch 依 REV-012 应用三条 spec 文本并 pin(v0.2.8 修改记录):新增 SPEC-5.0a 呈现门槛通则(亚门槛不入球不入流,球/列表共用呈现集);SPEC-5.1 换 USGS M2.5+ 显著性 feed(源侧门槛,BUG-023);SPEC-2.2a 合并替换(排序改「距 now 邻近度升序」BUG-024 + severity 三档单调非色相编码 BUG-025,造型值待 D25);② testplan 同步:M2-05/M2-13 判据改写、✅ 回退 🔲 重测(REV-012 合法性核验:判据经合法 spec 修改而变,原证据旧契约下取得);新增 M2-22(排序邻近度,M2 门槛)、M3-01(severity 单调不变量 B,D25 批次,定值前禁 ✅——与 pin 同切片登记满足 REV-012 §3.6 硬条件);③ feature-matrix:FM-05 补 SPEC-5.0a、FM-07 挂 M2-22/M3-01、FM-09 回填 M2-20/21(qa 已登记缓存启动/呼吸过渡场景)、FM-10 回填 M2-18/19(前一切片)。
- **证据**：本切片纯 spec/台账应用,无新测试证据;裁决依据 doc/review/REV-012-stream-spec-arbitration.md §5/§6 逐字应用。
- **问题**：① M2-05/M2-13 回退后 M2 待测场景 6 条(05/13/18/19/20/21)+M2-22 共 7 条;② dev 尚未实现:USGS 端点切换、排序比较器、FM-09/10 全部、severity 编码(后者等 D25);③ FM-11 尚未开卡(性能基线,M2 最后一行);④ DP 同步(M2-globe/M2-data)待 arch,BUG-010 抖动待 qa,BUG-022 复验进行中。
- **下一步**：dev 卡一(USGS 2.5 feed+排序比较器,连带 M2-05/22 可测)、dev 卡二(FM-10 顶栏+过滤)、dev 卡三(FM-09 缓存启动+呼吸过渡);qa 跟测各卡;FM-11 qa 登记;aes 视觉方案回收后走 arch→rev 二次入 spec;全绿重跑 REGRESS=1+重签核。

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
