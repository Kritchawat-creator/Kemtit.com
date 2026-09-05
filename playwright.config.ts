import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright — E2E 3 flow ตาม Design §15 (onboarding, สร้าง goal, ติ๊ก task) เริ่มเขียนใน M7
 * ยังไม่รันใน CI จนกว่าจะมี flow จริง (POC Decisions M0 ข้อ 7)
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
    trace: "on-first-retry",
  },
  projects: [
    // mobile-first (Design §7.3): รันมือถือก่อน desktop
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
