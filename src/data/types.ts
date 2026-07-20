// 数据层类型契约：GeoEvent 归一化模型（SPEC-6.1）+ provider/scheduler 协议（SPEC-5.0）。
// 本模块零 three.js 依赖，坐标以 WGS84 度传递，球面换算属 globe 层（SPEC-6.2）。

export type Category = 'disaster' | 'conflict' | 'humanitarian' | 'news' | 'launch' | 'flight'

export type SourceId = 'usgs' | 'eonet' | 'gdacs' | 'gdelt' | 'll2' | 'opensky'

/**
 * 归一化事件模型，字段逐字照 SPEC-6.1；语义以 SPEC-6.1 为准，本处不复述。
 * id 为全局唯一去重键（`{source}:{原始id}`），跨轮询稳定（SPEC-6.1 + 6.3）。
 */
export interface GeoEvent {
  id: string
  category: Category
  severity: 1 | 2 | 3
  title: string
  summary: string
  urls: string[]
  lat: number // WGS84 度
  lon: number // WGS84 度
  ts: number // epoch ms（事件时间；无则用抓取时间）
  source: SourceId
}

/**
 * provider 单轮拉取结果。transport/解析异常一律 throw，退避交 scheduler 处理（SPEC-5.0）。
 */
export type ProviderResult =
  | { status: 'ok'; events: GeoEvent[] }
  | { status: 'notModified' } // 304：视为成功且无新数据（SPEC-5.0）

/**
 * 单次轮询上下文。now/signal 均为显式注入，保证归一化纯函数可复现、dispose 可中止（§4.1/4.3）。
 */
export interface PollContext {
  firstRun: boolean // 首轮：如 USGS 拉 all_day 回填（SPEC-5.1）
  now: number // 注入时钟（epoch ms）：如 LL2 时序 severity 可测（SPEC-5.5）
  signal: AbortSignal // dispose 中止在途请求
}

/**
 * 信源契约。每源自带轮询间隔（SPEC-5.1/5.2/5.3/5.5），poll 一次返回归一化结果。
 */
export interface EventProvider {
  readonly source: SourceId
  readonly intervalMs: number
  poll(ctx: PollContext): Promise<ProviderResult>
}
