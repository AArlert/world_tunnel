# tests/fixtures 抓取登记

本目录样本为 T1 四源真实响应，原样保存（未格式化、未删减）。JSON 文件本身不支持注释，抓取信息统一登记于此表。
依据 CLAUDE.md §7：「上游 API 响应样本存 tests/fixtures/，是 provider 单测的事实依据；样本更新须在 commit message 说明抓取时间」。

| 文件名 | 来源 URL | 抓取时间（UTC） | 抓取命令 | 字节数 | SPEC 依据 |
| --- | --- | --- | --- | --- | --- |
| `usgs_all_hour.json` | `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson` | 2026-07-20T14:18:26Z | `curl -sS -A "world_tunnel-qa-fixture-fetch/1.0" "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson" -o usgs_all_hour.json` | 3116 | SPEC-5.1 |
| `usgs_all_day.json` | `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson` | 2026-07-20T14:18:40Z | `curl -sS -A "world_tunnel-qa-fixture-fetch/1.0" "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson" -o usgs_all_day.json` | 136380 | SPEC-5.1（旧 all_day 契约，保留） |
| `usgs_2.5_day.json` | `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson` | 2026-07-21T03:20:15Z | `curl -sS -A "world_tunnel-qa-fixture-fetch/1.0" --max-time 60 "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson" -o usgs_2.5_day.json` | 36922 | SPEC-5.1（M2.5+ 显著性 feed，v0.2.8/REV-012 新端点；启动回填） |
| `eonet_events.json` | `https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=7` | 2026-07-20T14:18:49Z | `curl -sS -A "world_tunnel-qa-fixture-fetch/1.0" "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=7" -o eonet_events.json` | 83058 | SPEC-5.2 |
| `gdacs_eventlist.json` | `https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP` | 2026-07-20T14:19:20Z | `curl -sS --max-time 60 -A "Mozilla/5.0 world_tunnel-qa-fixture-fetch/1.0" "https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP" -o gdacs_eventlist.json` | 634344 | SPEC-5.3 |
| `ll2_upcoming.json` | `https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=10&mode=list` | 2026-07-20T14:19:37Z | `curl -sS --max-time 60 -A "world_tunnel-qa-fixture-fetch/1.0" "https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=10&mode=list" -o ll2_upcoming.json`（免费额敏感，只抓一次） | 9822 | SPEC-5.5 |
| `ll2_upcoming_detailed.json` | `https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=10&mode=detailed` | 2026-07-20T14:38:00Z | `curl -sS --max-time 60 -A "world_tunnel-qa-fixture-fetch/1.0" "https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=10&mode=detailed" -o ll2_upcoming_detailed.json`（mode=detailed variant）| 154831 | SPEC-5.5 |

## 备注

- `gdacs_eventlist.json` 首次抓取返回 HTTP 500.31（GDACS 服务端 IIS/ASP.NET Core 运行时加载失败，返回 HTML 错误页，非本地问题），间隔约 40 秒后重试即恢复 200；最终样本大小 634344 字节，与 spec 描述的「约 600KB」一致。该 500 未保留为样本（属瞬时上游故障，不代表接口契约）。
- 其余四源均一次请求即 200 成功。
- 所有文件已用 `node -e "JSON.parse(...)"` 校验为合法 JSON。
