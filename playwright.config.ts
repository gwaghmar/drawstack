import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "http://localhost:3040",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm --filter @flowchart/web dev",
    url: "http://localhost:3040/api/health",
    // Always start a test server with the env below so admin tests are deterministic.
    // Stop any dev server on :3040 before `pnpm test`, or set PLAYWRIGHT_REUSE_SERVER=1 to reuse.
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
    env: {
      ...process.env,
      // Used by /app/admin E2E: new users with this email get admin. Also set in .env.local when reusing `pnpm dev` (PLAYWRIGHT_REUSE_SERVER=1).
      ADMIN_EMAILS:
        process.env.ADMIN_EMAILS ?? "e2e-admin@example.com",
    },
  },
});
