import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { GeoEvent } from '../src/data'
import {
  CATEGORY_COLORS,
  SEVERITY_BASE_SIZE,
  SEVERITY_PULSE_AMP,
  createMarkerLayer,
} from '../src/globe/markers'

// M2-10（单测部分，视觉部分见 e2e/marker-category-severity.spec.ts）：
// 事件标记分类色表 + severity 分级常量序关系（SPEC-3.7）。
// 期望值只从 doc/spec.md SPEC-3.7 表推导，用 THREE.Color 做十六进制字面量间接比对
// （与 tests/atmosphere.test.ts 的既有写法一致），不读实现取值反推。
//
// M2-11（单测）：标记层大规模渲染路径——SPEC-3.8「标记 ≥200 个时用 instancing/点精灵，
// 不逐事件建 Mesh」。断言渲染对象（object.children）数量恒为 2（dots + rings 两个
// InstancedMesh），不随事件数增长到与事件数相等；60fps 帧率量测归 FM-11，本文件不做
// 帧率断言。

// SPEC-3.7 六分类色表，逐字照抄条目正文
const SPEC_3_7_COLORS: Record<string, number> = {
  disaster: 0xff4d4f,
  conflict: 0xff7a45,
  humanitarian: 0xffc53d,
  news: 0x40a9ff,
  launch: 0xb37feb,
  flight: 0x5cdbd3,
}

describe('CATEGORY_COLORS —— 六分类色精确匹配 SPEC-3.7 色表', () => {
  for (const [category, hex] of Object.entries(SPEC_3_7_COLORS)) {
    it(`${category} 精确等于 SPEC-3.7 色表值`, () => {
      const actual = new THREE.Color(CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS])
      const expected = new THREE.Color(hex)
      expect(actual.r).toBeCloseTo(expected.r, 6)
      expect(actual.g).toBeCloseTo(expected.g, 6)
      expect(actual.b).toBeCloseTo(expected.b, 6)
    })
  }

  it('六分类色表 key 集合与 SPEC-3.7 表逐条一致（无缺项/无多余项）', () => {
    expect(Object.keys(CATEGORY_COLORS).sort()).toEqual(Object.keys(SPEC_3_7_COLORS).sort())
  })
})

describe('severity 分级常量 —— 基础尺寸/脉冲幅度随级别递增（SPEC-3.7）', () => {
  // SPEC-3.7「severity ∈ {1,2,3}：标记基础尺寸与脉冲光环幅度随级别递增」——
  // 具体数值属实现自由度，本文件只断言严格递增的序关系，不断言实现取值。
  it('SEVERITY_BASE_SIZE[1] < [2] < [3]', () => {
    expect(SEVERITY_BASE_SIZE[1]).toBeLessThan(SEVERITY_BASE_SIZE[2])
    expect(SEVERITY_BASE_SIZE[2]).toBeLessThan(SEVERITY_BASE_SIZE[3])
  })

  it('SEVERITY_PULSE_AMP[1] < [2] < [3]', () => {
    expect(SEVERITY_PULSE_AMP[1]).toBeLessThan(SEVERITY_PULSE_AMP[2])
    expect(SEVERITY_PULSE_AMP[2]).toBeLessThan(SEVERITY_PULSE_AMP[3])
  })
})

// ---- M2-11 ----

function makeEvent(i: number): GeoEvent {
  const categories = Object.keys(CATEGORY_COLORS) as (keyof typeof CATEGORY_COLORS)[]
  return {
    id: `synthetic:${i}`,
    category: categories[i % categories.length],
    severity: ((i % 3) + 1) as 1 | 2 | 3,
    title: `event ${i}`,
    summary: '',
    urls: [],
    lat: ((i * 37) % 180) - 90,
    lon: ((i * 53) % 360) - 180,
    ts: i,
    source: 'usgs',
  }
}

describe('createMarkerLayer —— ≥200 事件下渲染对象数恒定（SPEC-3.8）', () => {
  it('构建初始层：渲染对象数为 2（dots + rings 两个 InstancedMesh）', () => {
    const layer = createMarkerLayer()
    expect(layer.object.children.length).toBe(2)
    for (const child of layer.object.children) {
      expect(child).toBeInstanceOf(THREE.InstancedMesh)
    }
    layer.dispose()
  })

  it('setEvents(250 条) 后渲染对象数仍为 2，不随事件数线性增长到 250（SPEC-3.8）', () => {
    const layer = createMarkerLayer()
    const events = Array.from({ length: 250 }, (_, i) => makeEvent(i))
    layer.setEvents(events)

    // 渲染对象（scene 图节点）数量恒定：不逐事件建 Mesh
    expect(layer.object.children.length).toBe(2)
    // 每个 InstancedMesh 各自用一份实例缓冲承载全部 250 个事件，而非 250 个独立 Mesh
    for (const child of layer.object.children as THREE.InstancedMesh[]) {
      expect(child).toBeInstanceOf(THREE.InstancedMesh)
      expect(child.count).toBe(events.length)
    }
    layer.dispose()
  })

  it('事件数从 10 增至 260 时，渲染对象数不随之增长（对照两种规模）', () => {
    const layer = createMarkerLayer()
    layer.setEvents(Array.from({ length: 10 }, (_, i) => makeEvent(i)))
    const childrenAtSmall = layer.object.children.length

    layer.setEvents(Array.from({ length: 260 }, (_, i) => makeEvent(i)))
    const childrenAtLarge = layer.object.children.length

    expect(childrenAtSmall).toBe(2)
    expect(childrenAtLarge).toBe(2)
    expect(childrenAtLarge).toBe(childrenAtSmall)
    layer.dispose()
  })
})
