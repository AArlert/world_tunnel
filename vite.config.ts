/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    // playwright.config.ts 的 baseURL/webServer 钉在 5173；被占用时宁可报错也不漂移到 5174
    port: 5173,
    strictPort: true,
  },
  test: {
    // 单测只认 tests/；e2e/ 归 Playwright
    include: ['tests/**/*.test.ts'],
    // 显式钉住 reporter：vitest 在非 TTY（如 scripts/regress.mjs 经 spawnSync 管道捕获
    // stdout）下会自动切换到不回显 console.log 的精简 reporter，导致测试内 console.log
    // 打印的基线数值（如 M2-23 首包体积基线）不进入 regress.mjs 产出的 log、进而不进
    // make evidence 机械摘录的证据文件。固定用 'default' reporter，使 console 输出与
    // 交互终端下一致、不受管道捕获影响（调试实测确认该差异，见 tests/build-budget.test.ts）。
    reporters: ['default'],
  },
})
