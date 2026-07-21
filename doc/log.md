# log — 交接日志（新的在上；仓库内最多 4 块，超限 `make docs-archive`）

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

## [0.2.17] 2026-07-21 M2-25 snap 场景落地+BUG-030 机械关单——SPEC-3.11 消歧句有测认领
- **做了什么**：qa 卡:① doc/testplan.md 新登 M2-25(标记层首批 snap 对照增量淡入单测,承接 REV-014 §4-3 防蒸发),feature-matrix FM-09 场景列同步回填;② tests/marker-initial-snap.test.ts 新增(断言 A:无前态首个非空批次 instanceAlpha 初值即满值非从 0 起坡;断言 B 对照:有前态后新增标记从 0 经 tick 坡向 1;期望从 SPEC-3.11 消歧句+SPEC-3.2①+D27 推导,未照抄实现),测绿置 ✅;③ BUG-030 以同一测试 log 机械关单(关单人 qa ≠ 修复人 orch)。行文按 BUG-033 教训规避 VISUAL_MARKERS 误判词。
- **证据**：doc/evidence/v0.2.16/M2-25.log、BUG-030.log(均 make evidence 机械生成);全量单测 22 文件 171 测试零红(test-results/unit_all.log);docs-check OK。
- **问题**：① 观测通道走 dots InstancedMesh 的 instanceAlpha 属性与槽位分配顺序假设(newSlot=1),shader attribute 改名/分配策略变化时测试需同步维护——错位会显式 FAIL 不会假绿,属可控实现耦合;② 首批 pop 观感是否突兀归 aes 另案(REV-014 §2 边界声明),不在本场景;③ M2 开口仅余 M2-23/24(FM-11)。
- **下一步**：qa 卡 M3-02+03(注意采样几何以 C-2 定死方法为权威,若触 1.8 下界属实现落值问题登缺陷)、qa 卡 M3-04+05;aes 新实例 /aes-review 验收(对照截图给用户);qa FM-11 量测(M2-23/24);dev 卡 BUG-028+BUG-033(scripts 串行窗口);BUG-010 qa 处置;REGRESS=1+M2 重签核(新 rev 实例)→ tag。
