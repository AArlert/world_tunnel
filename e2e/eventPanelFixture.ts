import type { Page } from '@playwright/test'

/**
 * M2-13/M2-14 共用：经真实数据流（App.tsx → dataLayer.store → React state）驱动
 * EventPanel 与标记层。
 *
 * 为什么不用 `setDebugEvents`（e2e/globeDebug.ts）：该函数直接调用
 * `GlobeScene.setEvents`（src/globe/GlobeScene.ts 公开方法），只喂标记层，绕过
 * App.tsx 的 `dataLayer.store.subscribe` → React `events` state 这条路径——EventPanel
 * 消费的正是这个 React state（见 src/ui/GlobeStage.tsx），debug 钩子注入对它不可见。
 * 本文件改为拦截网络请求，让真实 dataLayer 走完整链路（cache 空 → scheduler 首轮
 * 拉取 → store.upsertMany → notify → React state → GlobeStage 同时下发给 EventPanel
 * 与 GlobeScene.setEvents），从而让面板与标记层真正来自同一份数据（M2-13 判据
 * 「列表条目数与球面已加载事件标记数一一对应」的前提）。
 *
 * 用 GDACS 信源（src/data/providers/gdacs.ts）作为承载：其归一化字段
 * （name/htmldescription/datemodified/alertlevel/eventtype/坐标）均可由调用方
 * 任意指定，能精确控制标题/摘要/时间/分类/坐标；其余三源不适配——USGS 标题强制拼接
 * `M{mag} ` 前缀且 summary 恒为空串，LL2 坐标为字符串需转换且语义（火箭发射）不适合
 * 任意分类测试。仅读 gdacs.ts 的归一化字段名与请求 URL 做对接（未把其内部行为当期望值）。
 * 除本机 dev server 外的跨域请求一律 abort（沿用 e2e/marker-category-severity.spec.ts
 * 头注的拦截手法，避免真实网络数据与本文件构造数据竞态覆盖）。
 */

const GDACS_FEED_URL = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP'

export interface GdacsFixtureInput {
  eventid: string
  /** 'DR'/'FL' → humanitarian，其余 → disaster（normalizeGroup 归一化规则，仅供构造合法 mock 对接，非期望值来源） */
  eventtype?: string
  name: string
  htmldescription?: string
  lat: number
  lon: number
  datemodifiedMs: number
  alertlevel?: 'Green' | 'Orange' | 'Red'
}

function toFeature(input: GdacsFixtureInput) {
  return {
    geometry: { type: 'Point', coordinates: [input.lon, input.lat] },
    properties: {
      eventid: input.eventid,
      eventtype: input.eventtype ?? 'EQ',
      name: input.name,
      htmldescription: input.htmldescription ?? '',
      url: { report: `https://example.test/report/${input.eventid}` },
      datemodified: new Date(input.datemodifiedMs).toISOString(),
      alertlevel: input.alertlevel ?? 'Green',
    },
  }
}

/** 拦截网络、注入构造的 GDACS 响应、导航到首页；不等待面板/标记就绪（调用方自行等）。 */
export async function bootWithGdacsEvents(page: Page, inputs: GdacsFixtureInput[]): Promise<void> {
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return route.continue()
    if (route.request().url() === GDACS_FEED_URL) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ features: inputs.map(toFeature) }),
      })
    }
    return route.abort()
  })
  await page.bringToFront()
  await page.goto('/')
}
