import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { signInWithOtp, uniqueEmail } from "./helpers";

const ROLE_OPTIONS = [
  { code: "employee", pickerName: "พนักงาน", guideName: "พนักงาน" },
  { code: "seller", pickerName: "ผู้ขาย / ร้านค้า", guideName: "ผู้ขายหรือร้านค้า" },
  { code: "student", pickerName: "นักเรียน / นักศึกษา", guideName: "นักเรียนหรือนักศึกษา" },
  { code: "freelancer", pickerName: "ฟรีแลนซ์", guideName: "ฟรีแลนซ์" },
] as const;

const PERIOD_NAMES = {
  year: "ปี",
  month: "เดือน",
  week: "สัปดาห์",
  day: "วัน",
} as const;

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
] as const;

function todayInBangkok(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const dateParts = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return dateParts.year + "-" + dateParts.month + "-" + dateParts.day;
}

async function onboardAsRole(
  page: Page,
  role: (typeof ROLE_OPTIONS)[number],
): Promise<void> {
  await signInWithOtp(page, uniqueEmail("workflow-" + role.code));
  await expect(page).toHaveURL(/\/onboarding\/persona/);

  await page.getByText(role.pickerName, { exact: true }).click();
  await page.getByRole("button", { name: "เลือกบทบาทนี้" }).click();
  await expect(page).toHaveURL(/\/onboarding\/focus/, { timeout: 15_000 });
  await page.getByText("งาน", { exact: true }).first().click();
  await page.getByRole("button", { name: "เตรียมพื้นที่เริ่มต้น" }).click();
  await expect(page).toHaveURL(/\/onboarding\/starter/, { timeout: 15_000 });
  await page.getByRole("button", { name: "ไปหน้าวันนี้" }).click();
  await expect(page).toHaveURL(/\/today/, { timeout: 20_000 });
}

async function assertGuideAndCapture(
  page: Page,
  testInfo: TestInfo,
  role: (typeof ROLE_OPTIONS)[number],
  horizon: keyof typeof PERIOD_NAMES,
  selectedDate: string,
  viewport: (typeof VIEWPORTS)[number],
): Promise<void> {
  await page.setViewportSize(viewport);
  const path =
    horizon === "day"
      ? "/today"
      : "/plan?view=" + horizon + "&date=" + selectedDate;
  await page.goto(path);

  const guide = page.getByRole("region", { name: "ขั้นตอนการใช้งาน" });
  await expect(guide).toBeVisible();
  await expect(guide).toContainText(role.guideName);

  const navigation = guide.getByRole("navigation", { name: "ช่วงเวลาในแผน" });
  const activePeriod = navigation.getByRole("link", { name: PERIOD_NAMES[horizon] });
  await expect(activePeriod).toHaveAttribute("aria-current", "page");

  for (const target of ["year", "month", "week", "day"] as const) {
    const expectedHref =
      target === "day"
        ? horizon === "day"
          ? "/today"
          : "/calendar?view=day&date=" + selectedDate
        : "/plan?view=" + target + "&date=" + selectedDate;
    await expect(
      navigation.getByRole("link", { name: PERIOD_NAMES[target] }),
    ).toHaveAttribute("href", expectedHref);
  }

  const nextAction = guide.getByRole("group", { name: "เริ่มจากข้อนี้" });
  const primaryAction = nextAction.getByRole("link");
  if (horizon === "day") {
    await expect(primaryAction).toHaveAttribute("href", "#today-plan-heading");
    await expect(page.locator("#today-plan-heading")).toBeVisible();
  } else {
    const href = await primaryAction.getAttribute("href");
    expect(href).toBeTruthy();
    if (href?.includes("new=goal")) {
      const actionUrl = new URL(href, "http://localhost:3000");
      expect(actionUrl.pathname).toBe("/plan");
      expect(actionUrl.searchParams.get("view")).toBe(horizon);
      expect(actionUrl.searchParams.get("date")).toBe(selectedDate);
      expect(actionUrl.searchParams.get("periodType")).toBe(horizon);
      expect(actionUrl.searchParams.get("periodStart")).toBeTruthy();
    } else {
      expect(href).toMatch(/^\/goals\/[0-9a-f-]+$/i);
    }
  }

  const details = guide.locator("details");
  expect(await details.evaluate((element) => (element as HTMLDetailsElement).open)).toBe(false);
  const scrollWidth = await page.evaluate(
    () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
  );
  expect(scrollWidth).toBeLessThanOrEqual(viewport.width + 1);

  await guide.screenshot({
    path: testInfo.outputPath(
      "workflow-" + role.code + "-" + horizon + "-" + viewport.width + ".png",
    ),
  });

  await details.locator("summary").click();
  await expect(details.getByRole("listitem")).toHaveCount(3);
}

test.describe("Role and planning horizon workflow guide", () => {
  test.describe.configure({ mode: "serial" });

  for (const role of ROLE_OPTIONS) {
    test(role.code + " sees workflow guidance for every planning horizon", async ({ page }, testInfo) => {
      test.skip(
        testInfo.project.name !== "desktop-chrome",
        "This test captures the four requested viewport sizes directly.",
      );
      test.setTimeout(180_000);
      await onboardAsRole(page, role);

      const selectedDate = todayInBangkok();
      for (const viewport of VIEWPORTS) {
        for (const horizon of ["year", "month", "week", "day"] as const) {
          await assertGuideAndCapture(page, testInfo, role, horizon, selectedDate, viewport);
        }
      }

      await page.setViewportSize(VIEWPORTS[0]);
      await page.goto("/plan?view=year&date=" + selectedDate);
      await page
        .getByRole("navigation", { name: "ช่วงเวลาในแผน" })
        .getByRole("link", { name: PERIOD_NAMES.month })
        .click();
      await expect(page).toHaveURL(
        "/plan?view=month&date=" + selectedDate,
      );
      await page
        .getByRole("navigation", { name: "ช่วงเวลาในแผน" })
        .getByRole("link", { name: PERIOD_NAMES.week })
        .click();
      await expect(page).toHaveURL(
        "/plan?view=week&date=" + selectedDate,
      );
    });
  }
});
