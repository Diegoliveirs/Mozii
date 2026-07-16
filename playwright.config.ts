import { defineConfig } from '@playwright/test'

// BASE_URL aponta os testes para outro ambiente (ex.: produção) sem subir o dev server
const baseURL = process.env.BASE_URL ?? 'http://localhost:5173'

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  workers: 1, // specs compartilham os 2 usuários E2E fixos — nunca paralelizar
  use: {
    baseURL,
    channel: 'msedge',
    viewport: { width: 390, height: 844 },
    screenshot: 'only-on-failure',
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
      },
})
