# REV-016 — BUG-017 OpenSky CORS 定向仲裁

- 日期：2026-07-22
- 类型：仲裁（spec 契约缺陷，CLAUDE.md §7 路径）
- 对象缺陷：doc/bugs.md BUG-017（spec 契约 SPEC-5.6 OpenSky）
- spec 依据：SPEC-5.6（航班图层 opensky states/all）、SPEC-5.9（CORS 受限能力归原生端先例）、SPEC-8.7 / §9（阶段一零服务器）、SPEC-5.10（信任分级）、SPEC-6.3①（flight 60s 过期窗）、doc/product-decisions.md D29（开源优先）/ D30（信源扩张默认后置）
- 裁决人：rev 新实例（独立复验，未采信 BUG-017 登记的转述证据）

---

## 1. 背景与待裁三方向

BUG-017 登记称 OpenSky `states/all` 的 `Access-Control-Allow-Origin`（ACAO）钉死自有域、web/PWA 浏览器直连被同源策略封死；其余六源返通配 ACAO 可直连。原始 CORS 探测记录存于上一会话 scratchpad，本实例读不到，故**独立复验**后再裁。

待裁三方向（不预设）：① 航班图层改**原生端专属**挂 M6（比照 SPEC-5.9 先例）；② **另择 CORS 开放的航班源**；③ **降级**（砍图层或改静态）。

## 2. 独立复验（curl 带 Origin 头实测）

探测端：curl（服务端到服务端，本身不施行浏览器同源策略），带 `Origin: https://example.com` 观察响应 ACAO——ACAO 只有等于请求 Origin 或为通配星号时，浏览器才放行跨域读取；钉死为第三方固定域即等价于对任意 web/PWA 应用源封死。

**目标源 OpenSky**（探测 1 次，匿名额度 X-Rate-Limit-Remaining: 399，未刷）：

```
GET https://opensky-network.org/api/states/all?lamin=45&lomin=5&lamax=48&lomax=10
Origin: https://example.com
→ HTTP/1.1 200
  Access-Control-Allow-Origin: https://opensky-network.org      ← 钉死自有域，非通配
  Vary: Access-Control-Request-Method / Access-Control-Request-Headers
  X-Rate-Limit-Remaining: 399
```

ACAO = `https://opensky-network.org`，恒不等于任何 web/PWA 应用源 → **浏览器跨域读取被同源策略拦截**。curl 请求本身成功（服务器未拒），证明这纯是**浏览器同源策略**问题，非服务端封禁——原生端（Capacitor）请求不受 CORS 约束，可正常取数。**BUG-017 核心断言成立。**

**对照源（登记称可直连）**：

| 源 | 实测 ACAO | 结论 |
| --- | --- | --- |
| USGS 2.5_hour.geojson | 通配星号 | 可直连 |
| NASA EONET v3 events | 通配星号 | 可直连 |
| CoinGecko simple/price | 通配星号 | 可直连 |

三对照源全部返通配 → **「opensky 独异」成立**（其余源不受此限，缺陷范围仅限航班图层，不牵动其他源与渲染）。

**候选替代航班源探测（为方向②取证）**：

| 候选源 | 实测 | CORS 是否开放 |
| --- | --- | --- |
| adsb.fi opendata v2 | HTTP 200 但**无 ACAO 头** | 否（浏览器同样拦截） |
| airplanes.live v2/point | ACAO = 通配星号 | 是（浏览器可直连、无 key） |

即：确实存在一个 CORS 开放、无需 key、免费的航班源候选（airplanes.live）——方向②在**技术上可行**，须与 D29/稳定性一并权衡（见 §5）。

复验结论：BUG-017 登记内容与独立实测一致，无失真。

## 3. 裁决：方向① — 航班图层改原生端（Capacitor）专属，挂 M6

依据（逐条指回 spec / decision）：

1. **结构约束封死 web 侧绕行（§9 / SPEC-8.7）**：阶段一零服务器，唯一服务端例外 = 遥测心跳，**不得自建 CORS 代理**。opensky 的钉死 ACAO 在 web 侧无合规绕行手段，实测已确认。
2. **既有先例直接同构（SPEC-5.9）**：spec 已把「CORS 受限能力」明确归**原生端（Capacitor）M6**——自定义 RSS 中非 CORS-open 的 feed 即走原生端 M6，web/PWA 端「明确提示受同源策略限制」。航班图层是**同一模式**，按先例归位，无需新设机制。
3. **主交付目标即原生端（CLAUDE.md 抬头）**：产品最终以 iOS via Capacitor 打包。原生请求不受 CORS 约束 → OpenSky 在**实际发布形态上完整可用**；web/PWA（M5）为中间渠道。航班图层为原生端专属并不削弱主产品，只如实反映 web 渠道的浏览器限界。
4. **保源即零信息损失（SPEC-5.10）**：OpenSky 已在 SPEC-5.10 列为「权威事件源」、已集成（FM-12）。方向①保留 OpenSky 为源，仅改**平台归属**，不改源接口/字段/信任性质，改动面最小、可追溯性最强。
5. **D30 收窄**：信源扩张须为「可信+低噪+为我而变」服务，否则默认后置。为在 web 保住航班图层而切换到志愿社区源（方向②）属为扩张而扩张，与 D30 取向相悖；原生端 M6 承接即「默认后置」的恰当落点。

方向③（降级/砍）被①支配：原生端能以 OpenSky 完整交付，无必要砍除；静态展示对实时航迹无意义。

## 4. SPEC-5.6 改法指引（供 orch 应用，rev 不改正文）

orch 依本裁决应用时，建议对 SPEC-5.6 做如下最小修订（须走「修改记录 + pin-spec + 同步 testplan」三步）：

1. **航班图层加平台归属句**：标注航班图层为**原生端（Capacitor）专属能力，M6**——因 OpenSky `states/all` 的 ACAO 钉死自有域（实测 `Access-Control-Allow-Origin: https://opensky-network.org`），web/PWA 浏览器直连被同源策略封死，且 §9 阶段一零服务器不得自建 CORS 代理绕过；比照 SPEC-5.9「CORS 受限能力归原生端」先例。
2. **web/PWA 端明示（M5）**：web/PWA 不呈现航班图层开关，或呈现为**禁用态并明确提示受浏览器同源策略限制**（比照 SPEC-5.9 对非 CORS-open feed 的明示要求）。
3. **保留 OpenSky 为源**：源地址、视口 bbox、60s 轮询、`severity` 恒 1、关图层立即停拉等接口形态不变（原生端不受 CORS 限制，照现文实现）。
4. **SPEC-6.3① flight-60s**：随图层移出 M3、改挂 M6（原生端），过期窗以 `lastSeen` 计窗语义不变。
5. **无需改动项（留痕以免误改）**：SPEC-5.10 中 opensky 的「权威事件源」分级**不变**（SPEC-5.10 已明说信任分级与 SPEC-5.8 解析分层正交，本次仅改平台归属、不改来源性质）；SPEC-5.8 T1 枚举本就未含 opensky（SPEC-5.10 已注「OpenSky 自带航迹坐标却不在 T1 枚举、仍属权威」），无需改。

## 5. 被否方向留证（供 orch 复议时参考）

- **方向②（另择 CORS 开放航班源）——技术可行但当前不采**：实测 airplanes.live（`api.airplanes.live/v2/point`）返通配 ACAO、无需 key、免费，浏览器可直连；adsb.fi 无 ACAO 不可用；ADS-B Exchange 需 key（RapidAPI，付费）违 SPEC-5.x「全部免费、无需 key」。不采 airplanes.live 的理由：(a) **D29 商用许可存疑**——志愿社区聚合源的商用/高频使用条款须 orch 核实其是否「开源可商用」，本仲裁无法从探测确认，对付费产品是实质风险，不宜默认采纳；(b) **稳定性风险**——社区源的未文档化通配 ACAO 可随时变更，一旦收紧则 web 航班图层静默失效，为一个默认关闭、severity 恒 1 的次要能力承担此脆弱性不划算；(c) **改动面更大**——切源须重写 SPEC-5.6 字段映射、改 SPEC-5.10 信任表（opensky→airplanes.live）、重做 fixtures 与 provider，涟漪远大于方向①。**复议条件**：若 orch（产品权责方）后续判定 web/PWA 航班图层为产品关键，且已核实 airplanes.live 商用许可与 CORS 稳定性，可另起 §7 提案revisit。
- **方向③（降级/砍）——被①支配，否**：原生端可以 OpenSky 完整交付，砍除损失产品吸引力且无必要；静态展示对实时航迹无意义。

## 6. 涟漪处置

**FM-12（M3，doc/feature-matrix.md 第 20 行）**：现文承接 GDELT/OpenSky/CoinGecko（SPEC-5.4/5.6/5.7）+ SPEC-6.3① flight-60s。航班图层移出 M3 后，orch 应用时须：从 FM-12 摘除 OpenSky（SPEC-5.6）与 flight-60s 承接（保留 GDELT/CoinGecko 于 M3），并为原生端 OpenSky 航班图层在 M6 另立 FM 行或标注承接锚点。

**BUG-016（现 FIX_READY）——复验前提失效，须 orch 重新处置（本仲裁不替其关单，仅标明后续处置）**：BUG-016 此前依 REV-007 F-1 把 M2-02 的 flight 子句**改挂 M3 FM-12**由 opensky provider 承接 SPEC-6.3①，复验条件为「M3 FM-12 开卡时 qa 核对 flight-60s 场景已登记」。本裁决把 opensky/航班图层移出 M3 后，该「改挂 M3 FM-12」的落点作废、其复验前提不再成立。处置指引：orch 应将 flight-60s（SPEC-6.3①）**再改挂 M6 原生端航班图层**，BUG-016 复验条件相应改为「M6 native 航班图层开卡时 qa 核对 flight-60s 场景已登记」。**不受影响**：M2-02 保留的「同 id 去重 + 48–72h 过期窗」判据与 flight 无关，维持现状。

## 7. BUG-017 状态处置

状态由 OPEN 置 **FIX_READY**（比照 BUG-016 惯例：裁决方向已定、待 orch 应用 spec 改法 + 修改记录 + pin，随后走复验关单）。裁决摘要与涟漪已回填 doc/bugs.md BUG-017 行。复验口径：待 SPEC-5.6 改法 pin 后，于 M6 native 航班图层开卡时由 qa（≠ 本仲裁人）核对 flight-60s 场景已按新平台归属登记，机械/核对记录任一按当时可复现性择用。

## 8. 结论

- **裁定方向：① 航班图层改原生端（Capacitor）专属，挂 M6**，OpenSky 保留为源。
- 独立复验确认 opensky ACAO 钉死自有域、三对照源通配、opensky 独异成立；§9 零服务器封死 web 侧代理绕行。
- SPEC-5.6 改法指引见 §4，被否方向留证见 §5，涟漪（FM-12 + BUG-016）见 §6。

—— rev（REV-016），2026-07-22
