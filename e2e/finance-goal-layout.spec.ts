import { expect, test, type Page } from "@playwright/test";

import { onboardNewUser } from "./helpers";

const viewportWidths = [320, 360, 390, 768, 1024, 1151, 1440, 1800, 2560] as const;

async function ensureExpandedSidebarAt(page: Page, width: number) {
  if (width < 1151) return;

  const sidebar = page.locator("aside").first();
  await expect(sidebar).toBeVisible();
  const expandButton = sidebar.getByRole("button", { name: "ขยายเมนู", exact: true });
  if (await expandButton.count()) await expandButton.click();
  await expect(sidebar.getByRole("button", { name: "พับเมนู", exact: true })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
}

test("Finance goal panels and detail dial stay contained across viewport widths", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "This test sets its own viewport widths.");
  test.setTimeout(180_000);

  await onboardNewUser(page, "finance-goal-layout");
  await page.goto("/finance");
  const starterGuide = page.locator('section[aria-labelledby="finance-starter-heading"]');
  await expect(starterGuide).toBeVisible();
  await expect(starterGuide).toHaveCSS("border-top-left-radius", "14px");

  const goalTitle = "Responsive finance geometry";
  await page.goto("/goals?new=goal&domain=finance&goalKind=metric&unit=THB");
  await expect(page.getByRole("heading", { name: "เพิ่มเป้าหมาย" })).toBeVisible();
  await page.getByLabel("ชื่อเป้าหมาย").fill(goalTitle);
  await page.getByRole("spinbutton", { name: "เป้าตัวเลข" }).fill("50000");
  await page.getByRole("button", { name: "บันทึกเป้าหมาย" }).click();
  await expect(page.getByText("บันทึกเป้าหมายแล้ว")).toBeVisible();

  await page.goto("/finance");
  const financeGoal = page.locator(`section[aria-label="${goalTitle}"]`);
  await expect(financeGoal).toBeVisible();
  const detailHref = await financeGoal.getByRole("link", { name: new RegExp(goalTitle) }).getAttribute("href");
  expect(detailHref).toMatch(/^\/goals\/[0-9a-f-]+$/i);

  for (const width of viewportWidths) {
    await page.setViewportSize({ width, height: 1000 });
    await ensureExpandedSidebarAt(page, width);

    await expect(async () => {
      const financeGeometry = await financeGoal.evaluate((section) => {
        const rect = section.getBoundingClientRect();
        return {
          right: rect.right,
          width: rect.width,
          scrollWidth: section.scrollWidth,
          clientWidth: section.clientWidth,
          radius: getComputedStyle(section).borderTopLeftRadius,
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          sidebarRight: document.querySelector("aside")?.getBoundingClientRect().right ?? 0,
          headerLeft: document.querySelector("header")?.getBoundingClientRect().left ?? 0,
          mainLeft: document.querySelector("main")?.getBoundingClientRect().left ?? 0,
        };
      });

      expect(financeGeometry.radius, `finance panel radius at ${width}px`).toBe("14px");
      expect(financeGeometry.width, `finance panel is visible at ${width}px`).toBeGreaterThan(0);
      expect(financeGeometry.scrollWidth, `finance panel content fits at ${width}px`).toBeLessThanOrEqual(
        financeGeometry.clientWidth + 1,
      );
      expect(financeGeometry.right, `finance panel fits viewport at ${width}px`).toBeLessThanOrEqual(
        financeGeometry.viewportWidth + 1,
      );
      expect(financeGeometry.documentWidth, `finance page has no overflow at ${width}px`).toBeLessThanOrEqual(
        financeGeometry.viewportWidth + 1,
      );
      if (width >= 1151) {
        expect(financeGeometry.headerLeft, `header clears expanded sidebar at ${width}px`).toBeGreaterThanOrEqual(
          financeGeometry.sidebarRight - 1,
        );
        expect(financeGeometry.mainLeft, `main clears expanded sidebar at ${width}px`).toBeGreaterThanOrEqual(
          financeGeometry.sidebarRight - 1,
        );
      }
    }).toPass({ timeout: 2_000, intervals: [50, 100, 200] });

    if (width === 1151) {
      await page.screenshot({ path: testInfo.outputPath("finance-goal-1151.png"), fullPage: true });
    }
  }

  await page.goto(detailHref!);
  await expect(page.getByRole("heading", { name: goalTitle, exact: true })).toBeVisible();
  const goalCard = page.locator('section[aria-labelledby="goal-title"]');

  for (const width of viewportWidths) {
    await page.setViewportSize({ width, height: 1000 });
    await ensureExpandedSidebarAt(page, width);

    await expect(async () => {
      const geometry = await goalCard.evaluate((section) => {
        const dial = section.querySelector<HTMLElement>('[role="progressbar"]');
        const wrapper = dial?.parentElement;
        if (!dial || !wrapper) throw new Error("Goal detail dial geometry is unavailable");

        const dialRect = dial.getBoundingClientRect();
        const wrapperRect = wrapper.getBoundingClientRect();
        return {
          dial: {
            left: dialRect.left,
            right: dialRect.right,
            top: dialRect.top,
            bottom: dialRect.bottom,
            width: dialRect.width,
            height: dialRect.height,
          },
          wrapper: {
            left: wrapperRect.left,
            right: wrapperRect.right,
            top: wrapperRect.top,
            bottom: wrapperRect.bottom,
          },
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          sidebarRight: document.querySelector("aside")?.getBoundingClientRect().right ?? 0,
          headerLeft: document.querySelector("header")?.getBoundingClientRect().left ?? 0,
          mainLeft: document.querySelector("main")?.getBoundingClientRect().left ?? 0,
        };
      });

      expect(geometry.dial.width, `dial is visible at ${width}px`).toBeGreaterThan(0);
      expect(geometry.dial.width, `dial remains usable at ${width}px`).toBeGreaterThanOrEqual(190);
      expect(geometry.dial.width, `dial respects its maximum at ${width}px`).toBeLessThanOrEqual(225);
      expect(Math.abs(geometry.dial.width - geometry.dial.height), `dial stays circular at ${width}px`).toBeLessThanOrEqual(1);
      expect(geometry.dial.left, `dial stays inside its wrapper at ${width}px`).toBeGreaterThanOrEqual(
        geometry.wrapper.left - 1,
      );
      expect(geometry.dial.right, `dial stays inside its wrapper at ${width}px`).toBeLessThanOrEqual(
        geometry.wrapper.right + 1,
      );
      expect(geometry.dial.top, `dial stays inside its wrapper at ${width}px`).toBeGreaterThanOrEqual(
        geometry.wrapper.top - 1,
      );
      expect(geometry.dial.bottom, `dial stays inside its wrapper at ${width}px`).toBeLessThanOrEqual(
        geometry.wrapper.bottom + 1,
      );
      expect(geometry.documentWidth, `goal detail has no overflow at ${width}px`).toBeLessThanOrEqual(
        geometry.viewportWidth + 1,
      );
      if (width >= 1151) {
        expect(geometry.headerLeft, `header clears expanded sidebar at ${width}px`).toBeGreaterThanOrEqual(
          geometry.sidebarRight - 1,
        );
        expect(geometry.mainLeft, `main clears expanded sidebar at ${width}px`).toBeGreaterThanOrEqual(
          geometry.sidebarRight - 1,
        );
      }
    }).toPass({ timeout: 2_000, intervals: [50, 100, 200] });

    if (width === 1151) {
      await page.screenshot({ path: testInfo.outputPath("goal-detail-dial-1151.png"), fullPage: true });
    }
  }
});
