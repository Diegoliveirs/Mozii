import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  workers: 1, // specs compartilham os 2 usuários E2E fixos — nunca paralelizar
  use: {
    baseURL: 'http://localhost:5173',
    channel: 'msedge',
    viewport: { width: 390, height: 844 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
})
