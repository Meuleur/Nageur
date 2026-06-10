import { defineConfig, devices } from "@playwright/test";

/**
 * Base Playwright configuration (CH0) — no scenario yet.
 * E2E scenarios for the critical flows (sign-up + 2FA, generation,
 * coach validation cycle) arrive with their respective chantiers (D2).
 * Run with `pnpm test:e2e` (requires `pnpm exec playwright install` once).
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    // Mobile-first charte (B4): test desktop and mobile viewports.
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
