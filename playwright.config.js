import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5320/', channel: process.env.CI ? undefined : 'msedge', viewport: { width: 1152, height: 648 } },
  webServer: { command: 'npx vite --port 5320 --strictPort', port: 5320, reuseExistingServer: true },
});
