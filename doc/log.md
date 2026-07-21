# log — 交接日志（新的在上；仓库内最多 4 块，超限 `make docs-archive`）

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

## [0.2.18] 2026-07-21 M3-02/03 视觉契约实测双绿——昼夜对比与 severity 三通道有测锚定
- **做了什么**：qa 卡实测视觉批次一两大契约场景:① M3-02 昼夜对比(e2e/day-night-hemisphere-contrast.spec.ts 新增):C-2 定死方法落地——±40° 对称采样、Rec.709 luma 直接加权、亮像素排除阈值 90(注释定稿)、采样几何用「同一均匀底面点在对称 sunDir 下两次采样」等价实现+method-sanity 断言;主判据落 [1.8,2.6]、副判据 ≥1.3 均过,未触下界(dev 落值经权威几何验证站住)。② M3-03 severity 三通道(e2e/marker-severity-tri-channel.spec.ts 新增):取 REV-013 §3.1 路径 b,三色相族×三档逐通道 ±6/255、色相不变量 ±2°、L/S 单调、发光通道黑盒读环实例缩放(sev1 恒 0/sev2 静态波动<3%/sev3 脉冲波动>15%,按累计真实毫秒推进防 flake)。globeDebug 增两 helper。qa 自设的 sev1 像素计数下限 40→20 属测试基建阈值自调,非判据变更。
- **证据**：doc/evidence/v0.2.17/M3-02.log+M3-02-day-night-hemisphere-contrast.png、M3-03.log+两张截图(三档分层+发光对照);全量 e2e 49/50(唯一红 marker-breathing 隔离复跑绿,与 BUG-010 已登记条目逐字吻合,不另开单);lint PASS。
- **问题**：① M3-02 采样等价性依赖「矢量底面空间均匀」前提,底面引入纹理/噪声时须改真实异地采样(注释已声明);② M3-03 发光断言耦合 rings 结构假设,改动会显式 FAIL 非假绿;③ 低饱和分类色相反解噪声大,现三类均高饱和未触边界;④ BUG-010 家族 flake 又复现一次(marker-breathing)。
- **下一步**：qa 卡 M3-04+05(星空封顶+面板暗于球);aes 新实例 /aes-review 验收(对照截图给用户);qa FM-11 量测(M2-23/24);dev 卡 BUG-028+BUG-033(scripts 串行窗口);BUG-010 qa 处置;REGRESS=1+M2 重签核(新 rev 实例)→ tag。
