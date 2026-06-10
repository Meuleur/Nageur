import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration. The CH2 auth flows (sign-up + verification,
 * login + 2FA gating, password reset, lockout) live in tests/e2e.
 * Prerequisites: `pnpm supabase:start` (full local stack: GoTrue + Mailpit)
 * and `pnpm exec playwright install` once. The dev server is started (or
 * reused) automatically; e-mails are read from the local Mailpit inbox.
 */
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
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
