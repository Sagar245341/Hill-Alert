import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  use: { baseURL: 'http://localhost:5174', browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
  webServer: [
    { command: 'npm run dev --prefix backend', env: { PORT: '3100' }, url: 'http://127.0.0.1:3100/api/health', reuseExistingServer: false },
    { command: 'npm run dev --prefix frontend -- --port 5174', env: { BACKEND_URL: 'http://127.0.0.1:3100' }, url: 'http://localhost:5174', reuseExistingServer: false },
  ],
})
