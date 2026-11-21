// The one Cal happy path (e2e/cal.spec.ts), run by hand against a deployed site. It uses the installed Chrome.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  retries: 0,
  workers: 1,
  reporter: "line",
  outputDir: process.env.E2E_OUTPUT ?? "test-results",
  use: { baseURL: process.env.E2E_BASE_URL, channel: "chrome", headless: true, timezoneId: "America/New_York", locale: "en-US" },
});
