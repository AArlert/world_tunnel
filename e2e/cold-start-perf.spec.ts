import { execSync, spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { canvasBufferSize, findColorInRegion, waitNextFrame } from './globeDebug'

// M2-24：冷启动计时与帧率基线量测（e2e，非阈值门禁）。
// 期望值出处（只从 doc/spec.md 推导，逐条标注 SPEC 条目号；判据文字详见 doc/testplan.md M2-24 行）：
//   - SPEC-3.10「中端手机冷启动 → 可交互地球 ≤3s；缓存事件上屏 ≤1s（SPEC-3.11）；……验收基准
//     环境与量测方法由 M5 testplan 场景定义（M2 建基线量测）」——本机/CI 非中端手机验收环境，
//     三项数值只要求量测流程可复跑、产出有限非负数值并入证据，不做 ≤3s/≤1s/≥60fps 门禁断言。
//   - SPEC-3.8「桌面 Chrome 目标 60fps」——帧率基线数值量测（承接 M2-11 搁置项）。
//   - SPEC-3.11「冷启动即渲染上次本地缓存事件（球面标记）」——「缓存事件上屏」耗时的量测对象
//     即「预置本地缓存事件后，标记从注入到渲染输出中出现所经过的时间」。
//
// 【运行环境选择：生产 preview 服务器，非 dev server】
// 本场景连接的是**生产构建 + `vite preview`** 服务的页面（本文件在 beforeAll 内自行起、用完
// 在 afterAll 关，独立于 playwright.config.ts 的全局 `npm run dev` webServer，不影响其余
// e2e 用例）。原因（登记于 doc/bugs.md BUG-034，QA 编写本场景时发现并用最小 Node 级用例
// 独立复现，见 tests/data-layer-early-stop-cache-loss.test.ts）：dev server 下 React 18
// StrictMode 的「挂载→立即卸载→再挂载」双调用效应，会让第一个（很快被卸载的）dataLayer
// 实例在其自身 cache.load() 完成前就被 stop()，而 stop() 无条件用（此时必为空的）store 快照
// 覆盖持久化 IndexedDB——预置的缓存事件因此被清空，100% 复现，无法测出真实的「缓存事件
// 上屏」耗时（该问题是 dev-only 的 React 运行时行为，production 构建不受影响，StrictMode
// 的双调用本身即靠 `process.env.NODE_ENV!=='production'` 触发）。用生产 preview 服务器规避
// 此缺陷，同时也让计时结果更贴近 SPEC-3.10「中端手机冷启动」实际验收对象（生产构建产物，
// 非携带 HMR/未压缩源码的 dev server）。
//
// 【黑盒量测手法：不用 DEV-only 调试钩子】
// e2e/globeDebug.ts 的多数助手（waitForGlobeDebug/sampleMarkerCount 等）依赖
// `window.__globeDebug`（src/globe/GlobeScene.ts 内 `if (import.meta.env.DEV)` 才挂载）。
// 调试实测确认：`import.meta.env.DEV` 由 vite 的 command（`build` 恒为生产）决定、不受
// `--mode` 参数影响——任何 `vite build` 产物（无论 `--mode` 传何值）均不含该调试钩子，
// 与 dev server 二选一不可兼得。本场景选择放弃调试钩子、改用与 globeDebug.ts 内不依赖
// 该钩子的黑盒手法一致的方式（`canvasBufferSize`/`findColorInRegion`/`waitNextFrame`——
// 三者均只操作 `#globe-container canvas` 的 DOM/像素，不读 `window.__globeDebug`）：
//   ①「可交互地球」：canvas 缓冲区非零尺寸（真实完成一次布局）+ 经过至少两帧真实渲染
//      （`waitNextFrame` 双重 rAF）+ 无 pageerror——与 e2e/smoke.spec.ts（M0-02）判定
//      「canvas 渲染」同一量级的黑盒证据，非本场景独创宽松标准。
//   ②「缓存事件上屏」：预置的种子事件取用与 e2e/marker-breathing-transition.spec.ts 同一
//      「已知 lat/lon → 屏幕像素」投影公式（SPEC-3.1 默认视角 + SPEC-6.2 坐标约定），
//      各配一个 SPEC-3.7 分类色；冷启动后在其投影像素周边区域轮询该分类色是否出现
//      （`findColorInRegion`，与 M2-10/M2-21 等既有场景同一取证手法），首次命中的时刻即
//      「缓存事件上屏」。
//
// 「冷启动」测量方法（真实浏览器计时，不依赖阈值门禁，故不苛求绝对精确）：
//   阶段一（预置，不计入任何计时）：导航到 preview 服务的 '/'，拦截跨源请求（避免真实网络
//     访问 USGS/EONET/GDACS/LL2 导致耗时波动/CI 环境访问外网失败——量测对象是启动/渲染
//     耗时，不是网络耗时），随后直接对该源的真实 IndexedDB（EventCache 实际读写的同一
//     DB/store，src/data/cache.ts 的 DB_NAME='world_tunnel'/STORE_NAME='events'/
//     keyPath='id'，字段契约=GeoEvent 铺平 + lastSeen）写入三条「上次会话遗留」的事件
//     记录——直接用浏览器原生 indexedDB API 写入，不 import src/ 模块（e2e 不可行），
//     字段/DB 结构照抄 cache.ts 的落盘契约，做的是数据预置而非移植被测逻辑。
//   阶段二（计时起点）：`page.reload()`——触发一次真实的整页重新加载/重新执行 App 启动
//     路径（createDataLayer().start() → cache.load()→store.load() → scheduler.start()，
//     与真实「重启 App、读到上次缓存」语义一致，SPEC-3.11）。从 reload 调用前记录 t0。
//   帧率基线：可交互地球就绪后，在页面内用 requestAnimationFrame 连续采样约 1s 内的帧
//   时间戳，计算均值 fps = 帧数 / 经过秒数（不依赖调试钩子）。
//
// 已知测量口径限制（如实记录，不隐藏）：preview 服务的静态文件位于本机磁盘（无真实网络
// 延迟/CDN），也非「中端手机」；SPEC-3.10 明示验收环境/方法留待 M5，本场景数值仅作 M2
// 基线参考，不作为达标判据。

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PREVIEW_PORT = 4362 // 避开 dev server 的 5173（vite.config.ts strictPort）与 vite preview 默认 4173，降低本机并存冲突概率
const PREVIEW_BASE_URL = `http://localhost:${PREVIEW_PORT}`

const DB_NAME = 'world_tunnel'
const DB_VERSION = 1
const STORE_NAME = 'events'

const DEG = Math.PI / 180
const HALF_FOV_Y = 22.5 * DEG // SPEC-3.1 fov 45°（垂直）

// 已知 lat/lon → 屏幕像素（仅用于「去哪找标记」，不构成断言期望值本身）。SPEC-3.1 默认相机
// (0,0,3.2) 看向球心、上方向 +Y；SPEC-6.2 lat/lon → 模型空间坐标。与
// e2e/marker-breathing-transition.spec.ts 同一公式（该文件同款注释已详述推导，不重复）。
function projectLatLon(latDeg: number, lonDeg: number, width: number, height: number) {
  const lat = latDeg * DEG
  const lon = lonDeg * DEG
  const px = Math.cos(lat) * Math.sin(lon)
  const py = Math.sin(lat)
  const pz = Math.cos(lat) * Math.cos(lon)
  const negCamZ = -(pz - 3.2)
  const aspect = width / height
  const ndcX = px / (negCamZ * Math.tan(HALF_FOV_Y) * aspect)
  const ndcY = py / (negCamZ * Math.tan(HALF_FOV_Y))
  return { x: ((ndcX + 1) / 2) * width, y: ((1 - ndcY) / 2) * height }
}

function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff]
}

// 三枚种子标记：坐标沿用 e2e/marker-breathing-transition.spec.ts 已验证「前半球、投影
// 互不重叠」的三点（KEEP/OLD/NEW 原始 lat/lon），各配一个 SPEC-3.7 分类色，供冷启动后
// 黑盒像素识别。
const SEED_A = { id: 'usgs:seed-1', lat: 20, lon: -30, category: 'news' as const, hex: 0x40a9ff, source: 'usgs' as const }
const SEED_B = { id: 'eonet:seed-2', lat: 20, lon: 30, category: 'disaster' as const, hex: 0xff4d4f, source: 'eonet' as const }
const SEED_C = { id: 'gdacs:seed-3', lat: -25, lon: 0, category: 'humanitarian' as const, hex: 0xffc53d, source: 'gdacs' as const }
const SEEDS = [SEED_A, SEED_B, SEED_C]

interface SeedRecord {
  id: string
  category: 'disaster' | 'conflict' | 'humanitarian' | 'news' | 'launch' | 'flight'
  severity: 1 | 2 | 3
  title: string
  summary: string
  urls: string[]
  lat: number
  lon: number
  ts: number
  source: 'usgs' | 'eonet' | 'gdacs' | 'gdelt' | 'll2' | 'opensky'
  lastSeen: number
}

function makeSeedRecords(now: number): SeedRecord[] {
  // lastSeen 取当前时刻（新鲜，不落入任何过期窗边界情形，排除清扫/过期语义对本场景计时
  // 判据的干扰——那是 M2-02/M2-09/M2-20 的判据范围）。
  return SEEDS.map((s) => ({
    id: s.id,
    category: s.category,
    severity: 3 as const, // sev3：基础尺寸最大、光环幅度最大，像素识别命中更稳（不影响量测对象本身）
    title: s.id,
    summary: '',
    urls: [`https://example.com/${s.id}`],
    lat: s.lat,
    lon: s.lon,
    ts: now,
    source: s.source,
    lastSeen: now,
  }))
}

/** 拦截跨源请求：只放行 preview 服务自身，避免真实调用外部数据源 API 造成的耗时波动/
 * CI 无外网访问失败——本场景量测对象是启动/渲染耗时，不是网络耗时。与
 * e2e/marker-breathing-transition.spec.ts 的 goToIdleGlobe 同一手法。 */
async function blockExternalNetwork(page: Page) {
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return route.continue()
    return route.abort()
  })
}

/** 直接用浏览器原生 indexedDB API 写入种子记录——DB 结构/字段契约照抄
 * src/data/cache.ts（EventCache）的落盘形态，不 import src/ 模块、不移植被测启动逻辑。 */
async function seedCache(page: Page, records: SeedRecord[]) {
  await page.evaluate(
    ({ dbName, dbVersion, storeName, records }) => {
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.open(dbName, dbVersion)
        req.onupgradeneeded = () => {
          const db = req.result
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' })
          }
        }
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction(storeName, 'readwrite')
          const store = tx.objectStore(storeName)
          for (const r of records) store.put(r)
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        }
        req.onerror = () => reject(req.error)
      })
    },
    { dbName: DB_NAME, dbVersion: DB_VERSION, storeName: STORE_NAME, records },
  )
}

/** 页面内用 requestAnimationFrame 连续采样约 durationMs 内的帧时间戳，返回帧数与均值 fps。 */
async function sampleFrameRate(page: Page, durationMs: number): Promise<{ frames: number; fps: number }> {
  return page.evaluate((duration) => {
    return new Promise<{ frames: number; fps: number }>((resolve) => {
      let frames = 0
      let start = -1
      function tick(t: number) {
        if (start < 0) start = t
        frames += 1
        const elapsed = t - start
        if (elapsed >= duration) {
          resolve({ frames, fps: (frames / elapsed) * 1000 })
          return
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
  }, durationMs)
}

/** 生产构建供 preview 服务：显式设 NODE_ENV=production——vitest/playwright 自身进程可能
 * 继承非 production 的 NODE_ENV，子进程默认继承会使依赖 process.env.NODE_ENV 判断的
 * 死代码消除失效（与 tests/build-budget.test.ts 头注记录的同一坑，此处一并规避），
 * 也正是本文件依赖的「production 构建下 React 不做 StrictMode 双调用」得以成立的前提。 */
function buildForPreview(): void {
  execSync('npm run build', {
    cwd: ROOT,
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'production' },
  })
}

async function waitForHttpOk(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // 服务尚未就绪，继续轮询
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`preview 服务器在 ${timeoutMs}ms 内未就绪: ${url}`)
}

/** 跨平台终止子进程树：`vite preview` 经 `npm run`/`npx` 派生，Windows 下直接 kill() 可能
 * 只终止外层壳进程而遗留内层 vite server 进程；用 taskkill /T 终止整棵进程树，非 Windows
 * 平台用普通 kill。 */
function killProcessTree(child: ChildProcess): void {
  if (child.pid === undefined) return
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'])
  } else {
    child.kill()
  }
}

let previewProcess: ChildProcess | null = null

test.beforeAll(async () => {
  buildForPreview()
  // 单字符串命令 + shell:true（而非数组参数 + shell:true）：Node 对后者发 DEP0190 弃用警告
  // （参数在 shell:true 下不转义，仅拼接）；本命令无用户输入拼接，风险不适用，但仍改用
  // 单字符串形式规避告警噪声。
  previewProcess = spawn(
    `npx vite preview --port ${PREVIEW_PORT} --strictPort`,
    { cwd: ROOT, shell: true, stdio: 'pipe' },
  )
  await waitForHttpOk(PREVIEW_BASE_URL, 20_000)
})

test.afterAll(() => {
  if (previewProcess) killProcessTree(previewProcess)
})

test('冷启动→可交互地球 / 缓存事件上屏 / 帧率——三项基线数值量测（SPEC-3.10/3.8/3.11，不做门禁）', async ({
  browser,
}) => {
  test.setTimeout(60_000)

  const context = await browser.newContext({ baseURL: PREVIEW_BASE_URL })
  const page = await context.newPage()
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))

  try {
    // ---- 阶段一：预置（不计入任何计时）----
    await blockExternalNetwork(page)
    await page.goto('/')
    await expect(page.locator('#globe-container canvas')).toBeVisible()
    await waitNextFrame(page)
    const now = Date.now()
    await seedCache(page, makeSeedRecords(now))

    // ---- 阶段二：计时起点——reload 触发真实冷启动路径（SPEC-3.11 数据侧顺序）----
    const t0 = Date.now()
    const reloadPromise = page.reload()

    // 并行轮询「缓存事件上屏」：三枚种子标记中任一分类色像素首次出现于其投影位置周边
    // （最长等 10s，超时判为量测异常而非门禁失败——若真发生超时，说明启动路径本身有
    // 问题，应转 doc/bugs.md 登记，而非在本场景放宽超时掩盖）。
    let cacheUpsertMs = -1
    const pollDeadline = Date.now() + 10_000
    const HALF = 60 // 采样窗口半径（设备像素），与 marker-breathing-transition.spec.ts 同量级
    while (cacheUpsertMs < 0 && Date.now() < pollDeadline) {
      const size = await canvasBufferSize(page).catch(() => ({ width: 0, height: 0 }))
      if (size.width > 0 && size.height > 0) {
        for (const s of SEEDS) {
          const { x, y } = projectLatLon(s.lat, s.lon, size.width, size.height)
          const region = {
            x: Math.max(0, Math.round(x - HALF)),
            y: Math.max(0, Math.round(y - HALF)),
            width: Math.min(size.width, HALF * 2),
            height: Math.min(size.height, HALF * 2),
          }
          const hit = await findColorInRegion(page, region, hexToRgb(s.hex), 20).catch(() => null)
          if (hit) {
            cacheUpsertMs = Date.now() - t0
            break
          }
        }
      }
      if (cacheUpsertMs < 0) await page.waitForTimeout(20)
    }

    await reloadPromise
    await expect(page.locator('#globe-container canvas')).toBeVisible()
    await waitNextFrame(page)
    await waitNextFrame(page)
    const { width, height } = await canvasBufferSize(page)
    const coldStartMs = Date.now() - t0

    // ---- 三项基线数值断言：量测流程可复跑、产出有限非负数值（SPEC-3.10 明示 M2 只建基线）----
    expect(pageErrors, `preview 页面出现未捕获异常: ${pageErrors.join('; ')}`).toEqual([])
    expect(width).toBeGreaterThan(0)
    expect(height).toBeGreaterThan(0)
    expect(Number.isFinite(coldStartMs)).toBe(true)
    expect(coldStartMs).toBeGreaterThan(0)

    expect(cacheUpsertMs, '缓存事件上屏轮询超时——三枚种子标记分类色像素在 10s 内均未出现').toBeGreaterThan(0)
    expect(Number.isFinite(cacheUpsertMs)).toBe(true)

    // ---- 帧率基线：可交互地球就绪后连续采样约 1s ----
    const { frames, fps } = await sampleFrameRate(page, 1000)
    expect(frames).toBeGreaterThan(0)
    expect(Number.isFinite(fps)).toBe(true)
    expect(fps).toBeGreaterThan(0)

    console.log(
      `[M2-24 性能基线] 冷启动→可交互地球=${coldStartMs}ms, 缓存事件上屏=${cacheUpsertMs}ms, ` +
        `帧率均值=${fps.toFixed(1)}fps（采样帧数=${frames}/约1000ms；preview 服务器=${PREVIEW_BASE_URL}）`,
    )
  } finally {
    await context.close()
  }
})
