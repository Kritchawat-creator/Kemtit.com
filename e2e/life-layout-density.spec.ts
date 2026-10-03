import { expect, test } from "@playwright/test";

import { onboardNewUser } from "./helpers";

const viewportWidths = [360, 390, 768, 1024, 1151, 1440, 1800];

test("Life page keeps its empty-goal section compact across viewport widths", async ({ page }, testInfo) => {
  await onboardNewUser(page, "life-layout-density");
  await page.goto("/life");

  const goalsSection = page.locator('section[aria-labelledby="life-goals-heading"]');
  const habitsSection = page.locator('section[aria-labelledby="life-habits-heading"]');
  await expect(page.getByText("ยังไม่มีเป้าหมายชีวิต", { exact: true })).toBeVisible();
  await expect(goalsSection).toBeVisible();
  await expect(habitsSection).toBeVisible();

  for (const width of viewportWidths) {
    await page.setViewportSize({ width, height: 1200 });

    await expect(async () => {
      const goalsBox = await goalsSection.boundingBox();
      const habitsBox = await habitsSection.boundingBox();
      expect(goalsBox, `Life goals section is visible at ${width}px`).not.toBeNull();
      expect(habitsBox, `Life habits section is visible at ${width}px`).not.toBeNull();

      const geometry = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }));

      expect(geometry.documentWidth, `No horizontal overflow at ${width}px`).toBeLessThanOrEqual(
        geometry.viewportWidth,
      );
      expect(
        goalsBox!.height,
        `Empty goals section stays content-sized at ${width}px`,
      ).toBeLessThan(220);
      expect(
        Math.abs(goalsBox!.x - habitsBox!.x),
        `Sections share a left edge at ${width}px`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(goalsBox!.width - habitsBox!.width),
        `Sections use the same full width at ${width}px`,
      ).toBeLessThanOrEqual(1);
      expect(
        habitsBox!.y - (goalsBox!.y + goalsBox!.height),
        `Habits follow the compact empty state at ${width}px`,
      ).toBe(16);
    }).toPass({ timeout: 2_000, intervals: [50, 100, 200] });

    if (width === 1800) {
      await page.screenshot({
        path: testInfo.outputPath("life-layout-density-1800.png"),
        fullPage: true,
      });
    }
  }
});
