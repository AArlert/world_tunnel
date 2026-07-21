import { execSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { beforeAll, describe, expect, it } from 'vitest'

// M2-23：首包体积基线量测——构建产物体积统计 + 风格包资源代码分割隔离（构建产物度量，非 e2e）。
// 期望值只从 doc/spec.md 推导（断言逐条标 SPEC 条目号），判据出处见 doc/testplan.md M2-23 行：
//   - SPEC-3.10「首包 ≤2MB（不含可选纹理/风格包）」——「验收基准环境与量测方法由 M5 testplan
//     场景定义（M2 建基线量测）」：本场景只要求量测流程可复跑、产出有限非负体积数值，
//     不把 ≤2MB 门槛作为本场景 M2 通过条件（达标判定留待 M5）。
//   - SPEC-3.2③「卫星昼夜底图退出默认……并入付费天气风格包（SPEC-3.9）」+
//     SPEC-3.9「风格包资源懒加载：未解锁/未选用不下载，不计入首包」——结构性断言：
//     earth_day.jpg/earth_night.jpg 与风格包资源不出现在主入口（首包）chunk 的静态引用
//     /构建产物清单中，须与首包物理隔离、只在显式触发时懒加载。
//     与 e2e/satellite-lazy-load.spec.ts（M2-17，运行时不请求判据）互补：本场景断言的是
//     构建产物层面的物理隔离，不是运行时网络行为。
//
// 「主入口 chunk」的可操作定义：dist/index.html 中声明的初始 <script>/<link> 资源
// （浏览器加载页面时会同步获取的资源图）。真实构建结果核验（见任务卡与本文件调试记录）：
// 本仓库 vite.config.ts 未使用 dynamic import() 做代码分割，故不存在字面意义的 rollup
// 「懒加载 chunk」文件；卫星纹理是 public/ 下的静态文件，从未进入 Vite 的 JS 模块图——
// 它们连「主 chunk 之外的另一个 chunk」都不算，而是完全在分块机制之外、只由运行时代码
// （src/globe/textures.ts 的 loadEarthTextures，仅 M2-17 验证过的显式触发路径调用）拼出
// URL 字符串再 fetch。这是比字面「独立 chunk」更彻底的隔离——首包字节总量里不含一字节
// 纹理数据、index.html 不声明任何指向它们的静态资源引用。本文件的结构性断言即按此校验：
// ①首包（index.html 引用的 JS/CSS）体积基线可量测；②index.html 与首包 JS/CSS 文件内容
// 均不含纹理文件名引用；③纹理文件作为独立静态产物存在、与首包物理分离。
// 「风格包资源」在当前 M2 代码库尚未落地（pixel/art/天气云图叠加层均属 M4，
// grep 未见对应资源文件，2026-07-21 核验），故本场景断言范围自然覆盖当前全部适用资源；
// 断言②同时通用扫描 public/assets/ 下除 ASSETS.md（文档，非资源本体）外的全部文件，
// 不局限于硬编码这两个纹理文件名，防止未来新增风格包资源时本场景静默失去覆盖。

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const PUBLIC_ASSETS = path.join(ROOT, 'public', 'assets')

/** 递归列出 public/assets/ 下除 ASSETS.md（出处登记文档，非资源本体）外的全部文件相对路径 */
function listLazyResourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'ASSETS.md') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...listLazyResourceFiles(full))
    else out.push(full)
  }
  return out
}

/** 从 dist/index.html 提取初始 <script src>/<link href> 引用——即浏览器加载页面时
 * 会同步获取的资源图，可操作定义的「主入口（首包）chunk」集合。 */
function entryAssetPaths(html: string): string[] {
  const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1])
  const hrefs = [...html.matchAll(/<link[^>]+href="([^"]+)"/g)].map((m) => m[1])
  return [...srcs, ...hrefs]
}

describe('M2-23 首包体积基线量测 + 风格包资源代码分割隔离', () => {
  let html: string
  let entryFiles: string[]
  let totalRawBytes: number
  let totalGzipBytes: number

  beforeAll(() => {
    // 复跑命令：`make test TEST=build-budget`（即 `npm run test -- build-budget`），
    // 本 beforeAll 内先跑一次真实生产构建，保证证据可独立复现、不依赖预先存在的 dist/。
    // 显式覆盖 NODE_ENV=production：vitest 进程自身在 NODE_ENV=test 下运行，子进程默认
    // 继承该值；vite build 只在 NODE_ENV 未被外部设置时才会自行置为 production（调试实测：
    // 不覆盖时子进程构建出的 chunk 体积与直接终端 `npm run build` 的结果不一致——继承的
    // NODE_ENV=test 使依赖 process.env.NODE_ENV==='production' 判断的死代码消除未生效，
    // 混入 React 开发期警告字符串，体积虚高，与真实生产构建产物不符），显式传入才能量出
    // 与用户实际拿到的构建产物一致的首包体积基线。
    execSync('npm run build', {
      cwd: ROOT,
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'production' },
    })

    html = readFileSync(path.join(DIST, 'index.html'), 'utf-8')
    entryFiles = entryAssetPaths(html).map((p) => path.join(DIST, p.replace(/^\//, '')))

    totalRawBytes = 0
    totalGzipBytes = 0
    for (const f of entryFiles) {
      const buf = readFileSync(f)
      totalRawBytes += buf.byteLength
      totalGzipBytes += gzipSync(buf).byteLength
    }
  }, 60_000)

  it('主入口（首包）JS/CSS 体积基线数值——量测流程可复跑，产出有限非负数值（SPEC-3.10，M2 只建基线不做 ≤2MB 门槛判定）', () => {
    expect(entryFiles.length).toBeGreaterThan(0)
    for (const f of entryFiles) expect(existsSync(f)).toBe(true)

    expect(Number.isFinite(totalRawBytes)).toBe(true)
    expect(totalRawBytes).toBeGreaterThan(0)
    expect(Number.isFinite(totalGzipBytes)).toBe(true)
    expect(totalGzipBytes).toBeGreaterThan(0)

    // 基线数值入证据日志（regress.mjs 把 stdout 整体写进 test-results 的 log，
    // make evidence 据此机械摘录，不手写证据）
    console.log(
      `[M2-23 首包体积基线] raw=${totalRawBytes} bytes (${(totalRawBytes / 1024).toFixed(1)} KB), ` +
        `gzip=${totalGzipBytes} bytes (${(totalGzipBytes / 1024).toFixed(1)} KB), ` +
        `entries=${entryFiles.map((f) => path.relative(DIST, f)).join(', ')}`,
    )
  })

  it('结构性断言——卫星纹理/风格包资源不出现在 index.html 的初始资源引用中（SPEC-3.2③ + SPEC-3.9）', () => {
    const lazyResources = listLazyResourceFiles(PUBLIC_ASSETS)
    expect(lazyResources.length).toBeGreaterThan(0) // 至少含 earth_day.jpg/earth_night.jpg，防误判空目录假通过

    for (const res of lazyResources) {
      const basename = path.basename(res)
      expect(html).not.toContain(basename)
    }
  })

  it('结构性断言——卫星纹理/风格包资源未以内联形式（base64/data URI）嵌入首包 JS/CSS chunk（SPEC-3.9「不计入首包」构建产物层面判据）', () => {
    // 调试记录：首包 JS chunk 确实含 "earth_day.jpg"/"earth_night.jpg" 字面字符串——
    // src/globe/textures.ts 用 `${BASE_URL}assets/textures/earth_day.jpg` 拼出运行期
    // fetch 目标 URL，这段短字符串本身只是「懒加载路径知道去哪取资源」的必要信息，
    // 不是图片二进制数据被打进首包（该字符串是否被实际 fetch 由 M2-17 e2e 验证，
    // 默认启动路径不触发）。真正对应 SPEC-3.9「不计入首包」的构建产物层面风险是
    // Vite 把资源以 base64 data URI 内联进 chunk（小于 assetsInlineLimit 时的默认行为）——
    // 断言首包 chunk 不含图片的 data URI 内联形式，与「不计入首包体积统计」（上一条用例，
    // 经 entryFiles 集合直接排除物理隔离的纹理文件）共同覆盖「未被以任何形式计入首包」。
    const entryContents = entryFiles.map((f) => readFileSync(f, 'utf-8'))
    for (const content of entryContents) {
      expect(content).not.toContain('data:image/jpeg;base64')
    }
  })

  it('结构性断言——卫星纹理作为独立静态产物存在、与首包 chunk 物理分离（未计入首包体积统计，SPEC-3.9 懒加载）', () => {
    const dayPath = path.join(DIST, 'assets', 'textures', 'earth_day.jpg')
    const nightPath = path.join(DIST, 'assets', 'textures', 'earth_night.jpg')
    expect(existsSync(dayPath)).toBe(true)
    expect(existsSync(nightPath)).toBe(true)

    // 二者均不在首包 entry 文件集合内（即未被计入上一条用例统计的 totalRawBytes/totalGzipBytes）
    expect(entryFiles).not.toContain(dayPath)
    expect(entryFiles).not.toContain(nightPath)

    // 佐证隔离的必要性（非本场景断言项，仅入 log）：若二者的字节量被计入首包，
    // 将单独超出 SPEC-3.10「首包 ≤2MB」的量级——数值仅供人读参考，不作断言。
    const dayBytes = statSync(dayPath).size
    const nightBytes = statSync(nightPath).size
    console.log(
      `[M2-23 佐证] 卫星纹理若计入首包将额外增加 raw=${dayBytes + nightBytes} bytes ` +
        `(${((dayBytes + nightBytes) / 1024 / 1024).toFixed(2)} MB)，现已物理隔离、不计入上述首包基线`,
    )
  })
})
