import { existsSync, mkdirSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3200";
const parsedBaseURL = new URL(baseURL);
const localHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
if (!localHosts.has(parsedBaseURL.hostname) || parsedBaseURL.port !== "3200") {
  throw new Error("Full-system browser QA can only target a local app on port 3200");
}

const reportDirectory = "docs/qa/full-system-2026-10-08";
mkdirSync(reportDirectory, { recursive: true });

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  testIgnore: [
    "**/prototype.spec.ts",
    "**/qa/localhost-qa.spec.ts",
    "**/line.spec.ts",
    "**/v2-notifications.spec.ts",
  ],
  outputDir: "test-results/full-system-2026-10-08",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: reportDirectory + "/playwright-report.json" }]],
  use: {
    baseURL,
    channel: "chrome",
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"], channel: "chrome" },
    },
    {
      name: "tablet-chrome",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
});
