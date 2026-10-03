import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

// Like scripts/record-demo.mjs, BASE_URL points the run at an app that is already up (e.g. Vite on another port).
const BASE_URL = (process.env.BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');
const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: '.',
  outputDir: './test-results',
  timeout: 60_000,
  forbidOnly: isCi,
  workers: 1,
  reporter: isCi ? [['github'], ['list']] : 'list',
  // Same browser setup as scripts/record-demo.mjs: Chromium at a 1920×1080 desktop viewport.
  use: {
    baseURL: BASE_URL,
    browserName: 'chromium',
    viewport: { width: 1920, height: 1080 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    // Polled through Vite's proxy, so the run starts only once both the client and the API answer.
    url: `${BASE_URL}/api/cosmos`,
    reuseExistingServer: !isCi,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
