import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PREVIEW_URL;
if (!baseURL) throw new Error('PREVIEW_URL is not set');

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: true,
  retries: 0,
  reporter: [
    ['list'],
    ['junit', { outputFile: 'reports/e2e-junit.xml' }],
    ['json', { outputFile: 'reports/e2e.json' }],
  ],
  use: { baseURL, trace: 'off', screenshot: 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
