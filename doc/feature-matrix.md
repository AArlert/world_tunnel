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
| FM-07 | M2 | 事件标记 + 面板 | src/globe/ 标记层 + src/ui/ 事件流面板（SPEC-2.2, 3.7, 3.8；SPEC-3.4 不遮挡真标记回补；SPEC-7.4 列表↔标记联动分片） | M2-10, M2-11, M2-12, M2-13, M2-14, M2-22, M3-01, M3-02, M3-03, M3-04, M3-05, M3-06 |
| FM-08 | M2 | 矢量默认风格 | src/globe/ 矢量昼夜风格，替换卫星默认（SPEC-3.2 重写, 3.3） | M2-15, M2-16, M2-17 |
| FM-09 | M2 | 缓存优先启动 | src/data/ 启动缓存 + 呼吸式过渡（SPEC-3.11, 8.4） | M2-20, M2-21, M2-25 |
| FM-10 | M2 | 顶栏 + 基础分类过滤 | src/ui/（品牌名 Worlens · UTC 时钟 · 六 category 开关；SPEC-2.1, 2.4①, 8.1 分类子集） | M2-18, M2-19 |
| FM-11 | M2 | 性能预算基线 | 首包/冷启动基线量测（SPEC-3.10 基线, 3.8） | M2-23, M2-24 |
| FM-12 | M3 | 扩展信源 | providers/（GDELT/OpenSky/CoinGecko；SPEC-5.4, 5.6, 5.7；SPEC-6.3① flight-60s 保留语义随 opensky 场景承接，REV-007 F-1/BUG-016） | （M3 开卡登记） |
| FM-13 | M3 | 解析分层 T2/T2.5/T3 | src/data/geo/（gazetteer 查表 + 关键词规则 + GDELT 编码采用；SPEC-5.8, 5.4） | （M3 开卡登记） |
| FM-14 | M3 | 详情卡 + 搜索 | src/ui/ 详情卡 + 缓存/地名搜索（SPEC-2.3, 2.1-ticker, 2.5；SPEC-7.4 点击飞行+详情卡分片） | （M3 开卡登记） |
| FM-15 | M3 | 首启引导 + 开屏锚定 | src/ui/ 引导（垂类分流 + 粗粒度地理关注）+ src/globe/ 锚定视角（SPEC-8.6, 3.1） | （M3 开卡登记） |
| FM-16 | M4 | 高级个性化 | watchlist（地点/关键词）+ 过滤模式 + 持久化（SPEC-8.1, 8.2, 8.4） | （M4 开卡登记） |
| FM-17 | M4 | 事件保留 | 收藏永久保存 + 过期窗 48–72h 可配（SPEC-6.3, 8.4） | （M4 开卡登记） |
| FM-18 | M4 | 风格商店 + 支付 | 风格包懒加载切换 + 许可码本地校验 + 设置入口（SPEC-3.9, 8.8 许可码, 2.4②③） | （M4 开卡登记） |
| FM-19 | M4 | 通知（Web） | Web Notification，watchlist 命中（SPEC-8.3） | （M4 开卡登记） |
| FM-20 | M5 | PWA 升格 | manifest + service worker + 离线壳 + 缓存闭环（SPEC-3.11, 5.9 web 子集） | （M5 开卡登记） |
| FM-21 | M5 | 性能达标 + 合规收口 | 性能验收 + API 条款核查汇总签核（SPEC-3.10 达标, 5.9；SPEC-7.5 变频回归 R-9） | （M5 开卡登记） |
| FM-22 | M5 | 匿名遥测 | src/telemetry/ 心跳 + 低配服务器 + 关闭入口（SPEC-8.7） | （M5 开卡登记） |
| FM-23 | M6 | iOS 壳 + CI | ios/ + Capacitor 配置 + 云 macOS CI（SPEC-1 iOS） | （M6 开卡登记） |
| FM-24 | M6 | App Store 内购 | iOS IAP 解锁风格包（SPEC-8.8 IAP, 3.9） | （M6 开卡登记） |
| FM-25 | M6 | 自定义 RSS（原生） | 原生 feed 请求 + 内容展示 feed 自带为限（SPEC-5.9 原生全集, 5.8-T4 钉图） | （M6 开卡登记） |
| FM-26 | M6 | 原生通知 | Capacitor Local Notifications（SPEC-8.3 换端） | （M6 开卡登记） |

后置（无 FM 行，§9 显式登记，非蒸发）：SPEC-8.5 AI 摘要（付费，阶段二前后）、时间滑块（SPEC-6.3 预留缓存窗口）、SPEC-5.8 T4 智能解析（付费）。
非路线图流程 gate（orch 台账跟踪）：D2 营销、**D4 商标/重名检查（已前移为近期高优，备选名征集中）**、D5 用户验证、**D12 付费意愿最小验证（发布 gate）**、D16 阶段二触发、D19 license+CLA（详见 doc/product-decisions.md 各条修订）。
