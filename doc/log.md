# log — 交接日志（新的在上；仓库内最多 4 块，超限 `make docs-archive`）

## [0.2.13] 2026-07-21 REV-013 视觉批次一条文落地——色值体系/昼夜对比契约/severity 分层入 spec
- **做了什么**：orch 依 REV-013 应用 11 项裁准条文并 pin(v0.2.13 修改记录):SPEC-3.2a 前言自洽修订+底面两端 pin `#1f4468`/`#0d1827`+海岸线降饱 `#6690b3`(解 news 撞色)+经纬网默认隐藏+夜面辉光 `#3a5a72`+新增昼夜对比契约([1.8,2.6] 主判据/≥1.3:1 副判据);SPEC-3.2① 补昼半球连续衰减(C-3:与对比契约绑定,rev 复算平涂 luma 比 2.76 超上限故不可分拆);SPEC-3.7 补 severity 明度/饱和/发光三通道分层(乘子规则权威、六类 hex 派生参考);SPEC-2.2a 填 D25 留白(标题明度三档+行首点镜像);SPEC-3.5/2.2 各加最小相对亮度契约(rev 改文)。改动 8(脉冲随新鲜度)驳回另开动效批。testplan 同步:M2-15 回退 🔲 重测(新色值),M2-13 判据澄清(只断不变量 A),M3-01 补全转可测,新增 M3-02(昼夜对比,C-2 量测方法定死)/M3-03(标记分层)/M3-04(星空)/M3-05(面板)/M3-06(近景网格占位,C-1);FM-07 场景列挂 M3-02~06。
- **证据**：本切片纯 spec/台账应用;裁决依据 doc/review/REV-013-visual-batch1-arbitration.md 逐字应用(11 准 1 驳,C-1/C-2/C-3 硬条件均落地)。
- **问题**：① M2-15 回退后 M2 硬门槛待测 = M2-13/15/20/21/23/24 六条;② dev 视觉批次一实现未派(等 FM-09 dev 交付避免 markers.ts 并发);③ M3-02~05 即刻可测但归 D24/D25 批次,勿挂 M2 门槛;④ 动效批(脉冲新鲜度+reduced-motion)择期另立。
- **下一步**：FM-09 dev 交付后 → qa 测 M2-20/21(连带 M2-13 重测+BUG-029 承接);dev 视觉批次一实现(shader 色值/衰减/标记分层/面板)→ qa 测 M2-15+M3-02~05 → aes 新实例 /aes-review 验收;FM-11 量测卡;BUG-010/028;REGRESS=1+重签核 M2。

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
