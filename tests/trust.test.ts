// M3-07：信源→信任等级映射（D22 最小信任层）——GeoEvent.source（SPEC-6.1）经 SPEC-5.10
// 表派生显示名 + 信任等级，供 L1 详情卡（SPEC-2.3，关联 FM-14）消费。
//
// 期望值来源（严格只从 doc/spec.md 推导，不读 src/data/trust.ts 的实现返回值反推）：
// - SPEC-5.10「信源 → 显示名 + 信任等级」表（doc/spec.md 第 173-183 行），逐字照抄：
//   usgs→USGS/权威事件源；eonet→NASA EONET/权威事件源；gdacs→GDACS/权威事件源；
//   ll2→Launch Library 2/权威事件源；opensky→OpenSky/权威事件源；
//   gdelt→GDELT/新闻报道（待验证）。
// - SPEC-5.10「每个 GeoEvent 信源归入两级之一」——六源的 tier 取值须恰为「权威事件源」/
//   「新闻报道（待验证）」两个字面量，且两者皆被实际用到（非退化为单一值）。
// - SPEC-6.1「source: string // 'usgs' | 'eonet' | 'gdacs' | 'gdelt' | 'll2' | 'opensky'」——
//   六源枚举的独立引用，用于核对映射表 key 集合无缺项/无多余项。
// - SPEC-5.10「分级为信源级常量（非逐事件从 payload 归一化产出），由 source（SPEC-6.1）经
//   本表派生，不新增 GeoEvent 字段」——对应三条判据：①同一 source 值多次派生结果一致；
//   ②两个 source 相同、其余字段（id/category/severity/...）迥异的 GeoEvent 派生结果仍完全
//   一致，证明派生只依赖 source 本身、不读取事件其余 payload；③派生调用前后 GeoEvent 对象
//   自身字段集合不变，不出现 tier/trust 类新增键。

import { describe, expect, it } from 'vitest'
import { getSourceTrust, SOURCE_TRUST } from '../src/data/trust'
import type { SourceTrustInfo, TrustTier } from '../src/data/trust'
import type { GeoEvent, SourceId } from '../src/data/types'

// SPEC-5.10 表，逐字照抄 doc/spec.md 第 173-183 行；独立誊写，不读 src/data/trust.ts 的
// SOURCE_TRUST 常量取值反推——本表本身即断言基准。
const SPEC_5_10_TABLE: Record<SourceId, SourceTrustInfo> = {
  usgs: { displayName: 'USGS', tier: '权威事件源' },
  eonet: { displayName: 'NASA EONET', tier: '权威事件源' },
  gdacs: { displayName: 'GDACS', tier: '权威事件源' },
  ll2: { displayName: 'Launch Library 2', tier: '权威事件源' },
  opensky: { displayName: 'OpenSky', tier: '权威事件源' },
  gdelt: { displayName: 'GDELT', tier: '新闻报道（待验证）' },
}

// SPEC-6.1 source 枚举，独立于上表誊写（doc/spec.md「source: string // 'usgs' | 'eonet' |
// 'gdacs' | 'gdelt' | 'll2' | 'opensky'」），供 key 集合完整性核对使用。
const SPEC_6_1_SOURCES: SourceId[] = ['usgs', 'eonet', 'gdacs', 'gdelt', 'll2', 'opensky']

// SPEC-6.1 GeoEvent 字段集合，逐字照抄 interface 定义的 10 个字段名，供「不新增字段」判据使用。
const SPEC_6_1_FIELDS = [
  'id',
  'category',
  'severity',
  'title',
  'summary',
  'urls',
  'lat',
  'lon',
  'ts',
  'source',
].sort()

describe('SOURCE_TRUST —— 六信源显示名+信任等级精确匹配 SPEC-5.10 表', () => {
  for (const [source, expected] of Object.entries(SPEC_5_10_TABLE)) {
    it(`${source} → displayName=${expected.displayName} / tier=${expected.tier}`, () => {
      expect(SOURCE_TRUST[source as SourceId]).toEqual(expected)
    })
  }

  it('key 集合与 SPEC-6.1 source 六值枚举逐一对应（无缺项/无多余项）', () => {
    expect(Object.keys(SOURCE_TRUST).sort()).toEqual([...SPEC_6_1_SOURCES].sort())
  })

  it('归入两级之一：六源 tier 取值集合恰为「权威事件源」/「新闻报道（待验证）」两个字面量，且两者均被实际用到（SPEC-5.10）', () => {
    const tiers = Array.from(new Set(Object.values(SOURCE_TRUST).map((v) => v.tier))).sort()
    const expectedTiers: TrustTier[] = ['权威事件源', '新闻报道（待验证）']
    expect(tiers).toEqual([...expectedTiers].sort())
  })
})

describe('getSourceTrust —— 查表派生函数逐源结果精确匹配 SPEC-5.10 表', () => {
  for (const [source, expected] of Object.entries(SPEC_5_10_TABLE)) {
    it(`getSourceTrust('${source}') 精确匹配 SPEC-5.10`, () => {
      expect(getSourceTrust(source as SourceId)).toEqual(expected)
    })
  }
})

describe('分级为信源级常量——不依赖事件 payload、不新增 GeoEvent 字段（SPEC-5.10）', () => {
  it('同一 source 值多次派生结果一致（信源级常量，非随机/非有状态）', () => {
    const first = getSourceTrust('usgs')
    const second = getSourceTrust('usgs')
    const third = getSourceTrust('usgs')
    expect(first).toEqual(SPEC_5_10_TABLE.usgs)
    expect(second).toEqual(SPEC_5_10_TABLE.usgs)
    expect(third).toEqual(SPEC_5_10_TABLE.usgs)
  })

  it('两个 source 相同、其余字段迥异的 GeoEvent 派生结果完全一致——证明分级只由 source 决定，非逐事件从 payload 归一化产出', () => {
    const eventA: GeoEvent = {
      id: 'gdelt:aaa',
      category: 'news',
      severity: 1,
      title: 'Alpha',
      summary: '',
      urls: ['https://a.example/1'],
      lat: 12.3,
      lon: -45.6,
      ts: 1_700_000_000_000,
      source: 'gdelt',
    }
    const eventB: GeoEvent = {
      id: 'gdelt:bbb',
      category: 'conflict',
      severity: 3,
      title: 'Bravo',
      summary: '较长的描述文本，用以证明字段差异不影响信任等级派生结果',
      urls: ['https://b.example/1', 'https://b.example/2'],
      lat: -70,
      lon: 170,
      ts: 1_800_000_000_000,
      source: 'gdelt',
    }
    const infoA = getSourceTrust(eventA.source)
    const infoB = getSourceTrust(eventB.source)
    expect(infoA).toEqual(infoB)
    expect(infoA).toEqual(SPEC_5_10_TABLE.gdelt)
  })

  it('派生调用前后 GeoEvent 对象自身字段集合不变，不含 tier/trust 类新增键（SPEC-5.10「不新增 GeoEvent 字段」）', () => {
    const event: GeoEvent = {
      id: 'usgs:test1',
      category: 'disaster',
      severity: 2,
      title: 't',
      summary: 's',
      urls: ['https://example.com'],
      lat: 10,
      lon: 20,
      ts: 1_700_000_000_000,
      source: 'usgs',
    }
    const keysBefore = Object.keys(event).sort()
    expect(keysBefore).toEqual(SPEC_6_1_FIELDS)

    getSourceTrust(event.source)

    const keysAfter = Object.keys(event).sort()
    expect(keysAfter).toEqual(keysBefore)
    expect(keysAfter).not.toContain('tier')
    expect(keysAfter).not.toContain('trust')
  })
})
