import { defineConfig } from '@playwright/test';

const channel = process.env.AHA_BROWSER_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined);

export default defineConfig({
  testDir: './tests/browser',
  outputDir: './test-results',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  expect: { timeout: 5000 },
  reporter: 'list',
  use: {
    browserName: 'chromium',
    ...(channel ? { channel } : {}),
    headless: true,
    acceptDownloads: true,
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
  },
});
