import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  // 不用默认 test-results/（regress.mjs 的 log 也在那里，Playwright 启动会清空 outputDir）
  outputDir: 'test-results/e2e-artifacts',
  use: {
    baseURL: 'http://localhost:5173',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    // 端口由 vite.config.ts 的 strictPort 钉死；CI 上必须新起 server 保证证据针对当前代码
    reuseExistingServer: !process.env.CI,
  },
})
