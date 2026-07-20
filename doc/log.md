# log — 交接日志（新的在上；仓库内最多 4 块，超限 `make docs-archive`）

## [0.2.0] 2026-07-20 M2 开卡——FM-05 场景登记、数据核心 DP 过门禁、G-1 入 spec
- **做了什么**：M2 首切片。① qa 登记 M2-01~04（FM-05 数据核心：归一化/去重过期/轮询限流/退避与故障隔离），FM-05 场景列已回填；② arch 交付 `design-prompt/M2-data.md`（数据核心+T1 provider 框架），REV-007 四项门禁全过（行为泄漏/极简/锚点/与 testplan 一致性），**可派 dev**；③ G-1（EONET 非 Point geometry 降维）经 REV-007 §2 即裁，SPEC-5.2 修订入 spec（v0.2.1）并重 pin；④ F-1 失配修正：M2-02 的 flight-60s 子句在 M2 不可满足，依裁决改挂 M3 FM-12 承接，登记 BUG-016（FIX_READY）；⑤ 另：命名核查完成（doc/research/naming-202607.md），用户裁定保留 Worlens（D4 二次修订），research 角色与两份调研报告入库；CLAUDE.md 权责改写（orch 全权，用户反馈制）。
- **证据**：均为文档/spec 变更，无测试面；门禁与裁决链 doc/review/REV-007-M2-data-gate.md；`make docs-check` 通过。
- **问题**：① G-2（GDACS 字段来源）/G-3（LL2 字段来源与 list 模式坐标）未裁——REV-007 §3 裁定次序：抓 fixture → arch 提案 → rev 仲裁 → pin → dev 才可实现 gdacs/ll2 映射；② CORS 风险（REV-007 §4）：dev 抓 fixture 时须浏览器侧实测各源 CORS 头，某源封死则登记 bugs 走仲裁；③ O-1/O-2 两条非阻塞小项在 REV-007 §5。
- **下一步**：派 dev 实现 REV-007 §3.2 安全范围（types/store/http/scheduler/cache/index/usgs/eonet——G-1 已 pin 故 eonet 解锁）+ 抓四源 fixture（含 CORS 实测）；随后 arch 依 fixture 提 G-2/G-3 映射提案。M2-01~04 测试由 qa 在 dev 交付后接卡。

## [0.1.3] 2026-07-20 路线图重排 v2——产品定位收敛与 spec v0.2 落地
- **做了什么**：产品负责人两轮定位讨论收敛为 21 条决议（新增 `doc/product-decisions.md`，D1–D21：glanceable「世界的表盘」定位、产品名 Worlens、个性化前移、矢量默认+付费风格包、解析分层 T1–T4、分阶段架构等）。arch 出重排提案 `doc/design-prompt/proposal-roadmap-v2.md`，rev 首轮打回（REV-005，K-1~K-4：SPEC-7.4/3.4 蒸发、搜索缺正文、首启引导缺地理维度），arch 修订后 REV-006 放行。orch 应用 spec v0.2（改 13 处 + 新增 SPEC-2.5/3.9/3.10/3.11/5.8/5.9/8.6/8.7/8.8 共 22 项，按 REV-006 勘误口径含 SPEC-1 与 §9）+ pin；feature-matrix 换 v2 新表（FM-05~26，里程碑 M2–M6，场景列待各 M 开卡登记）；BUG-014 置 FIX_READY（UTC 时钟落 FM-10/M2）。补打 tag v0.1.2。**M1-05/06/14 再归属留痕（REV-005 A3 裁决）**：三场景 ✅ 保留，其实证的是卫星纹理路径的昼夜表现，不覆盖 SPEC-3.2 重写后的「矢量默认风格」——矢量默认昼夜是零覆盖新行为，M2 FM-08 必须建真实场景，否则构成新蒸发。
- **证据**：纯文档/spec 变更，无测试面；仲裁链 doc/review/REV-005-roadmap-v2.md（打回）→ doc/review/REV-006-roadmap-v2-recheck.md（放行）；`make docs-check` 通过。
- **问题**：orch 落地携带的两项开放依赖（REV-006 记录在案）——① A4：M5 合规收口需 BUG-015 工具扩展或独立签核子件二选一，M5 前决；② A5：遥测明示载体与时序（M3 引导预留位或 M5 独立提示），M3 开卡前决。
- **下一步**：开 M2（`make bump MILESTONE=M2`）——首卡为 qa 登记 M2 场景行（提案 §4 覆盖点清单），并按提案 §4.1 带入 REV-004 欠账 R-1/R-2/R-3(列表联动分片)/R-5/R-6/R-8/R-11 与 BUG-010/012/013/015 的 M2 处置；BUG-014 复验（核对记录型）由独立 qa 出具。

## [0.1.2] 2026-07-20 Git 约定补明「commit 即 bump」
- **做了什么**：CLAUDE.md §6 新增约定「commit 即 bump」——每次提交都伴随 `version.json` 的 x.y.z 版本递增（`make bump`），没有不带版本递增的提交（用户拍板补明）。此前该要求散在 §5.1「实质性变更要 bump」与 /closeout 步骤里，未与 commit 动作显式绑定。
- **证据**：纯文档变更，无测试面；`make docs-check` 通过。
- **问题**：无。
- **下一步**：同 0.1.1 块——开 M2 事件数据层（FM-05/06/07），先核对四笔跨里程碑欠账与 6 条 OPEN 缺陷。
