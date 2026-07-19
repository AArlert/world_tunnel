#!/usr/bin/env node
// 统一测试入口：跑 lint / 单测 / e2e，把输出写成带判定尾行的 log（evidence.py 的唯一输入）。
// 判定尾行 "[regress] RESULT: PASS|FAIL (exit N)" 由退出码机械写出，杜绝口头汇报。
// 用 Node 而非 Python 实现：本机 Python 为 PyManager(MSIX 容器)，其子进程看不到
// 真实 AppData 下的 Playwright 浏览器（BUG-001）；Node 是普通进程，无此问题。
// 用法:
//   node scripts/regress.mjs --unit [模式]   # vitest，log: test-results/unit_<模式|all>.log
//   node scripts/regress.mjs --e2e [模式]    # playwright，log: test-results/e2e_<模式|all>.log
//   node scripts/regress.mjs --lint          # eslint + tsc --noEmit，log: test-results/lint.log
//   node scripts/regress.mjs --all           # 三者全跑，另写 test-results/regress_summary.txt
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'test-results')

function nowIso() {
  return new Date().toISOString().slice(0, 19)
}

function runLogged(name, cmds, logPath) {
  mkdirSync(OUT, { recursive: true })
  const lines = ['[regress] cmd: ' + cmds.join(' && '), '[regress] date: ' + nowIso()]
  let code = 0
  for (const cmd of cmds) {
    console.log(`[regress:${name}] ${cmd}`)
    // maxBuffer 默认仅 1MiB：绿色但输出多的套件会被 ENOBUFS 杀掉、status=null 被误判 FAIL
    const p = spawnSync(cmd, { shell: true, cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    lines.push('$ ' + cmd)
    lines.push((p.stdout ?? '').trimEnd())
    if ((p.stderr ?? '').trim()) {
      lines.push('--- stderr ---')
      lines.push(p.stderr.trimEnd())
    }
    if (p.error) {
      lines.push(`[regress] spawn error: ${p.error.message}`)
    }
    if (p.status !== 0) {
      code = p.status ?? 1
      break
    }
  }
  const verdict = code === 0 ? 'PASS' : 'FAIL'
  lines.push(`[regress] RESULT: ${verdict} (exit ${code})`)
  writeFileSync(logPath, lines.join('\n') + '\n', 'utf8')
  console.log(`[regress:${name}] ${verdict}  (log: ${path.relative(ROOT, logPath)})`)
  return code === 0
}

// log 文件名契约：与 scripts/evidence.py 的 sanitize() 必须保持逐字符一致（ASCII \w），
// 一侧改动必须同步另一侧，否则 evidence 找不到 regress 刚写出的 log
function sanitize(pattern) {
  return pattern ? pattern.replace(/[^\w.-]/g, '_') : 'all'
}

function unit(pattern) {
  const cmd = 'npm run test' + (pattern ? ` -- ${pattern}` : '')
  return runLogged('unit', [cmd], path.join(OUT, `unit_${sanitize(pattern)}.log`))
}

function e2e(pattern) {
  const cmd = 'npm run e2e' + (pattern ? ` -- ${pattern}` : '')
  return runLogged('e2e', [cmd], path.join(OUT, `e2e_${sanitize(pattern)}.log`))
}

function lint() {
  return runLogged('lint', ['npm run lint', 'npm run typecheck'], path.join(OUT, 'lint.log'))
}

function regressAll() {
  const results = [
    ['lint', lint(), 'test-results/lint.log'],
    ['unit', unit(''), 'test-results/unit_all.log'],
    ['e2e', e2e(''), 'test-results/e2e_all.log'],
  ]
  const ok = results.every((r) => r[1])
  const lines = ['make regress', '[regress] date: ' + nowIso()]
  for (const [name, passed, log] of results) {
    lines.push(`${name}: ${passed ? 'PASS' : 'FAIL'} (log: ${log})`)
  }
  lines.push(`[regress] RESULT: ${ok ? 'PASS' : 'FAIL'} (exit ${ok ? 0 : 1})`)
  writeFileSync(path.join(OUT, 'regress_summary.txt'), lines.join('\n') + '\n', 'utf8')
  console.log(`[regress] 总判定: ${ok ? 'PASS' : 'FAIL'}`)
  return ok
}

const [mode, arg] = process.argv.slice(2)
let ok
if (mode === '--all') ok = regressAll()
else if (mode === '--lint') ok = lint()
else if (mode === '--unit') ok = unit(arg ?? '')
else if (mode === '--e2e') ok = e2e(arg ?? '')
else {
  console.error('用法: node scripts/regress.mjs --unit|--e2e [模式] | --lint | --all')
  process.exit(2)
}
process.exit(ok ? 0 : 1)
