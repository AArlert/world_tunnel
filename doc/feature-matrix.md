# feature-matrix — 模块 × 里程碑 × 场景

「场景」列引用 testplan.md 编号；docs-check 校验幽灵引用。交付物路径按模块列出。

| 编号 | 里程碑 | 模块 | 交付物 | 场景 |
| --- | --- | --- | --- | --- |
| FM-00 | M0 | 工作流基建 | scripts/ + Makefile + doc/ 体系 | M0-01, M0-02, M0-03 |
| FM-01 | M0 | 应用骨架 | src/App.tsx + src/globe/GlobeScene.ts（占位球） | M0-02 |
| FM-02 | M1 | 天文计算 | src/astro/ + src/globe/sun.ts（sunDirectionModel，跨 FM-02/FM-03，见 design-prompt M1-globe.md §3.1） | M1-01, M1-02, M1-03 |
| FM-03 | M1 | 地球渲染 | src/globe/（昼夜 shader/大气/星空） | M1-04, M1-05, M1-06, M1-07, M1-08, M1-12, M1-14 |
| FM-04 | M1 | 地球交互 | src/globe/（拖拽/缩放/惯性/自转） | M1-09, M1-10, M1-11 |
| FM-05 | M2 | 数据核心 | src/data/（GeoEvent/scheduler/缓存） | （M2 起点登记） |
| FM-06 | M2 | 首批 provider | src/data/providers/（USGS/EONET/GDACS） | （M2 起点登记） |
| FM-07 | M2 | 事件标记+面板 | src/globe/ 标记层 + src/ui/ 事件流 | （M2 起点登记） |
| FM-08 | M3 | 全信源 | providers/（GDELT/LL2/OpenSky/CoinGecko） | （M3 起点登记） |
| FM-09 | M3 | 详情与搜索 | src/ui/ 详情卡+搜索 | （M3 起点登记） |
| FM-10 | M4 | 个性化 | watchlist/过滤/设置/持久化/通知 | （M4 起点登记） |
| FM-11 | M5 | iOS 壳 | ios/ + Capacitor 配置 + CI | （M5 起点登记） |
