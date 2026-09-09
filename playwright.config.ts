import { defineConfig, devices } from '@playwright/test';

// Local verification harness for the live-classroom board changes.
// Assumes: web on :3001, API on :3000 (Redis + MySQL up), seeded users.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  // Log the seed users in once and reuse their sessions (see global-setup).
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Default identity for single-page tests: the instructor (can draw).
    storageState: 'e2e/.auth/instructor.json',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Safari's engine — reproduces Safari-only bugs (e.g. stricter Date parsing).
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
