import { defineConfig, devices } from "@playwright/test";

/**
 * Suite E2E du MODE DÉMO (branche demo UNIQUEMENT) : le serveur tourne avec
 * DEMO_MODE=true + EMAIL_DRIVER=demo + LLM_DRIVER=simule — la configuration
 * exacte du déploiement de démonstration client. Suite séparée de la
 * standard (playwright.config.ts l'ignore) : les deux modes exigent des
 * serveurs aux variables d'environnement incompatibles.
 * Prérequis : `pnpm supabase:start`, et AUCUN serveur dev déjà lancé sur
 * :3000 (reuseExistingServer=false — un serveur réutilisé n'aurait pas
 * DEMO_MODE). Lancement : `pnpm test:e2e:demo`.
 */
export default defineConfig({
  testDir: "tests/e2e/mode-demo",
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
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    env: {
      ...(process.env as Record<string, string>),
      DEMO_MODE: "true",
      EMAIL_DRIVER: "demo",
      LLM_DRIVER: "simule",
    },
  },
});
