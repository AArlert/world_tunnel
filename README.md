# world_tunnel — 个人新闻地球仪

个人专属新闻信息流地球仪 App：可交互 3D 地球（晨昏线/夜景灯光/大气层），全球事件地理定位实时呈现——
突发新闻、自然灾害、地区冲突、人道危机，外加火箭发射、航班动态、加密行情。
点击事件见附带信源链接的精简摘要；watchlist/分类过滤只看关心的。

- 技术栈：TypeScript + Vite + React + three.js；M5 经 Capacitor 打 iOS 包（云 macOS CI，无需本地 Mac）。
- 数据：纯客户端直连免费 API（USGS / NASA EONET / GDACS / GDELT / Launch Library 2 / OpenSky / CoinGecko），契约见 [doc/spec.md](doc/spec.md) §5。
- 工作流：参照 [iverif-workflow](https://github.com/AArlert/iverif-workflow) 的证据链纪律（本仓库为 App 项目适配版）——没有测试 log 就没有 ✅，证据机械生成、首行可复跑。

## 路线图

| 里程碑 | 交付 | 版本 |
| --- | --- | --- |
| M0 基建 | 工作流体系、Vite+three.js 骨架、测试链路、spec v0、NASA 纹理 | 0.0.x |
| M1 地球仪 | 昼夜 shader 晨昏线、夜景灯光、大气、星空、拖拽/缩放/惯性 | 0.1.x |
| M2 事件数据层 | provider 框架 + USGS/EONET/GDACS、球面标记、事件流面板 | 0.2.x |
| M3 全信源+详情 | GDELT/火箭/航班图层/行情 ticker、详情卡、搜索 | 0.3.x |
| M4 个性化 | watchlist、过滤、通知、持久化、Claude 摘要开关 | 0.4.x |
| M5 iOS 打包 | Capacitor 壳、性能分级、云 CI 出包 → TestFlight | 0.5.x → **v1.0.0** |

## 快速开始

```bash
git config core.hooksPath .githooks   # 首次克隆后（启用 docs-check 软门禁）
npm install && npx playwright install chromium
make handover                          # 当前状态一览
make dev                               # 起 dev server（热更新，开发用）
make preview                           # 构建生产产物并本地预览（vite build + preview）
make regress                           # 全量回归（lint + 单测 + e2e）
```

工程纪律（角色、证据规则、缺陷闭环、单一事实源）见 [CLAUDE.md](CLAUDE.md)；
产品/视觉/数据规格见 [doc/spec.md](doc/spec.md)；场景与证据链见 [doc/testplan.md](doc/testplan.md)。

> Windows 注意：本机若为 PyManager/Store 版 Python（MSIX 容器），勿把 Playwright 调用挂在 python 子进程下——详见 doc/bugs.md BUG-001（regress 层因此用 Node 实现）。
