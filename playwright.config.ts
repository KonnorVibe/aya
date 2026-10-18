import { defineConfig, devices } from '@playwright/test';

// WebKit with an iPhone profile is the real target (CI installs it). For a quick local run without
// a WebKit download, set E2E_CHROMIUM to a Chromium executable.
const chromium = process.env.E2E_CHROMIUM;

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    ...(chromium
      ? { ...devices['Pixel 7'], browserName: 'chromium' as const, launchOptions: { executablePath: chromium, args: ['--no-sandbox'] } }
      : { ...devices['iPhone 13'], browserName: 'webkit' as const }),
    acceptDownloads: true,
  },
  webServer: {
    command: 'npm run build && npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    timeout: 180_000,
    reuseExistingServer: true,
  },
});
