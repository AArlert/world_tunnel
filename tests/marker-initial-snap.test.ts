import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { GeoEvent } from '../src/data'
import { createMarkerLayer, type MarkerLayer } from '../src/globe/markers'

// M2-25（新登记，承接 REV-014 §4-3 / BUG-030 复验）：
// 标记层首批 snap 对照增量呼吸淡入——SPEC-3.11（v0.2.16 pin 消歧句）：
//   「呼吸式过渡以『已有在屏状态』为前态、只表达对该前态的增量……当无任何前态在屏
//   （全新安装无缓存，或本地缓存为空/读取失败）时，首个非空事件批次直接上屏——
//   标记透明度即置满、不淡入……该首批上屏后，其后所有增量……再按呼吸式过渡收敛。」
// 断言 A 的期望值另引 SPEC-3.2①「资源加载完成后直接替换，无淡入过渡」（初始态建立
// 统一无淡入的既定原则）；断言 B（对照）的期望值另引 D27「呼吸动效只用于增量：
// ①冷启动加载缓存→首轮刷新完成后，旧点呼吸离场、新点呼吸登场；②运行中……仅对
// 过时/新增的更新做呼吸登/离场」。
//
// 期望值均从上述 spec/决议文字推导，不照抄 src/globe/markers.ts 的 hasPopulated 实现
// 细节（断言不引用该字段，只观察其对外可见的透明度落点）。
//
// 测量口径：MarkerLayer 接口未直接暴露逐实例透明度的读口，唯一可观察通道是
// `layer.object`（接口显式导出的公开渲染对象图）下 dots InstancedMesh 的
// `instanceAlpha` per-instance 属性——该属性名与用途已由 markers.ts 自身的 shader
// 代码/注释固定为「呼吸过渡透明度通道」（唯一承载透明度的 GPU 侧数据），本文件
// 只读取其数值作为观测点，不读取/引用 slotAlpha、hasPopulated 等私有字段。

function makeEvent(id: string, severity: 1 | 2 | 3 = 2): GeoEvent {
  return {
    id,
    category: 'news',
    severity,
    title: `event ${id}`,
    summary: '',
    urls: [],
    lat: 10,
    lon: 20,
    ts: 0,
    source: 'usgs',
  }
}

/** 从 layer.object.children 中找到携带 instanceAlpha 属性的 dots 层（唯一持有该属性的实例网格）。 */
function getDotsAlphaAttr(layer: MarkerLayer): THREE.InstancedBufferAttribute {
  for (const child of layer.object.children as THREE.InstancedMesh[]) {
    const attr = child.geometry.getAttribute('instanceAlpha')
    if (attr) return attr as THREE.InstancedBufferAttribute
  }
  throw new Error('未找到携带 instanceAlpha 属性的 dots 层')
}

describe('标记层首批 snap 对照增量呼吸淡入（SPEC-3.11 v0.2.16 消歧句 + SPEC-3.2① + D27）', () => {
  it('断言A：无任何前态在屏时，首个非空批次的标记透明度初值即满值 1（snap，不淡入，SPEC-3.11 消歧句 + SPEC-3.2①）', () => {
    const layer = createMarkerLayer()
    const events = [makeEvent('a'), makeEvent('b'), makeEvent('c')]

    layer.setEvents(events) // 首个非空快照——此前从未 setEvents，无任何前态在屏

    const alphaAttr = getDotsAlphaAttr(layer)
    // 未调用 tick() 推进即已断言：终值应在建立瞬间已就位，不依赖任何过渡步进
    for (let i = 0; i < events.length; i++) {
      expect(alphaAttr.getX(i)).toBe(1)
    }
    layer.dispose()
  })

  it('断言B（对照）：已有前态在屏后新增的标记，透明度初值为 0，须经 tick 累计真实毫秒连续坡向满值（呼吸淡入，SPEC-3.11 呼吸句 + D27 增量语义）', () => {
    const layer = createMarkerLayer()
    layer.setEvents([makeEvent('a')]) // 建立前态：首批已上屏（对照组的「已有在屏状态」前提）

    layer.setEvents([makeEvent('a'), makeEvent('b')]) // 对既有前态的增量：新增一枚标记
    const alphaAttr = getDotsAlphaAttr(layer)

    // 新增标记 'b' 落在第二个分配槽位（第一次 setEvents 已占用槽位 0）
    const newSlot = 1
    expect(alphaAttr.getX(newSlot)).toBe(0) // 初值非满值，与断言 A 的 snap 形成对照

    layer.tick(100) // 推进部分真实毫秒
    const midAlpha = alphaAttr.getX(newSlot)
    expect(midAlpha).toBeGreaterThan(0)
    expect(midAlpha).toBeLessThan(1) // 存在严格介于 0~1 的过渡态（连续坡升，非瞬间跳变）

    layer.tick(10_000) // 推进足够长时长，令过渡收敛到终值
    expect(alphaAttr.getX(newSlot)).toBe(1)

    layer.dispose()
  })
})
