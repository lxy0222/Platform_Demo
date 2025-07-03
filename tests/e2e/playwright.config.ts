import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './',
  timeout: 90 * 1000,
  retries: 2,
  workers: 1,
  reporter: [["list"], ["@midscene/web/playwright-reporter", { type: "merged" }]],

  use: {
    headless: false,
    viewport: { width: 1280, height: 960 },
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});