// T1 信源注册数组 —— M3 追加 provider（GDELT/OpenSky 等）的唯一开口（DP §3.6）。
// 不设插件系统、不设策略/事件总线抽象（DP §1「不做」清单、CLAUDE.md §1.2）。
//
// gdacs/ll2 字段映射待 G-2/G-3 仲裁 pin，尚未接入；接入方式同 usgs/eonet：各自
// 实现 normalizeXxx 纯函数 + xxxProvider 后追加至此数组。

import type { EventProvider } from '../types'
import { eonetProvider } from './eonet'
import { usgsProvider } from './usgs'

export const T1_PROVIDERS: EventProvider[] = [usgsProvider, eonetProvider]
