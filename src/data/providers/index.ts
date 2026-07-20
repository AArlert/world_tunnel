// T1 信源注册数组 —— M3 追加 provider（GDELT/OpenSky 等）的唯一开口（DP §3.6）。
// 不设插件系统、不设策略/事件总线抽象（DP §1「不做」清单、CLAUDE.md §1.2）。

import type { EventProvider } from '../types'
import { eonetProvider } from './eonet'
import { gdacsProvider } from './gdacs'
import { ll2Provider } from './ll2'
import { usgsProvider } from './usgs'

export const T1_PROVIDERS: EventProvider[] = [usgsProvider, eonetProvider, gdacsProvider, ll2Provider]
