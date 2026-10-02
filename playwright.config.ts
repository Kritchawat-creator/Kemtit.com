import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright — E2E ตาม Design §15 (onboarding, สร้าง goal, ติ๊ก task, ปฏิทิน, รูปแนบงาน)
 * PORT: ให้รันคู่กับ dev server อื่นได้ (เช่น `PORT=3100 NEXT_PUBLIC_FLAG_UPLOADS=1 pnpm e2e e2e/photos.spec.ts`)
 * CI: job `e2e-uploads` ใน ci.yml รัน photos.spec.ts บน Supabase local (ดู .github/workflows/ci.yml)
 */
const port = process.env.PORT ?? "3000";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
    trace: "on-first-retry",
  },
  projects: [
    // Phase 0 regression matrix: compact / medium / expanded breakpoints.
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    {
      name: "tablet-chrome",
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } },
    },
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `pnpm dev -p ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
