// 信源信任分级表：GeoEvent.source（SPEC-6.1）经查表派生显示名 + 信任等级（SPEC-5.10）。
// 与 SPEC-5.8 T1–T4 解析分层为正交轴——本表只定「来源可信性质」，不涉坐标解析方式。
// 分级为信源级常量，不入 GeoEvent 模型（SPEC-5.10，比照 SPEC-3.7 category→颜色派生先例）。

import type { SourceId } from './types'

/** 两级信任等级，字面量即用户可见文案（SPEC-5.10）。 */
export type TrustTier = '权威事件源' | '新闻报道（待验证）'

/** 单一信源派生出的显示名 + 信任等级（L1 详情卡消费，SPEC-2.3）。 */
export interface SourceTrustInfo {
  displayName: string
  tier: TrustTier
}

/**
 * 信源 → 显示名 + 信任等级映射表，逐字照 SPEC-5.10。唯一事实源：L1 详情卡（FM-14）
 * 与其余消费方均须取此表，不得另立字符串（行为泄漏禁区，比照 markers.ts CATEGORY_COLORS 先例）。
 */
export const SOURCE_TRUST: Record<SourceId, SourceTrustInfo> = {
  usgs: { displayName: 'USGS', tier: '权威事件源' },
  eonet: { displayName: 'NASA EONET', tier: '权威事件源' },
  gdacs: { displayName: 'GDACS', tier: '权威事件源' },
  ll2: { displayName: 'Launch Library 2', tier: '权威事件源' },
  opensky: { displayName: 'OpenSky', tier: '权威事件源' },
  gdelt: { displayName: 'GDELT', tier: '新闻报道（待验证）' },
}

/** 查表派生（表驱动纯函数，同一 source 恒返回同一结果）。 */
export function getSourceTrust(source: SourceId): SourceTrustInfo {
  return SOURCE_TRUST[source]
}
