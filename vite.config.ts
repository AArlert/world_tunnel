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
  },
})
