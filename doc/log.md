# log — 交接日志（新的在上；仓库内最多 4 块，超限 `make docs-archive`）

## [0.2.21] 2026-07-21 FM-11 基线落地+缓存生命周期双缺陷闭环——M2 场景全绿
- **做了什么**：① qa FM-11 卡:M2-23(tests/build-budget.test.ts,首包 raw 810.7KB/gzip 225.1KB 入证据,卫星纹理 2.54MB 物理隔离不计首包)、M2-24(e2e/cold-start-perf.spec.ts,冷启动→可交互 ~300ms、缓存上屏 ~200ms、帧率 ~61fps,vite preview 生产服基线,门禁留 M5),双 ✅——**M2 全部场景就此全绿**;vite.config.ts 补 test.reporters 修 vitest 非 TTY 不回显 console 问题。② 量测中挖出 BUG-034(StrictMode 双调用下 stop() 在 cache.load 未 settle 时空快照覆写 IndexedDB,数据丢失级,dev server 100% 复现、production 不受影响):dev 修复(cacheLoaded 闸门)→ qa 判别力核查复验关单;复验扩检查点又挖出 BUG-035(早停实例晚到 load 翻闸门,二次 stop 复活覆写):dev 修复(闸门翻转收进 !stopped 块)→ 新 qa 实例判别力核查复验关单。两缺陷均 CLOSED,每层有故意红复现测试钉住后修绿。③ BUG-010 第三轮观察面扩充(高并发下 marker-severity-tri-channel 新增像素误读一例)。
- **证据**：doc/evidence/v0.2.20/M2-23.log、M2-24.log、BUG-034.log、BUG-035.log(均机械生成);全量单测 179/179、lint PASS;判别力核查两轮(还原修复→红,恢复→绿,diff 逐字节一致)。
- **问题**：① BUG-035 遗留可选加固点:正常实例重复 stop 属幂等重复写非数据丢失,未补断言(qa 判定非阻塞);② e2e 层 StrictMode 真实浏览器检查点未做(成本高,列遗留);③ M2-24 数值系本机 vite preview,M5 须按真实验收环境重测;④ 全量 e2e 高并发 flake(BUG-010 家族已扩至 3 例)是 REGRESS 100% 的直接威胁,签核前必须处置。
- **下一步**：dev 卡 BUG-028+BUG-033(scripts 修复窗,期间不派用 evidence 的卡);qa 卡 BUG-010 flake 家族治理(负载敏感断言加固);REGRESS=1+M2 重签核(新 rev 实例)→ tag;动效批(BUG-031/D27)与视觉第二批(BUG-032/D24)待 M2 关后立项。

## [0.2.20] 2026-07-21 M3-01 收口+AES-001 验收放行——视觉批次一全绿闭环,BUG-025 关单
- **做了什么**：① qa 卡:M3-01(e2e/event-row-severity.spec.ts 新增)——标题明度三档单调+对面板底 WCAG 对比全档 ≥4.5:1 AA(实测 5.7~17.7:1)+圆点镜像 severity 分级(色相恒定/明度饱和取 SPEC-3.7 值),✅;BUG-025 机械关单(关单人≠修复人)。② aes 验收(AES-001,与制定不同实例):**放行**——无 Blocker/High,Medium×4/Nit×3 均属已归批次项(晨昏 signature/severity 环形态归 D27 动效批、密集聚合归第二批 D23、「多新」静止态编码归 D27);「做对了什么」八条含夜面辉光 `#3a5a72` 修复历史偏淡关注点、黑名单#1 深底红点 default 被破除、双真实态取证(137 枚当日事件+环太平洋震群压力位)。20 张机位矩阵截图入 doc/attachment/aes-20260721-visual-batch1/(移动档缺省已注明)。无需 arch 落 spec、无需新开 bugs。
- **证据**：doc/evidence/v0.2.19/M3-01.log+截图、BUG-025.log;全量 e2e 54/54(本轮零 flake);doc/review/AES-001-visual-batch1-acceptance.md。
- **问题**：① M3-01 圆点镜像仅 disaster 一类实测(fixture 限制),跨分类通用性由 M3-03 球面侧覆盖+同一派生函数,列表侧全六类为可疑未定性缺口(qa 未开单,非判据要求);② aes 判据演进建议两条(signature 弹性判据/层次 vs 形态质感区分)待动效批时采纳;③ M2 开口仅余 M2-23/24(FM-11)。
- **下一步**：aes 对照截图送用户过目;qa FM-11 量测卡(M2-23/24,M2 最后开口);dev 卡 BUG-028+BUG-033(scripts 串行窗口);BUG-010 qa 处置;REGRESS=1+M2 重签核(新 rev 实例)→ tag;动效批(BUG-031/D27 光柱参照)与视觉第二批(BUG-032/D24 LOD)择期立项。

## [0.2.19] 2026-07-21 M3-04/05 相对亮度契约双绿——星空封顶+面板暗于球
- **做了什么**：① qa 卡:M3-04(e2e/star-brightness-cap.spec.ts 新增,默认+旋转两组代表性机位,左侧 12% 窄条采样排除大气辉光伪高读数,实测最大 luma 83/95 远低于海岸线阈值 137.6)、M3-05(e2e/panel-brightness-cap.spec.ts 新增,量测口径=面板 CSS 声明底色 RGB 而非合成后像素——spec 将实底/玻璃列为实现自由度,合成像素随叠加位置浮动非契约量,口径引 REV-013 §5.3 同法);两场景 ✅,globeDebug 增 maxLumaInRegion。② orch 回填 BUG-025 至 FIX_READY(spec 侧 v0.2.8+v0.2.13 pin、实现侧视觉批次一 v0.2.15 均已落地,机械复验锚定 M3-01)。
- **证据**：doc/evidence/v0.2.18/M3-04.log+png、M3-05.log+png;全量 e2e 52 例 51 绿(唯一红=BUG-010 家族 marker-breathing,隔离复跑绿);lint PASS。
- **问题**：① M3-04「任意机位」e2e 只取两组代表性采样,穷举不可行(测试注释已声明);② M3-05 折叠态共享同一 background 声明未单独断言;③ M3-05 口径(CSS 声明色 vs 合成像素)属 qa 明确设计选择,如需变更走口径讨论非缺陷;④ 视觉批次一机械场景仅余 M3-01(行明度三档,BUG-025 关单锚点)。
- **下一步**：并行:qa 卡 M3-01+BUG-025 关单、aes 新实例 /aes-review 验收(对照截图给用户);其后 qa FM-11 量测(M2-23/24)、dev 卡 BUG-028+BUG-033(scripts 串行窗口)、BUG-010 qa 处置、REGRESS=1+M2 重签核(新 rev 实例)→ tag。
