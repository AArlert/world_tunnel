# log — 交接日志（新的在上；仓库内最多 4 块，超限 `make docs-archive`）

## [0.2.12] 2026-07-21 缺陷线收口:BUG-026/027 机械关单,BUG-014 流程口径关单,登记 BUG-029
- **做了什么**：① qa 复验关单 BUG-026/027(独立实例):核对 v0.2.11 修复落地,e2e/topbar-brand-clock.spec.ts 补「顶栏不含行情占位文本」最小断言(引 SPEC-2.1+BUG-026),make evidence 机械关单;② qa 独立核对 BUG-014(流程类,§5.3-4 口径):SPEC-2.1 UTC 时钟三方互指(FM-10↔M2-18↔证据)闭环成立,顺带核对 SPEC-2.x 全部子句认领面,核对记录入证据库,orch 依记录置 CLOSED;③ 核对发现同构新遗留登记 BUG-029:SPEC-2.2「全屏地球 canvas」子句无场景显式认领(M0-02 只断言非零),期望 M2-13 重测卡承接。
- **证据**：doc/evidence/v0.2.11/BUG-026.log、BUG-027.log(机械生成)、BUG-014-verification.md(独立核对记录)。
- **问题**：① BUG-029 待 M2-13 重测卡承接;② REV-013 视觉条文尚未应用(下一切片);③ UX 验收七单(022~028)已关五,余 025(等视觉实现)/028(工具盲区,重签核前修)。
- **下一步**：orch 应用 REV-013 条文+pin+testplan 同步(v0.2.13);dev FM-09(缓存启动+呼吸过渡,已派)→ qa 测 M2-20/21(连带 M2-13 重测+BUG-029 承接);dev 视觉批次一实现 → aes 新实例验收;FM-11 量测;BUG-010/028;REGRESS=1+重签核。

## [0.2.11] 2026-07-21 FM-10 顶栏+六分类过滤落地——M2-18/19 ✅,品牌统一 Worlens
- **做了什么**：① dev 实现 FM-10:src/App.tsx 顶栏(品牌名 Worlens/UTC 时钟每秒 getUTC* 刷新/六分类开关 data-category+aria-pressed,分类色取 markers.CATEGORY_COLORS 同源)、App 层 Set 过滤接缝(visibleEvents 同喂标记层与面板,store/data 零改动)、移除「行情 ticker(M3)」占位,index.html title 统一 Worlens;② qa 独立实例:新增 e2e topbar-brand-clock(4 用例,含 UTC 语义环绕容差)与 category-filter(4 用例,像素级验证标记+列表两处同步,含空集),smoke 标题断言按 SPEC-2.1 对齐;M2-18/19 ✅ + M0-02 复登 ✅(判据经 orch 依 SPEC-2.1/REV-011 同步);全量 e2e 43/43 一次过(8 workers,BUG-010 未触发);③ orch 回填 BUG-026/027 FIX_READY。
- **证据**：doc/evidence/v0.2.10/M2-18.log、M2-19.log、M0-02.log+M0-02-smoke.png(均机械生成)。
- **问题**：① M2-19 的 conflict/news/launch/flight 四类仅 DOM 级验证(M2 无该四类信源),事件级过滤用例待 M3 有源后补;② 标记侧判据用分类色像素搜索而非 InstancedMesh.count(高水位不回退,方法选择已注释);③ REV-013 视觉仲裁已回(11 准 1 驳,三硬条件:5/6 绑定、亮度定义 pin、近景网格占位),应用为下一切片。
- **下一步**：qa 复验关单 BUG-026/027 + BUG-014 核对记录(流程类口径);orch 应用 REV-013 条文+pin+testplan 同步(v0.2.12);dev FM-09(缓存启动+呼吸过渡)→ qa 测 M2-20/21;dev 视觉批次一实现 → aes 新实例验收;FM-11 量测;BUG-010/028;REGRESS=1+重签核。

## [0.2.10] 2026-07-21 USGS 噪声门槛+排序邻近度落地——M2-05/22 ✅
- **做了什么**：① dev(前一卡)实现随本切片入库:src/data/providers/usgs.ts 端点切换 2.5_day/2.5_hour(SPEC-5.1,源侧兑现 M≥2.5 门槛,无客户端过滤)、src/ui/EventPanel.tsx 排序比较器改三级键(ts 与 now 绝对时间差升序/等距未来优先/id 升序,SPEC-2.2a);② qa 独立实例:tests/usgs.test.ts 按新判据重写(端点+2.5 样本映射+severity 含 [2.5,4.5) 内点)、新建 tests/event-panel-sort.test.ts(react-dom/server 真实渲染面板读回行序,判据五点:混合/全未来/全过去/tie-break/空态)、新 fixture usgs_2.5_day.json(真实 curl 抓取 2026-07-21T03:20:15Z,52 features,fixtures/README 登记);M2-05/M2-22 双 ✅(make evidence 机械回填);全量 166 单测零红。
- **证据**：doc/evidence/v0.2.8/M2-05.log、M2-22.log(目录名为生成时版本位,属机械行为)。
- **问题**：① BUG-023/024 仍 FIX_READY——待独立 qa 以证据机械关单(下一卡);② 旧 fixture usgs_all_hour/all_day.json 已无测试引用,保留不删(历史样本);③ severity 3 档无真实样本(当日无 M≥6 地震),由构造输入覆盖,属判据设计而非漏测。
- **下一步**：qa 复验关单 BUG-023/024;dev FM-10 顶栏+过滤(串行,避免与复验并跑写树);dev FM-09;BUG-010 处置;arch 视觉提案→rev;全绿 REGRESS=1+重签核 M2。
