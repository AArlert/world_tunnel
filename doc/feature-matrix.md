# feature-matrix — 模块 × 里程碑 × 场景

「场景」列引用 testplan.md 编号；docs-check 校验幽灵引用。新里程碑行的场景由 qa 开卡时登记后回填。
本表 v2：依 doc/design-prompt/proposal-roadmap-v2.md §3（REV-006 放行）重排，SPEC 锚点并入交付物列。

| 编号 | 里程碑 | 模块 | 交付物 | 场景 |
| --- | --- | --- | --- | --- |
| FM-00 | M0 | 工作流基建 | scripts/ + Makefile + doc/ 体系 | M0-01, M0-02, M0-03 |
| FM-01 | M0 | 应用骨架 | src/App.tsx + src/globe/GlobeScene.ts（占位球） | M0-02 |
| FM-02 | M1 | 天文计算 | src/astro/ + src/globe/sun.ts（SPEC-4.1~4.5；sunDirectionModel 跨 FM-02/FM-03，见 design-prompt M1-globe.md §3.1） | M1-01, M1-02, M1-03 |
| FM-03 | M1 | 地球渲染 | src/globe/（昼夜 shader/大气/星空；SPEC-3.2~3.6） | M1-04, M1-05, M1-06, M1-07, M1-08, M1-12, M1-14 |
| FM-04 | M1 | 地球交互 | src/globe/（拖拽/缩放/惯性/自转；SPEC-7.1/7.2/7.3/7.5。SPEC-7.4 未交付，拆挂 FM-07+FM-14） | M1-09, M1-10, M1-11 |
| FM-05 | M2 | 数据核心 | src/data/（GeoEvent/scheduler/缓存/去重/过期；SPEC-5.0, 5.0a, 6.1, 6.2, 6.3） | M2-01, M2-02, M2-03, M2-04, M2-09 |
| FM-06 | M2 | T1 信源 | src/data/providers/（USGS/EONET/GDACS/LL2；SPEC-5.1, 5.2, 5.3, 5.5, 5.8-T1） | M2-05, M2-06, M2-07, M2-08 |
| FM-07 | M2 | 事件标记 + 面板 | src/globe/ 标记层 + src/ui/ 事件流面板（SPEC-2.2, 3.7, 3.8；SPEC-3.4 不遮挡真标记回补；SPEC-7.4 列表↔标记联动分片。**动效批 D27/BUG-031：SPEC-3.7a 光柱形态与静态体积辉光、SPEC-3.7b 静态新鲜度、SPEC-3.7c 标记 LOD 聚合——dev 实现待动效批 design-prompt**。R3/M3 抽屉化见 FM-29） | M2-10, M2-11, M2-12, M2-13, M2-14, M2-22, M3-01, M3-02, M3-03, M3-04, M3-05, M3-06 |
| FM-08 | M2 | 矢量默认风格 | src/globe/ 矢量昼夜风格，替换卫星默认（SPEC-3.2 重写, 3.3） | M2-15, M2-16, M2-17 |
| FM-09 | M2 | 缓存优先启动 | src/data/ 启动缓存 + 呼吸式过渡（SPEC-3.11, 8.4；**SPEC-3.11a reduced-motion P1 降级——稳态无动画、增量呼吸瞬切，SPEC-3.11 呼吸本身不改**） | M2-20, M2-21, M2-25 |
| FM-10 | M2 | 顶栏 + 基础分类过滤 | src/ui/（品牌名 Worlens · UTC 时钟 · 六 category 开关；SPEC-2.1, 2.4①, 8.1 分类子集） | M2-18, M2-19 |
| FM-11 | M2 | 性能预算基线 | 首包/冷启动基线量测（SPEC-3.10 基线, 3.8） | M2-23, M2-24 |
| FM-12 | M3 | 扩展信源 | providers/（GDELT；SPEC-5.4；SPEC-5.10：GDELT 归「新闻报道（待验证）」，分级由 `source` 经表派生，provider 不加字段。**CoinGecko 行情 ticker 已删除（R2/D31，原 SPEC-5.7 处死）；OpenSky 航班图层（SPEC-5.6）与 SPEC-6.3① flight-60s 已移出 M3、改挂 M6 FM-27——REV-016/BUG-017 裁定原生端专属**） | （M3 开卡登记） |
| FM-13 | M3 | 解析分层 T2/T2.5/T3 | src/data/geo/（gazetteer 查表 + 关键词规则 + GDELT 编码采用；SPEC-5.8, 5.4；注：SPEC-5.10 信任分级为独立于本行 SPEC-5.8 T1–T4 的正交轴，二者不得互相推导，避免与解析分层混同） | （M3 开卡登记） |
| FM-14 | M3 | 详情卡 + 搜索 | src/ui/ 详情卡 + 缓存/地名搜索（SPEC-2.3, 2.5；SPEC-7.4 点击飞行+详情卡分片；SPEC-2.3 改写 + SPEC-5.10：信源名/等级、`urls` 计数去重呈现、轻量纠错反馈入口） | （M3 开卡登记） |
| FM-15 | M3 | 首启引导 + 开屏锚定 | src/ui/ 引导（**守望第一问「你守望哪里/牵挂谁」采集地方/人/主题 + 次级垂类分流**）+ src/globe/ 锚定视角（**SPEC-8.6 重铸（R7/REV-020）**, 3.1） | M3-13 |
| FM-16 | M4 | 守望精化 | **精细圆域（中心+半径 km）+ 复杂过滤/多守望条目组合 + inline 命中强调（aes 付税 → arch 落 SPEC-8.2，REV-020 遗留义务 2）+ 守望持久化完整化（建于 M3 FM-28 守望最小闭环之上；SPEC-8.1 精化, 8.2 完整过滤, 8.4）** | （M4 开卡登记） |
| FM-17 | M4 | 事件保留 | 收藏永久保存 + 过期窗 48–72h 可配（SPEC-6.3, 8.4） | （M4 开卡登记） |
| FM-18 | M4 | 风格商店 + 支付 | 风格包懒加载切换 + 许可码本地校验 + 设置入口（SPEC-3.9, 8.8 许可码, 2.4②③） | （M4 开卡登记） |
| FM-19 | M4 | 通知（Web） | Web Notification，守望命中（SPEC-8.3；概念词 R7/REV-020 F-2） | （M4 开卡登记） |
| FM-20 | M5 | PWA 升格 | manifest + service worker + 离线壳 + 缓存闭环（SPEC-3.11, 5.9 web 子集） | （M5 开卡登记） |
| FM-21 | M5 | 性能达标 + 合规收口 | 性能验收 + API 条款核查汇总签核（SPEC-3.10 达标, 5.9；SPEC-7.5 变频回归 R-9） | （M5 开卡登记） |
| FM-22 | M5 | 匿名遥测 | src/telemetry/ 心跳 + 低配服务器 + 关闭入口（SPEC-8.7） | （M5 开卡登记） |
| FM-23 | M6 | iOS 壳 + CI | ios/ + Capacitor 配置 + 云 macOS CI（SPEC-1 iOS） | （M6 开卡登记） |
| FM-24 | M6 | App Store 内购 | iOS IAP 解锁风格包（SPEC-8.8 IAP, 3.9） | （M6 开卡登记） |
| FM-25 | M6 | 自定义 RSS（原生） | 原生 feed 请求 + 内容展示 feed 自带为限（SPEC-5.9 原生全集, 5.8-T4 钉图；SPEC-5.10：RSS 信源默认归「新闻报道（待验证）」，显示名取 feed 标题，前向兼容） | （M6 开卡登记） |
| FM-26 | M6 | 原生通知 | Capacitor Local Notifications（SPEC-8.3 换端） | （M6 开卡登记） |
| FM-27 | M6 | 原生端航班图层 | providers/ OpenSky（原生请求不受 CORS 限制）+ 航班图层开关（SPEC-5.6 原生端专属；承接 SPEC-6.3① flight-60s；REV-016/BUG-017 从 M3 FM-12 改挂） | （M6 开卡登记，qa 核对 flight-60s 场景 BUG-016） |
| FM-28 | M3 | 守望最小闭环 | src/data/ 守望匹配 + src/store/ 守望对象本地存 + src/ui/ 过滤模式（地方/人/主题守望 → 命中 → 隔离式呈现 + 仅守望命中过滤；SPEC-8.1 M3 最小形态, 8.2 仅命中模式, 8.6 引导采集；R7/REV-020 授权，DEV 开卡前 arch 出 design-prompt——REV-020 遗留义务 1） | M3-11, M3-12 |
| FM-29 | M3 | 静谧默认态与安好态 | src/ui/ 表盘默认态（事件流面板退位默认收起「今日刻痕」抽屉、静息核心球+时间+光柱）+ 安好态空状态（有/无守望对象二分；抽屉复用现有 EventPanel）（SPEC-2.2 默认态, 2.2a 安好态；R3+R5/REV-022 授权） | M3-14, M3-15, M3-16 |

后置（无 FM 行，§9 显式登记，非蒸发）：SPEC-8.5 AI 摘要（付费，阶段二前后）、时间滑块（SPEC-6.3 预留缓存窗口）、SPEC-5.8 T4 智能解析（付费）。
非路线图流程 gate（orch 台账跟踪）：D2 营销、**D4 商标/重名检查（已前移为近期高优，备选名征集中）**、D5 用户验证、**D12 付费意愿最小验证（发布 gate）**、D16 阶段二触发、D19 license+CLA（详见 doc/product-decisions.md 各条修订）。
