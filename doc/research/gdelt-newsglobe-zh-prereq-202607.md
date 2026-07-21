# GDELT 中文地理编码覆盖 + NewsGlobe 中文 feed 实测（M3 两项硬前置）（2026-07）

- 调研员：RES 实例（新实例）
- 调研日期：2026-07-21（所有 URL 抓取日期同为 2026-07-21，除另行标注）
- 输入背景：`doc/product-decisions.md` D14 修订落定（2026-07-21）明列的**两项 M3 arch 设计前硬前置**；前两轮 `doc/research/rss-geo-202607.md`（Q4 门槛 #1、遗留 #4）与 `doc/research/newsglobe-202607.md`（遗留 #5）均把这两项标注「未实测/未核，留待下一轮」。本报告即该两项的回填。不修改上述两份报告。
- 核查对象：
  1. **硬前置①** — newsglobeworldmap.com 对**中文 feed** 的功能实测（提交 → 条目地理抽取 → 落点准确度 → 是否支持中文）。
  2. **硬前置②** — GDELT（Doc 2.0 API / GEO 2.0 API / Translingual）对**中文语言来源**的收录与地理编码覆盖度；`doc/spec.md` SPEC-5.4a/5.8 T3 计划「直接采用 GDELT 地理编码结果，不自研 NER」。
- 体例：每节先「✅ 事实（附来源 URL + 抓取日期）」后「🔶 推测/判断」，两栏严格分开；无可靠信号处显式标注「未找到」或「无法实测」。
- **边界声明（重要）**：本报告为公开 Web 检索 + 公开 API 实查层面观察，非穷举、非源码核验、非产品选型结论。三处工具限制须先声明，结论权重据此打折：① **本 RES 实例可用工具仅 WebFetch（HTTP GET / 静态渲染转 markdown）+ WebSearch**，无浏览器自动化、无表单提交（POST）、无 curl/shell 能力——故对 NewsGlobe 这类需 JS 交互提交 feed 的 SPA **无法完成交互式实测**（详见硬前置①）。② **GDELT Doc 2.0 API 实查成功**（下述中文源、域名查询均为真实返回）；但 **GEO 2.0 API 经 WebFetch 一律返回 HTTP 404**（连 `query=protest` 这类保底关键词亦然，属工具/端点适配问题而非查询语义），故**逐点经纬度地理编码结果未能由本实例亲测**，地理编码「准确度」只能取文档 + 二手评估。③ GDELT API 对本会话高频请求频繁返 **HTTP 429**，多次查询受限；已核结果为真、未核项如实标注。本报告不做决策，只给证据与权重。

---

## 硬前置① NewsGlobe（newsglobeworldmap.com）对中文 feed 的实测

### ✅ 事实

- **测试用中文 feed 已确认可访问且为合法中文 RSS**：`https://landiannews.com/feed` **301 永久重定向**至 `https://www.landian.news/feed`（蓝点网已启用新主域 landian.news）；目标为合法 **RSS 2.0**，`<title>` = 蓝点网、声明语言 **zh-Hans（简体中文）**，条目标题全为中文（例：「关键时刻还是靠开源模型：HuggingFace遭黑客攻击 某模型拒绝审计 最后靠GLM-5.2」「A社调整Claude Team订阅成员限制」）。来源：[landiannews.com/feed → www.landian.news/feed](https://www.landian.news/feed)（抓取 2026-07-21）。**旁注**：所抓 5 条头条**多为科技公司/产品话题（HuggingFace / OVH / Nextcloud / 微软 / Claude），条目标题内显式国家/城市地名很少**——即蓝点网的「地理落点」多不来自条目自带地名，而须靠「机构/事件→地点」的实体解析（对应 spec T4，非 T2 结构化地名）。
- **交互式提交实测：无法完成，原因＝工具能力所限（非「网站不支持」）**。newsglobeworldmap.com 为客户端 JS 单页应用，「加自有 feed」入口与 3D 落点渲染均在浏览器交互态生成；WebFetch 只取到静态 HTML 渲染出的**营销文案**（"Add your own RSS feeds and create a custom world news dashboard" / "Custom RSS feed integration"），**静态层面未见任何输入框 / "Add Feed" 按钮 / 提交表单**。本实例无浏览器自动化能力，无法真的提交一条中文 feed 并观察其抽取落点。来源：[newsglobeworldmap.com](https://newsglobeworldmap.com/)（抓取 2026-07-21，静态抓取）。**标注：中文 feed 落点效果＝无法实测（工具受限），与前两轮同样未达成。**
- **间接信号（均非实测，仅供权重参考）**：
  - 该站抽取方式为**命名实体识别式**（站点自述「extracts geographic entities such as cities and countries」）；其**内置 curated 源清单在 `rss-geo-202607.md` Q3 已核为清一色英/欧/俄语**（The Moscow Times / RT / РИА / Le Monde 等），**无任何中文源**；feed 上限 25、标记按信源着色（用户实测，见 `newsglobe-202607.md`）。
  - **同名不同物的开源近似项目可作旁证（非本站）**：GitHub `MuslimConditions/NewsGlobe`（作者 Miha Smrekar）是**独立**的「RSS→NER→3D 地球」项目，技术栈 Python + **spaCy 英文模型** + CesiumJS、15 分钟刷新，README 明确只装「spacy English models」、**无中文 NER**、TODO 里位置搜索仍待完善。来源：[github.com/MuslimConditions/NewsGlobe](https://github.com/MuslimConditions/NewsGlobe)（抓取 2026-07-21）。**须强调：此项目 ≠ newsglobeworldmap.com**（`newsglobe-202607.md` 已列同名不同物清单），其技术细节**不可回填到 DimaRV 的站点**；仅说明「此类 hobbyist 地理新闻地球仪普遍以英文 NER 起步」的行业惯例。
  - 一次 WebSearch 摘要曾称 newsglobeworldmap.com「covers … China …」，但该摘要明显**把多个同名项目与营销文案混写**（可靠度低），**不作事实采信**。

### 🔶 推测/判断

- **硬前置① 仍未被真正实测**——本实例受工具限制，未能像用户此前手测英文 feed 那样，向 newsglobeworldmap.com 提交一条中文 feed 观察落点。目前**没有任何正面证据表明该站支持中文**：内置源全英/欧语、抽取为 NER 式、近似开源项目默认英文模型——方向性信号**偏向「中文支持弱或无」，但这是推断，不是实测结论**。
- 若产品负责人确需把 newsglobeworldmap.com 的中文表现作为对标基准，**唯一可靠路径是人工手测**：用能交互的浏览器提交 `https://www.landian.news/feed`，看其是否接受提交、条目是否上球、蓝点网「欧盟/美国新闻」是否落到欧洲/美国。本实例做不到，只能明确交回。

---

## 硬前置② GDELT 对中文语言来源的收录与地理编码覆盖度

### Q2.1 GDELT 是否收录中文语言来源（实查）

#### ✅ 事实

- **GDELT Doc 2.0 API 实查证实：中文源被实时收录，且带 sourcecountry**。查询 `query=sourcelang:chinese&mode=ArtList&timespan=1d`（抓取 2026-07-21）返回 **18 条**近 24 小时中文文章，标题均为中文，`language=Chinese`、`sourcecountry` 填充为 China / Hong Kong / Taiwan。覆盖域名含 **baijiahao.baidu.com、news.sina.com.cn、auto.sina.com.cn、portal.sina.com.hk、yangtse.com、itbear.com.cn、zol.com.cn（含 jd./soft./ai./auto. 子域）、cfi.net.cn、setn.com、tvbs.com.tw、udn.com** 等。来源：[api.gdeltproject.org/api/v2/doc/doc?query=sourcelang:chinese](https://api.gdeltproject.org/api/v2/doc/doc?query=sourcelang:chinese&mode=ArtList&maxrecords=20&timespan=1d&format=json&sort=DateDesc)（实查 2026-07-21）。
- **GDELT 确实收录中文科技媒体（实查验证域名过滤语法有效）**：`query=domain:itbear.com.cn&timespan=1w` 返回 **10 条** IT Bear（中文科技新闻）文章，标题如「AI眼镜赛道：Rokid激进突围」「中国火箭海上回收新突破」。来源：[api.gdeltproject.org/…domain:itbear.com.cn](https://api.gdeltproject.org/api/v2/doc/doc?query=domain:itbear.com.cn&mode=ArtList&maxrecords=10&timespan=1w&format=json)（实查 2026-07-21）。此查询同时**验证了 `domain:` 过滤语法有效**，故下方蓝点网空结果可信。
- **文档层面：GDELT 明确覆盖中文**。GDELT Translingual 1.0（2015-02 起）实时机翻 **65 种语言**，明列 Chinese (Simplified) 与 Chinese (Traditional)，覆盖其非英文日监测量的 98.4%；Translingual 2.0 扩至 **109 种语言/方言**。GDELT 全库自述监测「全球逾 100 种语言、数十万来源」。来源：[GDELT Translingual: Translating the Planet](https://blog.gdeltproject.org/gdelt-translingual-translating-the-planet/)、[Translingual 2.0（109 langs）](https://blog.gdeltproject.org/gdelt-translingual-2-0-now-live-translates-everything-gdelt-monitors-in-109-languages-dialects/)、[GDELT 2.0 Realtime](https://blog.gdeltproject.org/gdelt-2-0-our-global-world-in-realtime/)（抓取 2026-07-21）。

#### 🔶 推测/判断

- **「GDELT 收录中文源」这一层已实证成立**：不仅主流中文源（新华系/新浪/百家号/央视等）在库，**中文科技媒体亦部分在库**（itbear.com.cn、zol.com.cn 实证），并带国别标注。这**推翻了 `rss-geo-202607.md` Q4 门槛 #1 里「GDELT 系以英文/欧语为主、中文覆盖度是关键未知」中偏悲观的那一半**——中文**收录**不是问题。

### Q2.2 GDELT 对中文的地理编码机制（文档）

#### ✅ 事实

- **GDELT 的地理编码是多语言的、含专门的中文处理**：Translingual 对中文用 **Stanford Chinese Word Segmenter（北京大学分词标准）**做分词（中文无天然词边界），再做翻译与地理抽取；地名库整合 **美国 NGA GEOnet Names Server（GNS）+ Wikipedia 跨语言互链**，官方自称「当今最大的多语言地理编码工程之一」，对各语言做「本地语言地名变体的高覆盖回收」。来源：[GDELT Translingual: Translating the Planet](https://blog.gdeltproject.org/gdelt-translingual-translating-the-planet/)（抓取 2026-07-21）。
- **GEO 2.0 / Doc 2.0 API 在文档层支持按语言过滤并输出地理点**：GEO 2.0 API 支持 `SourceLang`（全部 65 种机翻语言）与 `Domain` 过滤，`mode=PointData&format=GeoJSON` 输出**逐点经纬度**，官方明示可「地图化非英文语种媒体的地理模式」（举例 `sourcelang:spanish`）。地点赋值机制：用 GKG 邻近度把每个主题/人物/机构 mention 归到「文内最近的地点」，多地名时做窗口化与衰减仲裁。来源：[GDELT GEO 2.0 API Debuts](https://blog.gdeltproject.org/gdelt-geo-2-0-api-debuts/)、[GDELT DOC 2.0 API Debuts](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/)（抓取 2026-07-21）。

#### 🔶 推测/判断

- 文档口径下，**GDELT 对中文的「文本→坐标」是有专门管线的**（分词 + GNS + 跨语言地名回收），机制上比「英文 spaCy 直接跑中文」强得多。但**文档只证明「机制存在」，不证明「对蓝点网这类中文科技长尾源的落点质量达标」**——后者须实测（本实例受限，见边界②与 Q2.4）。

### Q2.3 蓝点网（flagship 用例源）是否在 GDELT（实查）

#### ✅ 事实

- **蓝点网不在 GDELT 索引内**：`query=domain:landian.news&timespan=1m` 与 `query=domain:landiannews.com&timespan=1m` **均返回空 `{}`（0 条）**。在 `domain:` 语法已由 itbear.com.cn 验证有效的前提下，此为「蓝点网未被 GDELT 监测收录」的可信信号。来源：[api…domain:landian.news](https://api.gdeltproject.org/api/v2/doc/doc?query=domain:landian.news&mode=ArtList&maxrecords=25&timespan=1m&format=json)、[api…domain:landiannews.com](https://api.gdeltproject.org/api/v2/doc/doc?query=domain:landiannews.com&mode=ArtList&maxrecords=25&timespan=1m&format=json)（实查 2026-07-21）。
- **GDELT 公开的来源清单本身对中文不透明**：GDELT 公开的「来源→国别」交叉数据集仅含 **13,155 个英文站点**，**未发布中文源清单**；哪些中文源在库只能靠 API 逐个探。来源：[Announcing New Source-Country Crossreferencing Dataset](https://blog.gdeltproject.org/announcing-new-source-country-crossreferencing-dataset/)、[Mapping The Media](https://blog.gdeltproject.org/mapping-the-media-a-geographic-lookup-of-gdelts-sources/)（抓取 2026-07-21）。

#### 🔶 推测/判断

- **GDELT 对中文源的收录是「有但不均匀」**：同为中文科技媒体，itbear.com.cn / zol.com.cn 在库，**蓝点网不在**。对「蓝点网旗舰用例」而言，这是关键限制——见下节架构含义。

### Q2.4 地理编码准确度与可信度（文档 + 二手）

#### ✅ 事实

- **GDELT 官方承认地理编码 100% 由算法赋值、必有误差**。来源：[GDELT DOC 2.0 API Debuts](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/)（抓取 2026-07-21）。
- **二手/检索摘要级批评（未逐一直读原文，标注二手）**：多篇分析指 GDELT 地理编码存在①**位置偏向国际通讯社关注点**、②**数据稀薄地区落到默认质心（centroid）兜底**、在信息贫乏环境「其 NLP 报告的位置不确定性近乎抛硬币」（尼日利亚 Kaduna 质心例）、③历史上对**非英语国家事件的抽样偏差/低报**、④在冗余与域精度维度「表现不佳」。来源（二手，检索摘要）：[Source/OpenNews: GDELT and the Problem of Decontextualized Data](https://source.opennews.org/articles/gdelt-decontextualized-data/)、[Evaluating GDELT vs POLECAT（Data, 2026）](https://doi.org/10.3390/data11070158)、[GDELT 自评 LLM 地理编码的地理偏差](https://blog.gdeltproject.org/generative-ai-experiments-the-surprisingly-poor-performance-of-llm-based-geocoders-geographic-bias-why-gpt-3-5-gemini-pro-outperform-gpt-4-0-in-underrepresented-geographies/)（抓取 2026-07-21）。

#### 🔶 推测/判断

- **本实例未能亲测中文文章的逐条落点质量**（GEO 2.0 API 经 WebFetch 一律 404，见边界②；Doc 2.0 ArtList JSON 不含 locations 字段）。因此「GDELT 对中文源落点是否准」这一最关键问题，本报告只到**「机制存在、官方与二手均提示算法误差与地区偏差」**，**未达「实测合格/不合格」**。这是硬前置②里**最实在的残余缺口**，须在 arch 设计前由人工用可交互工具补测（GEO API GeoJSON 或 GKG）。

---

## 架构含义：T3「直采 GDELT」到底能服务哪个用例（对现有决议的冲击）

> 本节为**报告级提示**，只列证据与冲突，供 arch/orch 依 §7 裁定；本实例不改 spec、不改 product-decisions。

### ✅ 事实（spec 现行文本）

- SPEC-5.4a（GDELT 突发新闻**作为信源**）：「①优先采用 GDELT 自带地理编码结果（T3，不自研 NER）；②仍无坐标时用本地 GeoNames gazetteer（T2）……③再无定位则丢弃」。
- SPEC-5.8 T3：「自由文本地理解析不自研，直接采用 GDELT 地理编码结果——M3」。
- SPEC-5.9（用户**自定义 RSS**，蓝点网属此）：「自定义 feed 事件缺坐标时走**人肉钉图（SPEC-5.8 T4 替代）**」。
- 实查事实：GDELT 不提供「任意文本→坐标」的通用地理编码 API；其地理编码只作用于 **GDELT 自己爬取的语料**。且蓝点网不在 GDELT 语料内（Q2.3）。

### 🔶 推测/判断（须 arch 裁定）

- **T3 的能力边界须澄清——它天然只服务「GDELT 作为信源」的事件，不服务「用户自带任意 feed」的地理化**：因为「直采 GDELT 地理编码结果」＝复用 GDELT 已爬语料的落点；对一条用户自订的蓝点网 feed 条目，只有当该条目也在 GDELT 语料里（可按 URL 匹配）才有「GDELT 落点」可复用。**蓝点网既不在 GDELT，其自订 feed 条目就拿不到任何 GDELT 落点**——D14 修订②设的条件判断在此落地为：**对「蓝点网单 feed 按地理分散」这一中文旗舰用例，T3『直采 GDELT』不成立**。
- **但这不等于「GDELT 中文覆盖不足」**——GDELT 作为**独立突发新闻信源**（SPEC-5.4）时，其中文事件（新华/新浪/itbear 等在库源）可携带 sourcecountry 与（文档级）落点，**GDELT-as-source 的中文路径是通的**。两个角色不可混谈。
- **与 spec 正文的关系**：SPEC-5.9 已把自定义 feed 缺坐标路由到 **T4 人肉钉图**，**并未**声称自定义 feed 用 T3——故本发现**与 spec 正文不直接冲突**，冲突点在 **D14 修订②的框设**（其把 T3/GDELT 当作可能服务中文旗舰用例的候选）。落到工程即：蓝点网「欧盟/美国新闻各归其位」的**自动**分散，按现行 spec 只能靠 **T2（对条目文本查本地 gazetteer）或 T4（人肉钉图）**，而 T2 又受限于「蓝点网条目多为机构/产品话题、显式地名稀少」（硬前置①事实栏）——即真正吃劲的是 **T4 类实体→地点解析（spec 明列为付费后置能力）**。此张力建议 arch 在 M3 设计前显式裁定，勿默认 T3 能兜住中文自订 feed。

---

## 一句话结论

- **硬前置②（GDELT 中文）已足以支撑 arch 裁定，且结论是「分角色」的**：GDELT **确实收录中文源**（含部分中文科技媒体，实证）、**对中文有专门地理编码管线**（分词 + GNS + 跨语言地名，文档级）——故 **GDELT 作为独立中文突发新闻信源（SPEC-5.4）可用**；但 **GDELT 不含蓝点网、且不提供任意文本地理编码**，故 **T3「直采 GDELT」无法服务「蓝点网自订 feed 按地理分散」这一中文旗舰用例**，该用例须落到 T2/T4（现行 spec 亦如此路由，D14② 的假设需据此收敛）。唯一未闭合的是**中文文章逐条落点的准确度**——本实例受工具限制未能亲测（GEO API 404），须人工补一次 GeoJSON 实测。
- **硬前置①（NewsGlobe 中文实测）仍未闭合**：因本实例无浏览器自动化/表单提交能力，**无法交互式实测**该站对中文 feed 的落点；只取得「无正面中文支持证据 + 内置源全英欧语 + 近似开源项目默认英文 NER」等旁证，方向偏「中文支持弱」但非实测结论。若需作对标基准，须人工手测。

---

## 对现有决议的冲击（逐条）

1. **对 D14 修订②的框设**：其设「GDELT 中文覆盖不足 → T3 对中文旗舰用例不成立」的二分判断，需按本报告收敛为**三分**——(a) GDELT 中文**收录**足（可用）；(b) GDELT 中文**地理编码准确度**未测（缺口）；(c) 但**无论准确度如何，T3 都服务不了蓝点网自订 feed**（因蓝点网∉GDELT 且 GDELT 非通用地理编码器）。故「T3 直采 GDELT 对中文旗舰用例不成立」**成立，但成立的根因不是「中文覆盖不足」，而是「架构角色错配」**。建议 orch 据此更新 D14② 的措辞与 M3 arch 输入。
2. **与 `doc/spec.md` 正文无直接抵触**：SPEC-5.9 已将自定义 feed 缺坐标路由到 T4 人肉钉图，未主张自订 feed 用 T3；本报告只是把「为何不能用 T3」讲透，供 arch 设计时不误用。若 arch 拟让蓝点网走自动地理化，须走 §7 明确 T2/T4 的具体机制与（T4 付费后置）里程碑归属。
3. **对 `rss-geo-202607.md` Q4 门槛 #1 的更新（非冲突，是补强）**：该门槛「中文地理解析空档」判断方向正确，但其把 GDELT 一并归入「英文/欧语为主、中文覆盖是关键未知」略悲观——本报告实证 GDELT 中文**收录**并不弱，真正的空档在**「用户自订中文长尾源（如蓝点网）的自动落点」**，这仍要 Worlens 自建 T2/T4，护城河判断不变。

---

## 遗留问题 / 未找到可靠信号

1. **GDELT 中文文章逐条落点准确度＝未实测（最大缺口）**：GEO 2.0 API 经本实例 WebFetch 一律 404（工具适配问题），Doc ArtList JSON 不含 locations 字段。建议人工用可交互工具跑 `api/v2/geo/geo?query=<中文关键词> sourcelang:chinese&mode=PointData&format=GeoJSON`（或 GKG GeoJSON），核查中文覆盖是否会把「关税/欧盟」类话题正确落到美国/欧洲、有无质心兜底误判。
2. **NewsGlobe 中文 feed 交互式实测＝未完成**：须人工用浏览器向 newsglobeworldmap.com 提交 `https://www.landian.news/feed`，观察是否接受、是否上球、蓝点网欧盟/美国新闻是否落对；本实例工具无法提交。
3. **GDELT 中文源清单不透明**：官方只发布 13,155 个英文源的国别清单，中文源在库与否只能逐个 API 探；「主流中文源覆盖率」无法给出整体数字，本报告只证「若干主流+部分科技源在库、蓝点网不在」。
4. **地理编码准确度批评为二手**：Q2.4 的偏差/质心兜底/低报等结论来自检索摘要（OpenNews、POLECAT 对比研究等），未逐篇直读原文；若作决策依据建议 arch 直读原文核证。
5. **蓝点网条目地名稀疏对 T2 的影响未量化**：所抓头条显式地名很少（多为机构/产品话题），本地 gazetteer（T2）能覆盖多少比例、多少需落 T4，未做样本统计；建议 M3 设计前对蓝点网抓 1–2 周样本做地名密度统计。
</content>
</invoke>
