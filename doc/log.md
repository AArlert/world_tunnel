# log — 交接日志（新的在上；仓库内最多 4 块，超限 `make docs-archive`）

## [0.2.23] 2026-07-21 BUG-010 flake 家族治理+三缺陷收官——e2e 稳定性达标,签核前置全清
- **做了什么**：① qa BUG-010 治理卡(限额中断,orch 回收核对补验):8 个 e2e spec 负载敏感采样加固(idle-spin/day-night-calibration/zoom-range/drag-inertia/marker-breathing/marker-severity-tri-channel/panel-marker-linkage)+globeDebug 新增 125 行稳健采样 helper,断言强度未降;BUG-010 置 CLOSED 挂机械证据(全量 e2e 绿 log)。**中断实例未交汇报,orch 依纪律不采信其口头压力轮次,自行补跑两轮全量 e2e(默认 8-worker)均 PASS——合计三轮全并发绿,关单核验成立**;docs-check OK、bugs.md 表未损坏。② orch 依核对记录(doc/evidence/v0.2.22/BUG-028-033-verification.md,独立 qa 正反两向+判别力抽查全 PASS)置 BUG-028/033 CLOSED。
- **证据**：doc/evidence/v0.2.22/BUG-010.log(机械生成)、BUG-028-033-verification.md;orch 补跑 test-results/e2e_all.log 两轮 PASS。
- **问题**：① 中断实例的 e2e 改动逐行审查未做(diff 251+/57-),数量大但三轮全绿+断言可跑通,残余风险留 M2 重签核 rev 审查兜底;② BUG-036(判据齐备提示无时效校验)未修,本轮签核显式重跑 REGRESS 规避;③ 未关缺陷余 8 条,均 M3+/工具债性质(011/012/013/015/016/017/029/031/032/036),无 M2 阻塞项。
- **下一步**：显式 make regress → make evidence REGRESS=1 → rev 新实例 M2 签核卡(三硬条件核对+signoff-M2.md)→ orch 打 tag。其后 M3 立项:D22 信任层 spec 前置、BUG-017 OpenSky 仲裁、BUG-016 flight-60s 场景登记、动效批(BUG-031/D27 光柱)与视觉第二批(BUG-032/D24)。

## [0.2.22] 2026-07-21 scripts 修复窗:BUG-028/033 双修——签核误报与视觉守卫误判消除
- **做了什么**：① dev 卡:BUG-028(docs.py next_action 新增 FM 行零场景检查——当前里程碑存在零场景 FM 行时列出缺卡行、不提示签核;真实台账行为不变+scratch 构造 FM-11 清空态验证)、BUG-033(evidence.py scenario_needs_shot 改分句+交叉引用检测——M2-13 误判消除,全部真视觉场景 M0-02/M1-05/07/08/M2-10/15/21/M3-01~06 拦截保持,双向 CLI 实测;未采纳 bugs.md 期望文本的字面精确匹配,因会漏判 M0-02/M3-01 削弱守卫,理由入注释),两条置 FIX_READY。② orch 依 §5.3 登记 BUG-036(dev 观察上报:make next 判据②③用 any() 扫历史证据目录无时效校验,「三条判据齐备」可能假绿;修复前 orch 签核一律显式重跑 REGRESS 不采信该提示)。
- **证据**：本切片 dev 自检:docs-check OK、make handover/next 输出零回归、lint PASS;两缺陷验证命令与结果详见 bugs.md 回填段。复验归独立 qa(核对记录型,scripts 无 vitest 覆盖,工具侧限制见 BUG-015)。
- **问题**：① BUG-033 分句启发式依赖现台账措辞,新写法出现时需再细化(注释已声明);② BUG-028 检查仅在「场景全 ✅」分支内生效,场景未全绿时零场景 FM 行不提前可见(与登记期望落点一致,扩大可见性需另登缺陷);③ scripts 无机械回归覆盖属系统性风险(dev 建议评估,orch 暂记流程债不立即立项);④ BUG-036 未修,M2 签核走显式重跑。
- **下一步**：并行:qa 核对记录卡(BUG-028/033 复验,§5.3-4 口径)、qa BUG-010 flake 家族治理卡;毕后显式 make regress+evidence REGRESS=1+M2 重签核(新 rev 实例)→ tag。

## [0.2.21] 2026-07-21 FM-11 基线落地+缓存生命周期双缺陷闭环——M2 场景全绿
- **做了什么**：① qa FM-11 卡:M2-23(tests/build-budget.test.ts,首包 raw 810.7KB/gzip 225.1KB 入证据,卫星纹理 2.54MB 物理隔离不计首包)、M2-24(e2e/cold-start-perf.spec.ts,冷启动→可交互 ~300ms、缓存上屏 ~200ms、帧率 ~61fps,vite preview 生产服基线,门禁留 M5),双 ✅——**M2 全部场景就此全绿**;vite.config.ts 补 test.reporters 修 vitest 非 TTY 不回显 console 问题。② 量测中挖出 BUG-034(StrictMode 双调用下 stop() 在 cache.load 未 settle 时空快照覆写 IndexedDB,数据丢失级,dev server 100% 复现、production 不受影响):dev 修复(cacheLoaded 闸门)→ qa 判别力核查复验关单;复验扩检查点又挖出 BUG-035(早停实例晚到 load 翻闸门,二次 stop 复活覆写):dev 修复(闸门翻转收进 !stopped 块)→ 新 qa 实例判别力核查复验关单。两缺陷均 CLOSED,每层有故意红复现测试钉住后修绿。③ BUG-010 第三轮观察面扩充(高并发下 marker-severity-tri-channel 新增像素误读一例)。
- **证据**：doc/evidence/v0.2.20/M2-23.log、M2-24.log、BUG-034.log、BUG-035.log(均机械生成);全量单测 179/179、lint PASS;判别力核查两轮(还原修复→红,恢复→绿,diff 逐字节一致)。
- **问题**：① BUG-035 遗留可选加固点:正常实例重复 stop 属幂等重复写非数据丢失,未补断言(qa 判定非阻塞);② e2e 层 StrictMode 真实浏览器检查点未做(成本高,列遗留);③ M2-24 数值系本机 vite preview,M5 须按真实验收环境重测;④ 全量 e2e 高并发 flake(BUG-010 家族已扩至 3 例)是 REGRESS 100% 的直接威胁,签核前必须处置。
- **下一步**：dev 卡 BUG-028+BUG-033(scripts 修复窗,期间不派用 evidence 的卡);qa 卡 BUG-010 flake 家族治理(负载敏感断言加固);REGRESS=1+M2 重签核(新 rev 实例)→ tag;动效批(BUG-031/D27)与视觉第二批(BUG-032/D24)待 M2 关后立项。
