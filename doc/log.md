# log — 交接日志（新的在上；仓库内最多 4 块，超限 `make docs-archive`）

## [0.2.2] 2026-07-21 USGS/EONET provider 落地 + G-2/G-3 仲裁 pin——发现清扫语义缺陷 BUG-018
- **做了什么**：① qa 抓五份正式 fixture 入 tests/fixtures/（usgs×2/eonet/gdacs/ll2-list，README 登记抓取时间），后补 ll2-detailed；② dev 实现 usgs.ts/eonet.ts 并注册 T1_PROVIDERS（G-1 包围盒降维含合成样本自证）；③ qa 登记并测 M2-05（USGS 映射,19 用例）/M2-06（EONET 映射,16 用例）✅，FM-06 场景列回填；④ arch 依 fixture 出 G-2/G-3 提案（GDACS「人道响应字段」实测不存在;LL2 mode=list 实测无工位坐标）→ rev REV-008 放行并三裁：humanitarian 判类=eventtype∈{DR,FL}（方案A）、LL2 端点换 mode=detailed（预算不变）、R-1 过期语义登记 BUG-018 不捆绑;⑤ orch 应用 SPEC-5.3/5.5 全文替换（spec v0.2.2）+ pin，同步 M2-data.md §2.2 与 testplan M2-01 精确断言口径。
- **证据**：doc/evidence/v0.2.1/M2-05.log、M2-06.log（机械生成）；仲裁链 doc/design-prompt/proposal-gdacs-ll2.md → doc/review/REV-008-gdacs-ll2.md；lint+unit 全量 PASS。
- **问题**：**BUG-018（OPEN，rev 建议 M2 签核前闭合）**——store 清扫按事件 ts 判过期,EONET 长寿命 open 事件（fixture 实测 24/26 条真龄>72h）首轮 sweepExpired 即被误清,GDACS ts=datemodified 同根因;rev 倾向 Design Y（按最后见到时刻续期）,须走 §7:arch 提 SPEC-6.3 语义澄清 → rev pin → dev 改 store → qa 补真龄场景并复测 M2-02。
- **下一步**：① BUG-018 修复链（优先,EONET 已 live）;② dev 实现 gdacs.ts/ll2.ts（SPEC-5.3/5.5 已 pin,注意 GDACS UTC 解析陷阱）+ qa M2-07/08;③ qa 关 M2-01（四源齐后精确断言）;④ FM-07 标记层 + FM-08 矢量默认（首个可视化切片,完成后通知产品负责人验收）。

## [0.2.1] 2026-07-21 数据核心骨架落地——M2-02/03/04 全绿,OpenSky CORS 封死登记
- **做了什么**：① CORS 独立探测（orch 轻量执行，产品负责人指示，样本与响应头留 scratchpad 未入库）：七源中六源（USGS/EONET/GDACS/LL2/GDELT/CoinGecko）ACAO 通配可浏览器直连，**OpenSky 钉死自有域→web 端直连不可行**，登记 BUG-017（SPEC-5.6 可行性假设不成立，M3 FM-12 开卡前仲裁）；GDACS 单响应 634KB 体量已知会。② dev 按 M2-data DP 实现 `src/data/` 骨架（types/store/http/scheduler/cache/index，providers 空数组开口，零 three 依赖），自检 lint+全量单测绿。③ qa 两卡串行：M2-02（store 去重/过期窗）、M2-03（独立轮询）、M2-04（退避×2^n 上限 30min/条件请求/故障隔离）三场景 ✅，证据 doc/evidence/v0.2.0/。M2-01 留 🔲（归一化需 provider，待后续卡）。
- **证据**：doc/evidence/v0.2.0/M2-02.log、M2-03.log、M2-04.log（均 evidence.py 机械生成）；lint+unit 全量 PASS（test-results/）。
- **问题**：① dev 登记两处非阻塞张力待后续判：空轮/304 轮不触发清扫（与 DP §2.5 措辞微张力）、createDataLayer 无参签名致装配级 round-trip 测试需挂全局 fake-indexeddb；② cache（SPEC-3.11/8.4 数据侧）尚无场景覆盖——属 FM-09 范围，开卡时登记；③ BUG-017 悬至 M3。
- **下一步**：provider 卡——dev 实现 usgs.ts+eonet.ts（G-1 已 pin）+ 正式抓四源 fixture（含头注抓取时间；gdacs/ll2 仅捕获原始响应供 arch 提案 G-2/G-3，映射禁实现）；qa 接 M2-01 归一化断言;随后 arch 依 fixture 提 G-2/G-3 → rev 仲裁 → pin。FM-07/08 视觉切片临近,出可视化结果时通知产品负责人验收。

## [0.2.0] 2026-07-20 M2 开卡——FM-05 场景登记、数据核心 DP 过门禁、G-1 入 spec
- **做了什么**：M2 首切片。① qa 登记 M2-01~04（FM-05 数据核心：归一化/去重过期/轮询限流/退避与故障隔离），FM-05 场景列已回填；② arch 交付 `design-prompt/M2-data.md`（数据核心+T1 provider 框架），REV-007 四项门禁全过（行为泄漏/极简/锚点/与 testplan 一致性），**可派 dev**；③ G-1（EONET 非 Point geometry 降维）经 REV-007 §2 即裁，SPEC-5.2 修订入 spec（v0.2.1）并重 pin；④ F-1 失配修正：M2-02 的 flight-60s 子句在 M2 不可满足，依裁决改挂 M3 FM-12 承接，登记 BUG-016（FIX_READY）；⑤ 另：命名核查完成（doc/research/naming-202607.md），用户裁定保留 Worlens（D4 二次修订），research 角色与两份调研报告入库；CLAUDE.md 权责改写（orch 全权，用户反馈制）。
- **证据**：均为文档/spec 变更，无测试面；门禁与裁决链 doc/review/REV-007-M2-data-gate.md；`make docs-check` 通过。
- **问题**：① G-2（GDACS 字段来源）/G-3（LL2 字段来源与 list 模式坐标）未裁——REV-007 §3 裁定次序：抓 fixture → arch 提案 → rev 仲裁 → pin → dev 才可实现 gdacs/ll2 映射；② CORS 风险（REV-007 §4）：dev 抓 fixture 时须浏览器侧实测各源 CORS 头，某源封死则登记 bugs 走仲裁；③ O-1/O-2 两条非阻塞小项在 REV-007 §5。
- **下一步**：派 dev 实现 REV-007 §3.2 安全范围（types/store/http/scheduler/cache/index/usgs/eonet——G-1 已 pin 故 eonet 解锁）+ 抓四源 fixture（含 CORS 实测）；随后 arch 依 fixture 提 G-2/G-3 映射提案。M2-01~04 测试由 qa 在 dev 交付后接卡。
