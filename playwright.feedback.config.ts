import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const localHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1", "0.0.0.0"]);

if (!localHosts.has(new URL(baseURL).hostname)) {
  throw new Error("Feedback release E2E can only target a local app URL");
}

export default defineConfig({
  testDir: "./e2e",
  testMatch: "feedback-releases.spec.ts",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    channel: "chrome",
    baseURL,
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
    trace: "retain-on-failure",
  },
});
