import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against a running app and a real backend. Nothing here is
 * mocked: start the backend and `npm run dev`, then `npm run test:e2e`.
 * Accounts come from the environment (see e2e/README.md); without them the
 * tests are skipped rather than failed.
 */
export default defineConfig({
  testDir: "e2e",
  // The tests share accounts and walk plans through the review queue.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
