# NewsGlobe(newsglobeworldmap.com)流量与运营状态核查(2026-07)

- 调研员:RES 实例(新实例)
- 调研日期:2026-07-21(所有 URL 抓取日期同为 2026-07-21,除另行标注)
- 输入背景:`doc/research/rss-geo-202607.md`(NewsGlobe 相关节)、实测截图 `doc/attachment/newsglobeworldmap.com.png`、`doc/product-decisions.md` D14/D23(D14 修订已明列「访问量核查另卡」,本报告即该卡的回填)
- 核查对象:**newsglobeworldmap.com**(站点自述「NewsGlobe — World News on the Map」,页脚署名「Created by DimaRV」)。**注意区分同名不同物**:另有 `newsglobe.app`(「The World's Front Pages」)与若干 GitHub 同名开源项目(`EXTREMOPHILARUM/newsglobe`、`MuslimConditions/NewsGlobe`),**均非本对象**。
- 体例:每节先「✅ 事实(附来源 URL + 抓取日期)」后「🔶 推测/判断」,两栏严格分开;无可靠信号处显式标注「未找到」并写明查了什么。
- **边界声明(重要)**:本报告全部为**公开 Web 检索层面观察**,非店内穷举、非源码核验、非法律结论。① 流量:SimilarWeb/Semrush/Hypestat 三家数据页对抓取工具返 403 或验证码墙,**未能直读其原文「无数据」措辞**,结论由「主流工具无可索引档案 + 可读取的 StatShow 估算」综合推断;第三方流量估算器在低流量段本身极不可靠,可信信号是「**低于主流工具测量门槛**」而非某个具体数字。② WHOIS 注册人身份被隐私屏蔽,「俄罗斯」由注册商/NS/IP/电话推断,非注册人记录直读。③ Wayback 完整快照清单未能取得(web.archive.org 对本会话抓取工具不可达),最早日期经 availability API 间接确认。本报告不做决策,只给证据与权重。

---

## Q1 流量量级

### ✅ 事实

逐个工具查询结果如下(抓取 2026-07-21):

| 工具 | 查询结果 | 来源 |
| --- | --- | --- |
| **SimilarWeb** | 直连数据页 `similarweb.com/website/newsglobeworldmap.com/` 返回 **HTTP 403**(反爬墙),未读到数据;针对该域名的 Web 检索**未返回任何 SimilarWeb 已索引的流量档案页**——即该域名在 SimilarWeb 无可查档案。 | [similarweb.com/website/](https://www.similarweb.com/website/)(403);检索无档案 |
| **Semrush** | 直连 `semrush.com/website/newsglobeworldmap.com/overview/` 落在「Checking your browser」验证码墙,**未读到任何流量/权重/外链数字**。 | [semrush.com/website/](https://www.semrush.com/website/)(验证码墙) |
| **Hypestat** | `hypestat.com/info/newsglobeworldmap.com` 返回 **HTTP 403**,未读到数据。 | hypestat.com(403) |
| **urlrate** | `urlrate.com/www/newsglobeworldmap.com` 返回 **HTTP 404**——无该域名的估算档案。 | urlrate.com(404) |
| **StatShow** | **可读取**。估算:日访客约 **1**、日 PV 约 **1**、月访客/PV 约 **30**、估值约 $10;报告自述该域名「非常新(2026-03-22 创建)、流量极小、在各大搜索引擎几乎无排名与可见性」。 | [statshow.com/www/newsglobeworldmap.com](https://www.statshow.com/www/newsglobeworldmap.com) |

- SimilarWeb 官方文档口径:其排名/访问量指标对流量样本量有下限要求,样本不足者不给估计(展示为无数据);其访问量指标定义见 [SimilarWeb Visits 文档](https://developers.similarweb.com/reference/visits)、[Website Rankings Report](https://support.similarweb.com/hc/en-us/articles/360020741158-Website-Rankings-Report)。**该域名在 SimilarWeb/Semrush/urlrate 均无可查档案,即落在这些工具的测量门槛之下。**

### 🔶 推测/判断

- **该站流量处于「主流工具测量门槛之下」的量级**。SimilarWeb/Semrush 这类工具对极低流量站点通常直接返回「数据不足/无排名」——业界普遍引用的经验门槛约在**月访问量数千级以上**才会给出稳定估计(SimilarWeb 未公开精确阈值)。本站在三家均无档案,配合唯一可读的 StatShow 给出「~30/月、几乎无搜索可见性」,可综合判断其**真实月访问量大概率在数百级甚至更低**,远未达到「数千~数万」的可估计量级。
- StatShow 的「30/月、$10 估值」不应当作精确测量——低流量段这类估算器多为**保底/占位值**;真正有信息量的是「**多家工具查不到 = 低于门槛**」这一事实本身。对一个 2026-03 才注册、2026-07 仍在营的站点,这与「刚上线、几乎无自然流量」的画像自洽。

---

## Q2 运营史

### ✅ 事实

**域名 WHOIS(两次 who.is 查询交叉核对,抓取 2026-07-21):**
- **创建日期:2026-03-22**;更新日期 2026-03-22;**到期 2027-03-22(仅注册 1 年)**。
- 注册商:**Beget LLC**(俄罗斯主机商,whois.beget.com);注册商 abuse 电话 **+7.8123854136**(俄罗斯圣彼得堡区号)。
- Name servers:ns1/ns2.beget.com、ns1/ns2.beget.pro;站点 IP **45.130.41.125**;状态 clientTransferProhibited。
- 注册人组织/国家:**未披露**(隐私屏蔽)。
- 来源:[who.is/whois/newsglobeworldmap.com](https://www.who.is/whois/newsglobeworldmap.com)、[who.is/whois/newsglobeworldmap.com(二次)](https://who.is/whois/newsglobeworldmap.com)。

**Wayback Machine 存档:**
- 以 timestamp=20240101 查 availability API,返回**最接近快照为 2026-05-19**(20260519150659,状态 200)——即 2024-01 之前无任何快照,**最早存档约 2026-05-19**,晚于域名创建约 2 个月。
- 来源:[archive.org/wayback/available](http://archive.org/wayback/available?url=newsglobeworldmap.com&timestamp=20240101)。
- **迭代痕迹:未能取得**——web.archive.org 对本会话抓取工具不可达,无法拉取完整快照清单做版本间 diff;且站龄仅约 2 个月存档,可比版本极少。标注:未找到(工具受限)。

**开发者 DimaRV 身份:**
- 页脚「Created by DimaRV」链向 **dimarv.ru**,身份为 **Dmitry(Dmitrii)Rogoza**,俄罗斯 **web 设计师 / UX-UI / 项目经理 / 前端**,自述从业 15+ 年、做过 100+ 网站(含俄罗斯国家级/政府网站),履历列 Komkor-Aynet、ITC Molnet、Technoserv、T1 Integration/Group、Innotech。来源:[dimarv.ru/en](https://dimarv.ru/en/)。
- 其他公开档案:Figma 社区 [@dimarv](https://www.figma.com/@dimarv)、Instagram [@dmitrii.rogoza](https://www.instagram.com/dmitrii.rogoza/)。
- **公开 GitHub:未找到** DimaRV 名下账号(检索返回的 dmrozov / dmitrydrozdov / dmitry-r 等均为同名不同人)。标注:未找到。
- **NewsGlobe 未列入其 dimarv.ru 作品集**——portfolio 页无该项目任何提及。来源:[dimarv.ru/en](https://dimarv.ru/en/)。

### 🔶 推测/判断

- 各项时间线自洽指向「**极年轻站点**」:域名 2026-03 注册 → 2026-05 首存档 → 2026-07 内容鲜活,站龄约 4 个月。
- **多项「低承诺」信号叠加**:域名只买 1 年、跑在廉价俄罗斯共享主机(Beget)、开发者本人是设计师且其正式作品集**都未收录此项目**——这些都更像「个人试验作」而非投入运营的产品。
- DimaRV 是**成熟的商业 web 设计师**(政府/国家级项目背景),因此 NewsGlobe 的视觉完成度不奇怪,但其技能栈偏设计/前端、无公开 GitHub 工程履历,亦无该项目的对外推广动作——与「顺手做的 side project」画像一致。

---

## Q3 分发与口碑

### ✅ 事实(均为「检索未找到」类结果,已写明查了什么)

- **Product Hunt:未找到**。以 `producthunt.com` 站内定向检索 + 通用检索「NewsGlobe/newsglobeworldmap DimaRV Product Hunt launch」均无该产品的 PH 上线页。来源:[producthunt.com](https://www.producthunt.com/)(检索无命中)。
- **Reddit:未找到**。检索「newsglobeworldmap.com Reddit」无任何帖子/讨论命中。
- **Hacker News:未找到**。检索无 news.ycombinator / hn.algolia 命中该域名。来源:[hn.algolia.com](https://hn.algolia.com/)(检索无命中)。
- **X/Twitter 及其他社媒:未找到**该产品的官方账号或讨论;站点本身**无任何社媒外链**。
- **媒体报道:未找到**任何科技媒体/博客报道。
- 站点自身分发面:**无 about / blog / contact 页,无社媒链接**;页脚仅一句 cookie/分析声明(「使用 Yandex 与 Google 分析服务…不收集个人数据」)。来源:[newsglobeworldmap.com](https://newsglobeworldmap.com/)。

### 🔶 推测/判断

- **该产品几乎没有任何公开分发或口碑足迹**:无 PH 上线、无社区讨论、无媒体报道、无社媒账号、站内也无引流/联系入口。这与 Q1「流量低于门槛」、Q2「站龄 4 个月」互为印证——它更像「做出来挂在网上」,而非「在做增长」的产品。
- 边界:社区/社媒检索非穷举,俄语圈(VK/Telegram/Habr 等)可能有本报告未覆盖的零散提及;但英语主流渠道(PH/Reddit/HN/X/媒体)一致为空,信号方向明确。

---

## Q4 商业化信号

### ✅ 事实

- 抓取站点首页,**未见任何定价、订阅、Pro 计划、捐赠(donation / "buy me a coffee")、广告或支付入口**。来源:[newsglobeworldmap.com](https://newsglobeworldmap.com/)(抓取 2026-07-21)。
- 唯一「后端服务」痕迹是页脚声明的 **Yandex + Google 分析**(用于测量访问,非变现)。StatShow 报告里的「广告收入 $0.30/月」是其估值公式的推算产物,**非站点实际挂广告**。来源:[statshow.com/www/newsglobeworldmap.com](https://www.statshow.com/www/newsglobeworldmap.com)。

### 🔶 推测/判断

- **零商业化信号**:无收费、无捐赠、无广告、无「Pro/Premium」占位。结合 RSS feed 上限 25(实测截图)这类「够用即止」的设定,更像自用/展示型作品,尚未进入任何变现尝试阶段。

---

## 综合判断(推测栏)

- **定性:强烈偏向「独立开发者 side project / 概念验证作」,而非「有增长的在营产品」**。支撑点(均见上文事实栏):① 域名仅 4 个月、只注册 1 年;② 流量低于 SimilarWeb/Semrush 等主流工具测量门槛(可读的 StatShow 估 ~30/月);③ 无任何商业化痕迹;④ 无 PH/Reddit/HN/X/媒体分发足迹、站内无引流入口;⑤ 开发者为俄罗斯 web 设计师,连自己作品集都未收录该项目;⑥ 跑在廉价共享主机上。
- **对 Worlens 的竞争威胁量级(一句话结论)**:**当前威胁量级低**——NewsGlobe 证明了「用户自带 RSS + 条目级地理抽取 + 3D 地球」这条读法**可被做出来**(是有价值的先例/prior art),但它**无流量、无移动端、无变现、无中文覆盖、无增长动作**,现阶段不构成市场竞争者,仅是「点子已被验证可行」的存在性证据。

---

## 对现有决议的冲击

- **与 `doc/product-decisions.md` / spec 无抵触**。本报告正是 D14 修订(2026-07-21)明列的「访问量核查另卡(doc/research/)」的回填,且**印证并量化**了 D14 修订落定栏对 NewsGlobe 的既有定性(「站点自述、未实测、独立开发者署名、能否推进不确定」)。
- 一点**边际强化**(非冲突,供产品负责人参考):D14 落定栏担心的「谁最可能先补齐」中,NewsGlobe 这一路的推进概率因本轮证据(无流量/无变现/无分发/作品集未收录)**应下调**——它作为「先例」的意义大于作为「追赶者」的威胁。真正需要盯的仍是 rss-geo 报告 Q4 判定的 World Monitor(已具条目级 geo + 开源 + 活跃迭代)。

---

## 遗留问题 / 未找到可靠信号

1. **SimilarWeb/Semrush 精确流量数字未直读**:三家数据页被反爬墙拦截(403/验证码),未能读到其原文「无数据」措辞或具体数字;结论由「无可索引档案 + StatShow 估算」综合推断。若需硬数字,建议用带 Cookie 的浏览器或付费 API 直查一次。
2. **Wayback 迭代痕迹未取得**:web.archive.org 对本会话抓取工具不可达,仅经 availability API 确认最早快照约 2026-05-19,**未能做版本间 diff** 看迭代节奏。
3. **俄语圈分发未覆盖**:开发者为俄罗斯人,VK/Telegram/Habr/vc.ru 等俄语渠道可能有本报告未检索到的提及;若要穷尽口碑,建议补查俄语社区。
4. **注册人真实身份/国别未从注册库直读**:WHOIS 注册人被隐私屏蔽,「俄罗斯」为注册商/NS/IP/电话推断;DimaRV 与该域名的绑定依据是站点页脚署名 + dimarv.ru 链接,非注册记录直证。
5. **功能实测仍属另一议题**:本卡只核运营/流量状态,未复核其功能(中文 feed 落点质量等)——该实测已由 D14 落定栏列为 M3 arch 设计前置(硬前置①),不在本报告范围。
