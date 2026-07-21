# log — 交接日志（新的在上；仓库内最多 4 块，超限 `make docs-archive`）

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

## [0.2.5] 2026-07-21 FM-08 矢量默认风格落地——M2-15/16/17 全绿,BUG-020 关单
- **做了什么**：① dev 实现矢量默认(coastline.ts+coastline-110m.json 76KB/vectorEarth.ts/shaders/vectorEarth.ts,SPEC-3.2a 取值逐条落地),GlobeScene 默认矢量、卫星退出首包(`?style=satellite` DEV/测试钩子=BUG-020 方案 a,orch 拍板),ASSETS.md 登记海岸线出处与卫星纹理天气包标注,tsconfig 加 resolveJsonModule;首包量测 800KB(gzip 224KB)含海岸线,远低于 2MB 预算;② dev 发现 atmosphere-glow 为同机制第三条受影响 e2e(等待门依赖卫星 uniform),纳入 BUG-020 范围;③ qa 卡一:三条 e2e 适配(M1-05/M1-14 挂 `?style=satellite` 卫星路径专属,atmosphere-glow 换风格无关稳定门 waitForSurfaceReady)、新增 satellite-lazy-load.spec(M2-17 ✅:默认 0 纹理请求/卫星路径 2 请求)、BUG-020 复验关单(全量 e2e 20 绿);④ qa 卡二:M2-15 ✅(vector-earth-style.spec:昼夜取样/辉光色相/过渡带,昼夜截图归档)、M2-16 ✅(海岸线投影对齐:几内亚湾窗口+东西经符号防镜像),辅助单测网格 30° 密度;测试基建扩展 findColorInRegion/setSunDirVector。全量 147 单测+23 e2e 绿。
- **证据**：doc/evidence/v0.2.4/(M2-15.log+昼夜双截图、M2-16.log、M2-17.log、BUG-020.log,均机械生成)。
- **问题**：① qa 提醒:夜面辉光「低强度」的实际观感需产品负责人过目(截图已归档,preview 验收一并看);② BUG-012 追加 M2-17 同类观察(行文标「单测」实为 e2e,与 M1-04 同口径待订正,状态位未动);③ M2-15 采样安全区推导依赖 SPEC-3.1 相机参数,spec 若改需复核头注。
- **下一步**：dev FM-07(标记层+事件流面板+双向联动,src/globe+src/ui);qa 按 M2-10~14 三卡接测;全绿后 orch preview 截图,通知产品负责人验收。
