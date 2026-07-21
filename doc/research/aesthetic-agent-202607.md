# 业界「审美/设计评审 AI agent」先例调研(2026-07)

- 调研员:RES 实例
- 调研日期:2026-07-21(所有 URL 抓取日期同为 2026-07-21,除另行标注)
- 输入背景:`doc/product-decisions.md` 第七节 D24/D25(新增「审美验收官」角色的决议)。本报告即 D25「建卡前先调研业界审美/设计评审 agent 先例」的回填。
- 调研对象边界:本项目审美对象是 **TypeScript + three.js 的 3D 深色矢量新闻地球仪**(非 SaaS 落地页/仪表盘)。业界公开先例**几乎全部面向 2D Web UI / 落地页 / 仪表盘**,没有一例是针对 3D 场景审美评审的。因此下文先例可借鉴的是**方法论与 prompt 手法**,不是可直接套用的判据文本——这一错配是本报告最重要的边界,贯穿所有结论。
- 体例:每节先「✅ 事实(附来源 URL + 抓取日期)」后「🔶 推测/判断」,两栏严格分开;无可靠信号处显式标注「未找到」。
- **方法边界声明(重要)**:本报告先例正文由 WebFetch(小模型抓取渲染)从各页面提取,引号内文本为**抓取工具转述/摘录**,已尽量保留原文措辞但**未逐字节比对原始 Markdown**;关键 prompt 手法均给出可复核的原始 URL。凡标「二手」者为经他人转述的信息。本报告不做决策,只给证据与权重;是否建卡、判据如何定,由 orch/用户拍板。

---

## Q1 先例盘点

### ✅ 事实:七个可查先例

| # | 先例 | 类型 | 与「审美验收官」的关系 | 来源 |
| --- | --- | --- | --- | --- |
| P1 | **Anthropic 官方 skill `frontend-design`** | 生成侧 skill(SKILL.md) | 最权威的「反 AI 味 + 品味原则 + 两遍自我批评」范式 | [github.com/anthropics/skills](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md) |
| P2 | **Anthropic Claude Cookbook「Prompting for frontend aesthetics」** | 官方 prompt 指南 | 逐维度(字体/配色/动效/背景)steering + 具名反模式 | [platform.claude.com/cookbook](https://platform.claude.com/cookbook/coding-prompting-for-frontend-aesthetics) |
| P3 | **OneRedOak/claude-code-workflows `design-review`** | 评审侧 subagent + slash command + 原则文档 | **最接近本项目需求**的先例:截图取证 + 分级门禁 + 参照系 | [github.com/OneRedOak/claude-code-workflows](https://github.com/OneRedOak/claude-code-workflows/tree/main/design-review) |
| P4 | **VoltAgent/awesome-claude-code-subagents `ui-designer`** | 生成侧 subagent 卡 | 结构范本(persona + QA 矩阵),但无显式视觉判据 | [github.com/VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/01-core-development/ui-designer.md) |
| P5 | **VoltAgent/awesome-design-md、marvkr/better-design** | 参照系资产(DESIGN.md / MCP) | 「对标 Linear/Stripe/Vercel」参照系的可打包形态 | [github.com/VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md)、[github.com/marvkr/better-design](https://github.com/marvkr/better-design) |
| P6 | **superdesign(superdesign.dev)** | 生成侧 design agent(IDE 内) | 只生成不评审,方法参考价值低 | [github.com/superdesigndev/superdesign](https://github.com/superdesigndev/superdesign) |
| P7 | **v0(Vercel)prompting 指南** | 商用生成工具的官方 prompt 建议 | 「给足 design token + 对标某风格」的参照系用法 | [vercel.com/blog/how-to-prompt-v0](https://vercel.com/blog/how-to-prompt-v0) |

以下逐条给出各先例的**关键手法摘录**(如何让模型输出高审美判断)。

#### P1 — Anthropic `frontend-design` SKILL.md(最权威范式)

关键手法(摘自 SKILL.md,抓取 2026-07-21):
- **人设锚定**:「Approach this as the design lead at a small studio known for giving every client a visual identity that could not be mistaken for anyone else's」——要求「deliberate, opinionated choices ... and take one real aesthetic risk you can justify」。
- **具名三类「AI 默认套路」并要求规避**:①「Warm Cream Default」(近 #F4F1EA 暖米底 + 高对比衬线 + 赤陶点缀);②「Dark Acid Default」(近黑底 + 单一亮酸绿/朱红点缀);③「Broadsheet Default」(细线分隔 + 零圆角 + 报纸式密排)。原文点破本质:「they are defaults rather than choices, and they appear regardless of subject」。
- **两遍流程(Two-Pass)**:Pass 1 先出「compact token system」——4–6 个命名 hex 的配色、2+ 角色的字体、ASCII 线框布局、一个「signature」签名元素;Pass 2「Critique Against Brief & Revise」——「if any part of it reads like the generic default you would produce for any similar page ... revise that part, say what you changed and why」;**确认独特性后才允许写代码**。
- **自我批评仪式**:「Critique your own work as you build, taking screenshots if your environment supports it – a picture is worth 1000 tokens」;并引 Chanel 名言「before leaving the house ... remove one accessory」(把「减一件」作为克制启发式)。
- **非协商质量底线**:响应式到移动端、可见键盘焦点、尊重 reduced-motion。
- **动效克制警告**:「extra animation contributes to the feeling that the design is AI-generated」。

#### P2 — Claude Cookbook「Prompting for frontend aesthetics」

关键手法(抓取 2026-07-21):
- **三支柱**:①逐维度引导(typography / color / motion / backgrounds 分别下指令);②引用设计灵感来源(IDE 主题、文化审美)但不过度规定;③**具名点破默认**。
- **具名反模式(anti-slop)**:「You tend to converge toward generic, 'on distribution' outputs ... the 'AI slop' aesthetic」;点名要避开「Overused font families (Inter, Roboto, Arial, system fonts)」「Clichéd color schemes (particularly purple gradients on white backgrounds)」;甚至提示模型连「安全的独特字体」也会趋同:「You still tend to converge on common choices (Space Grotesk, for example) ... it is critical that you think outside the box!」。
- **字重/字号极端化**:「Use extremes: 100/200 weight vs 800/900, not 400 vs 600. Size jumps of 3x+, not 1.5x.」
- **配色主次分明**:「Dominant colors with sharp accents outperform timid, evenly-distributed palettes.」
- **隔离维度 prompt**:给出 `TYPOGRAPHY_PROMPT`、`SOLARPUNK_THEME_PROMPT` 等单维度 prompt 片段,主张「锁定单一维度」以获得可控输出。

#### P3 — OneRedOak `design-review`(与本项目需求最贴近)

关键手法(抓取 2026-07-21;该 repo 自述约 3.7k star,采集自一家 AI-native 创业公司的实战 Claude Code 工作流):
- **形态 = subagent 卡 + slash command + CLAUDE.md 片段 + 原则文档**,四件套。`design-review-agent.md` frontmatter 声明 name/description/tools,tools 含 `mcp__playwright__browser_*`(浏览器自动化)。
- **七阶段评审法**:Phase 0 准备(1440×900 起 Playwright)→ Phase 1 交互流 → Phase 2 响应式(1440/768/375)→ Phase 3 视觉打磨(对齐/字体/配色一致性/层次)→ Phase 4 无障碍(WCAG 2.1 AA)→ Phase 5 健壮性(边界/表单/加载错误态)→ Phase 6 代码健康(组件复用/design token)。
- **截图即证据**:全程 `browser_take_screenshot` 抓图作为「visual evidence」附在每条发现旁。
- **分级门禁 rubric**:`[Blocker]`(必须立刻修)/`[High-Priority]`(合并前修)/`[Medium-Priority]`(后续跟进)/`[Nitpick]`(以「Nit:」前缀标注的细枝末节)。
- **沟通原则**:「Problems Over Prescriptions」——**只描述问题的影响,不直接开药方**(例:「The spacing feels inconsistent ... creating visual clutter」而非给具体像素值);且每条发现配截图,报告开头「start with positive acknowledgment of what works well」。
- **配套原则文档**:`design-principles-example.md` 是一份「S-Tier SaaS Dashboard Design Checklist」,7 大类清单(核心设计哲学、design system 基座、布局层次、交互动效、模块战术、CSS 架构、通用最佳实践),**明确对标 Stripe / Airbnb / Linear**;含具体判据如「8px 基准单位的倍数做间距」「正文行高 1.5–1.7」「所有配色满足 WCAG AA 对比度」「5–7 档中性灰」。

#### P4 — VoltAgent `ui-designer` 卡

关键手法(抓取 2026-07-21):
- frontmatter:`name/description/tools: Read,Write,Edit,Bash,Glob,Grep / model: sonnet`。
- persona:「a senior UI designer with expertise in visual design, interaction design, and design systems」,目标「delight users while maintaining consistency, accessibility, and brand alignment」。
- 含「Design Review Process」「Quality Assurance Matrix」(设计评审→一致性检查→无障碍审计→性能验证→浏览器/设备测试→迭代)等流程清单。
- **重要局限**:抓取显示该卡**没有显式的字体/配色/视觉层次判据**——「No explicit typography, color palette, or visual hierarchy specifications are detailed」。即它是「流程壳」而非「品味源」。

#### P5 — 参照系资产:awesome-design-md / better-design

关键手法(抓取 2026-07-21):
- `awesome-design-md`:一组按品牌拆的 `DESIGN.md`(Vercel/Linear/Stripe/Notion/Supabase/Figma/Apple/Airbnb/Shopify/Cursor/Raycast 等 70+),「Drop one into your project and let coding agents generate a matching UI」——把「对标某品牌」固化成可注入上下文的纯文本设计系统。
- `better-design`:开源「设计 MCP server + shadcn/ui registry」,提供 design token、UI 原则、WCAG 规则、「visual-design review rules」,31 套品牌级主题。**注意**:其对各品牌的一句话画像本身带刻板印象(如把 Stripe 概括为「signature purple gradients」),直接照搬会与本项目「去 AI 味」目标冲突(见 Q3)。

#### P6 — superdesign / P7 — v0

- superdesign:开源「AI product design agent」,IDE 内(VS Code/Cursor/Windsurf/Claude Code)自然语言生成 mockup/组件/wireframe,现已有 web 版 superdesign.dev(抓取 2026-07-21)。**纯生成、无审美门禁**,方法参考价值低。
- v0(Vercel)官方 prompting 建议:**上来就给足 design token**(colors/radius/font weights/spacing)+ **对标某风格**——例:「Use a Stripe-like aesthetic — clean whites, subtle gray borders, blue-600 primary buttons, 8px border radius, generous whitespace」(抓取 2026-07-21)。是「参照系对标」pattern 的商用范例。

### 🔶 推测/判断

- **P3(OneRedOak)是本项目最可借鉴的骨架**:它把「视觉评审」做成了「截图取证 + 分级 rubric + 只提问题不开药方 + 参照系原则文档」的门禁,而本项目已有 Playwright e2e + 截图证据链(CLAUDE.md「视觉场景附截图」、`doc/attachment/ux-review-20260721/`),两者机制天然吻合。审美验收官的验收 skill 可复用现有截图证据管道。
- **P1(frontend-design)是「品味生成」侧最好的心法来源**,但它是「生成时自我约束」的 skill,不是「第三方验收」的 agent;D25 要求的是**制定方案 + 验收门禁双职**,因此更合理的组合是「P1 的品味原则/两遍批评」喂给方案制定职,「P3 的分级门禁/截图取证」喂给验收职。
- **P4/P5 提示一个坑**:很多现成卡是「流程壳」或「带刻板印象的品牌画像」,直接抄会把「AI 味」判据抄进来。本项目需要的是**针对深色矢量 3D 地球的具体判据**,而这在所有先例里都缺席——需自研(见 Q4、遗留问题)。

---

## Q2 prompt 模式比较

四种模式在先例中的分布、适用场景与已知效果证据如下。

### ✅ 事实:四模式与其证据

**① 评审清单式(checklist)**
- 代表:P3 的 S-Tier Dashboard Checklist(7 大类、含 8px 网格/行高/WCAG 等可勾选判据);SmoothUI 文提出的「10-item acceptance checklist」,把「would a designer retouch this?(设计师会返修吗)」操作化(来源 [smoothui.dev/blog/ai-design-slop](https://smoothui.dev/blog/ai-design-slop),抓取 2026-07-21)。
- 适用:可量化项(间距/对比度/字号阶梯/焦点可见)、需要可复核门禁的场景。
- 已知效果证据:SmoothUI 明确主张清单要「operationalize『would a designer retouch this?』rather than listing isolated visual rules」——即清单的价值在于把主观品味转成可检查项。

**② 品味原则式(taste principles)**
- 代表:P1 frontend-design——「opinionated choices」「one real aesthetic risk」「signature element」「减一件」。
- 适用:开放式创意、需要「独特性/高级感」而非「合规」的场景。
- 已知效果证据:业界拆解文认为其奏效核心在于**具名反模式**——「Naming the anti-pattern is the trick—LLMs are trained on the median of the internet, so when you say 'avoid AI slop' you are explicitly telling the model that the thing it is most likely to produce is the thing you do not want」(二手,来源:frontend-design skill 拆解讨论,抓取 2026-07-21;原始 skill P1 本身即采用此法)。

**③ 参照系对标式(reference benchmark)**
- 代表:P3(对标 Stripe/Airbnb/Linear)、P5(70+ 品牌 DESIGN.md)、P7 v0(「Stripe-like aesthetic ...」)。
- 适用:有明确风格坐标、团队对某标杆有共识时;能快速把抽象「高级感」锚到具体参照。
- 已知效果证据:v0 官方建议「reference existing design systems」并给出具体 token,称能「produces consistent output that matches your design system instead of random defaults」(抓取 2026-07-21)。**反面证据**:P2/Q3 指出「purple gradients」正是把 Stripe 这类标杆刻板化后的产物——参照系用词不当反而制造 AI 味。

**④ 多轮自我批评式(multi-turn self-critique)**
- 代表:P1 两遍流程(brainstorm→critique→revise);SmoothUI「closed loop」四段(带护栏生成→对标批评→修最高影响项→复评重复)。
- 适用:一次成型不可靠、需要收敛到「无返修」质量的场景。
- 已知效果证据:SmoothUI 直陈「A one-shot generator or a one-shot auditor can't converge. A loop can.」(抓取 2026-07-21);P1 用「take screenshots ... a picture is worth 1000 tokens」把视觉反馈纳入迭代。

### 🔶 推测/判断

- **四模式非互斥,先例最佳实践是叠加**:P1 = 品味原则 + 多轮自我批评;P3 = 清单 + 参照系 + 截图迭代。单用清单易沦为「合规但无神」;单用品味原则难做门禁(不可复核)。对 D25「制定 + 验收双职」,建议**方案制定职偏品味原则 + 参照系,验收职偏清单 + 截图取证**,两职都嵌自我批评回合。
- **参照系对本项目要慎选**:Stripe/Linear 是 2D SaaS 标杆,与「3D 深色矢量地球」错配;更贴的参照可能是**深色地图/数据可视化标杆**(如 Apple Maps 深色、Mapbox/Observable 深色主题、NASA 可视化)——但这属于「地图 LOD/风格」调研范畴(D24 已另立 `doc/research/map-lod-202607.md`),本报告不越界断言,仅标记为待接续。

---

## Q3 反模式:AI 生成设计的「AI 味」通病及 prompt 层规避

### ✅ 事实:业界公认的「AI 味」通病清单

多篇讨论高度一致地点名以下 tells(抓取 2026-07-21):
- **字体**:Inter / Roboto / Arial / 系统默认字体——「never anything with personality」(prg.sh);连「看似独特」的 Space Grotesk 也已趋同(P2)。
- **配色/渐变**:紫/靛渐变叠白底、紫到青(purple-to-cyan)渐变——被普遍称为「the most recognizable tells of AI-generated UIs」;成因:「the median of every Tailwind CSS tutorial scraped from GitHub between 2019 and 2024 ... that median is purple」(来源 [prg.sh](https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website),抓取 2026-07-21)。
- **玻璃拟态(glassmorphism)**:模糊玻璃卡 + 霓虹辉光,「used as decoration rather than to solve a real layering problem」;SmoothUI 点名「Glassmorphism with a neon glow」。
- **圆角堆砌**:「Rounded corners on everything」;「Over-rounding cards, sections, and inputs (24px and up on a small card) rounds everything into the same soft blob」。
- **阴影堆砌**:「Subtle shadows (exactly 0.1 opacity)」千篇一律。
- **布局套路**:「Hero section with centered text and a CTA button」+「Three features in boxes below, each with an icon」/「Six identical cards in a row」。
- **动效滥用**:「A bounce on every hover」;P1 亦警告多余动画会加重「AI-generated」观感。
- **配色无层次**:P2 反面——「timid, evenly-distributed palettes」(怯懦、均匀分布的调色板),对立面是「Dominant colors with sharp accents」。
- **根因(多源一致)**:LLM 是「statistical pattern matchers / reach for the most statistically common pattern」,无约束时取训练语料中位数(prg.sh、SmoothUI、vibecodekit 等,抓取 2026-07-21)。

### ✅ 事实:先例在 prompt 层如何规避

- **具名点破(naming the anti-pattern)**:P1/P2 直接把「AI slop」及具体套路写进 prompt,告诉模型「你最可能产出的就是我们不要的」。
- **黑名单显式约束**:「Do not use Inter, Roboto, or Arial fonts」「No purple gradients on white backgrounds」「Avoid the three-boxes-with-icons cliché」(prg.sh 建议)。
- **正向对立指令**:字重/字号极端化、主色 + 锐利点缀、背景做氛围与层次而非纯色(P2)。
- **角色/身份漂移**:把模型设为「a senior frontend engineer with 20+ years experience and background in print design」以移动其概率分布(prg.sh)。
- **参照驱动**:从 Dribbble 等取参照再描述其审美质感(prg.sh);但注意参照标杆的「一句话画像」本身可能是 AI 味来源(如 better-design 把 Stripe 概括成「purple gradients」)。
- **克制启发式**:P1「减一件配饰」、把「signature 只留一个,其余安静克制」。

### 🔶 推测/判断

- **对本项目(深色矢量 3D 地球)最危险的两条**:①P1 点名的「Dark Acid Default」(近黑底 + 单一亮酸绿/朱红点缀)——本项目正是深色底 + 事件分类色点,极易滑入此套路,配色须做**主次层次**而非「黑底上一把高饱和点」;②UI 面板(事件流/详情)易套**玻璃拟态 + 圆角 + 0.1 阴影**三件套。这两条应作为审美验收官的**首要否决项候选**。但注意:上述判据来自 2D UI 讨论,**是否适用于 3D 球面/地图注记尚无先例背书**,属推测,需用本项目实际截图校准。
- **「配色无层次」直击 D24 痛点**:D24 用户明示「昼夜半球须有足够柔和明暗对比」「现状整球均匀深色不达标」——这与业界「timid, evenly-distributed palettes」批评是同一件事的 3D 版。这是一个可从先例佐证、且已被用户独立指出的高置信判据方向。

---

## Q4 落地建议:「审美验收官卡」应包含哪些要素(只列要素 + 依据,不写卡本身)

### 🔶 推测/判断(以下均为综合先例的建议,非既成事实;取舍留 orch/用户)

**A. 角色卡要素**

| 要素 | 内容要点 | 依据先例 |
| --- | --- | --- |
| 双职声明 | 明确「视觉方案制定(配色/层次)」+「视觉交付审美门禁」两职,并对应两套手法 | D25;P1(生成)+ P3(评审)分属两侧 |
| persona 锚定 | 设为「有明确品味、敢做取舍」的资深设计主创,而非中庸执行者 | P1「design lead ... could not be mistaken for anyone else's」;prg.sh 角色漂移 |
| 参照系(慎选) | 给深色地图/数据可视化标杆而非 Stripe/Linear;参照用「审美质感描述」不用「品牌一句话画像」 | P3/P5/P7 参照法 + Q3 反面证据;标杆选择接 `map-lod-202607.md` |
| 显式反模式黑名单 | 具名点破 AI 味:紫渐变、玻璃拟态、圆角/阴影堆砌、均匀无层次配色、Inter/Roboto、Dark Acid Default | P1 三默认、P2 anti-slop、prg.sh/SmoothUI tells |
| 品味原则 | 一个 signature、其余克制、「减一件」、主色 + 锐利点缀、层次优先 | P1、P2 |
| 3D 专属判据(自研) | 半球明暗对比、晨昏线柔和度、随相机分层注记密度、事件色在深底上的层次——**先例缺席,须依 spec/D24 自定** | D24;先例无覆盖(明确标注缺口) |
| 工具权限边界 | 只读 + 截图工具;**不改 src**,发现问题走提案/门禁,不自行改代码 | P3 tools 用只读+Playwright;本项目实例隔离/§7 纪律 |
| 与 rev 的分工 | 审美官管「好不好看/高级感」,rev 管「合不合 spec/正确性」;视觉场景在 rev 门禁外**叠加**审美验收 | D25「rev 门禁之外增加审美官验收」 |

**B. 验收 skill 流程要素**

| 要素 | 内容要点 | 依据先例 |
| --- | --- | --- |
| 截图取证 | 每条发现必配截图证据,复用现有 Playwright e2e + `doc/attachment/` 证据管道 | P3 screenshot=visual evidence;CLAUDE.md 视觉场景附截图 |
| 多视口/多状态 | 至少覆盖关键相机距离(远/中/近 LOD)、昼夜半球、有/无事件态 | P3 多视口;D24 分层显示 |
| 评分维度 | 明确维度而非单一「好看」:层次/对比、配色克制、注记密度、动效克制、面板质感、无障碍对比度 | P3 七阶段;P2 逐维度;SmoothUI 清单 |
| 分级 rubric + 否决权边界 | Blocker/High/Medium/Nit 四级;明确哪些是**硬否决**(如 Dark Acid、玻璃拟态滥用、半球无对比)、哪些是 Nit;门禁只挡 Blocker/High | P3 severity rubric |
| 「只提问题不开药方」 | 描述影响,把具体像素/取值留给 dev,避免审美官越权变成实现者 | P3「Problems Over Prescriptions」 |
| 迭代回合 | 制定阶段走「方案→自我批评→修订」两遍;验收走「批评→修最高影响项→复评」闭环 | P1 两遍;SmoothUI「A loop can converge」 |
| 正向确认 | 报告先肯定「哪里做对了」,再列问题 | P3 |
| 判据来源纪律 | 审美判据凡对外可见的须落 spec(接 SPEC-3.2a 等),不只写在卡里;改 spec 走 §7 | 本项目行为泄漏禁区 + §7 |

### 🔶 明确的能力缺口(诚实标注)

- **未找到公开先例**:面向 **3D/three.js 场景或地图球面**的「审美评审 agent 卡」——检索到的全部先例均为 2D Web UI / 落地页 / 仪表盘。3D 专属判据(半球对比、晨昏线、球面注记密度、深底事件色层次)在业界 prompt 层**无现成范本可抄**,须由本项目依 D24/spec 自研,建议以本项目实际截图逐条校准,不硬套 2D 判据。

---

## 对现有决议/spec 的冲击

- **无直接抵触**。本报告为 D25 前置调研,结论与 D24/D25 方向一致(尤其「配色无层次」与 D24「半球须有明暗对比」互为印证)。
- **一处需 orch 注意的张力**:先例中常见的「对标 Stripe/Linear」参照系,与本项目「去 AI 味 + 深色矢量地球」并不匹配,若照搬会引入紫渐变等 AI 味;参照标杆的选择应接 `doc/research/map-lod-202607.md`(D24 已立),不宜直接采用 SaaS 品牌画像。此为**建议**,非 spec 冲突,最终由 orch/用户定。

## 遗留问题(待下一轮或需产品负责人拍板)

1. **参照标杆待定**:深色地图/可视化的具体审美坐标(Apple Maps 深色 / Mapbox 深色 / NASA 可视化等)未在本报告核实,应在 `map-lod-202607.md` 或专项调研中落地后再喂给审美官卡。
2. **3D 专属判据须自研**:半球明暗对比、晨昏线柔和度、球面注记密度上限、深底事件色层次——无先例,建议由审美官依 D24 + spec 出首版判据,经实际截图校准。
3. **审美官与 rev 的门禁次序/否决权重**:视觉场景是「rev 与审美官双签」还是「审美官前置于 rev」,否决权边界(硬 Blocker vs 建议)如何与现有 signoff 机制衔接,需 orch 定。
4. **验收自动化程度**:对比度/间距等可量化项可否用脚本机械核对(接现有 evidence 管道),「高级感」这类主观项如何取证防造假,需设计。

---

## 来源汇总(均抓取于 2026-07-21)

- Anthropic frontend-design SKILL:https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md
- Claude Cookbook「Prompting for frontend aesthetics」:https://platform.claude.com/cookbook/coding-prompting-for-frontend-aesthetics
- OneRedOak design-review 工作流:https://github.com/OneRedOak/claude-code-workflows/tree/main/design-review
- VoltAgent ui-designer 卡:https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/01-core-development/ui-designer.md
- VoltAgent awesome-design-md:https://github.com/VoltAgent/awesome-design-md
- marvkr/better-design:https://github.com/marvkr/better-design
- superdesign:https://github.com/superdesigndev/superdesign
- v0 prompting 指南(Vercel):https://vercel.com/blog/how-to-prompt-v0
- prg.sh「Why Your AI Keeps Building the Same Purple Gradient Website」:https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website
- SmoothUI「AI Design Slop」:https://smoothui.dev/blog/ai-design-slop
- VoltAgent awesome-claude-code-subagents(总仓):https://github.com/VoltAgent/awesome-claude-code-subagents
