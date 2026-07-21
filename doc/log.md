# log — 交接日志（新的在上；仓库内最多 4 块，超限 `make docs-archive`）

## [0.2.10] 2026-07-21 USGS 噪声门槛+排序邻近度落地——M2-05/22 ✅
- **做了什么**：① dev(前一卡)实现随本切片入库:src/data/providers/usgs.ts 端点切换 2.5_day/2.5_hour(SPEC-5.1,源侧兑现 M≥2.5 门槛,无客户端过滤)、src/ui/EventPanel.tsx 排序比较器改三级键(ts 与 now 绝对时间差升序/等距未来优先/id 升序,SPEC-2.2a);② qa 独立实例:tests/usgs.test.ts 按新判据重写(端点+2.5 样本映射+severity 含 [2.5,4.5) 内点)、新建 tests/event-panel-sort.test.ts(react-dom/server 真实渲染面板读回行序,判据五点:混合/全未来/全过去/tie-break/空态)、新 fixture usgs_2.5_day.json(真实 curl 抓取 2026-07-21T03:20:15Z,52 features,fixtures/README 登记);M2-05/M2-22 双 ✅(make evidence 机械回填);全量 166 单测零红。
- **证据**：doc/evidence/v0.2.8/M2-05.log、M2-22.log(目录名为生成时版本位,属机械行为)。
- **问题**：① BUG-023/024 仍 FIX_READY——待独立 qa 以证据机械关单(下一卡);② 旧 fixture usgs_all_hour/all_day.json 已无测试引用,保留不删(历史样本);③ severity 3 档无真实样本(当日无 M≥6 地震),由构造输入覆盖,属判据设计而非漏测。
- **下一步**：qa 复验关单 BUG-023/024;dev FM-10 顶栏+过滤(串行,避免与复验并跑写树);dev FM-09;BUG-010 处置;arch 视觉提案→rev;全绿 REGRESS=1+重签核 M2。

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
