// T1 信源注册数组 —— M3 追加 provider（GDELT/OpenSky 等）的唯一开口（DP §3.6）。
// 不设插件系统、不设策略/事件总线抽象（DP §1「不做」清单、CLAUDE.md §1.2）。
//
// 本卡（M2 数据核心骨架）不实现任何具体 provider：usgs/eonet/gdacs/ll2 由后续单卡
// 各自实现 normalizeXxx 纯函数 + xxxProvider 后追加至此数组。

import type { EventProvider } from '../types'

export const T1_PROVIDERS: EventProvider[] = []
