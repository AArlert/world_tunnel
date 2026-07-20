# log — 交接日志（新的在上；仓库内最多 4 块，超限 `make docs-archive`）

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

## [0.2.4] 2026-07-21 视觉层前置就位——M2-globe DP 过门禁,SPEC-3.2a/2.2a 入 spec,M2-10~17 登记
- **做了什么**：① arch 交付 `design-prompt/M2-globe.md`(FM-07 标记层+面板 / FM-08 矢量默认),对外可见缺口规矩收敛为提案 P-1(矢量视觉参数)/P-2(面板列表行)/C(ASSETS 登记);② rev REV-010 六维门禁全过+四裁:P-1/P-2 裁准并给文本、SPEC-7.4 双向联动 M2 取全双向、R-8 边界成立(本卡不触 atmosphere);③ orch 应用 SPEC-3.2a(深色底 #0a1a2f/海岸线 #4db8ff/网格 #1e3a5f 30°/夜面辉光 #7fd4ff)与 SPEC-2.2a(分类色圆点+标题+相对时间、ts 倒序、空状态)入 spec v0.2.4+pin,DP 检查点 6/7 按 REV-010 §3.2/3.3 对齐;④ qa 两卡登记 M2-10~14(FM-07:分类色/severity 脉冲、instancing、不遮挡真标记+R-6、面板 300px、双向联动)与 M2-15~17(FM-08:矢量昼夜视觉、海岸线坐标对齐、卫星退默认),FM 场景列回填;⑤ 登记 BUG-020(REV-010 §3.1:FM-08 摘卫星默认后 M1-05/M1-14 e2e 将挂,FM-08 交付前须闭合,二选一方案已列)。
- **证据**：纯文档/spec 变更,无测试面;门禁链 M2-globe.md → REV-010-M2-globe-gate.md;docs-check 通过。
- **问题**：① BUG-020 悬,FM-08 卡必办;② M2-16/17 的测试可写性(海岸线数据结构可单测性、卫星不加载的静态断言)待 dev 实现后验证;③ BUG-011(证据跨双层)会影响 M2-10/12 跨层场景登记,沿既定口径留痕。
- **下一步**：dev 双卡——FM-07 标记层+面板+联动(REV-010 判定不被 P-1/P-2 阻塞,现已 pin 更无阻)、FM-08 矢量默认(含 BUG-020 二选一承接+ASSETS 登记);随后 qa 按 M2-10~17 接测;全绿后 orch 起 preview 截图,**通知产品负责人验收首个可视化切片**。
