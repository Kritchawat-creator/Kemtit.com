import { expect, test, type Locator, type Page } from "@playwright/test";

import { onboardNewUser } from "./helpers";

const viewportWidths = [1151, 1440, 1800, 1024, 768, 390, 360];

async function openAndCloseQuickCapture(page: Page, opener: Locator) {
  await opener.click();

  const dialog = page.getByRole("dialog", { name: "บันทึกด่วน" });
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel("คุณอยากเพิ่มอะไร")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page).not.toHaveURL(/capture=1/);
}

async function openAndCloseMobileDrawer(trigger: Locator, page: Page) {
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await trigger.click();

  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("navigation", { name: "เมนูหลัก" })).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await drawer.getByRole("button", { name: "ปิด" }).click();
  await expect(drawer).toHaveCount(0);
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
}

test("Sidebar stays contained and navigation works across responsive widths", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "This test sets its own viewport widths.");
  test.setTimeout(120_000);

  await onboardNewUser(page, "sidebar-layout");
  await page.goto("/today");

  const sidebar = page.locator("aside").first();
  const sidebarCapture = sidebar.getByRole("button", { name: "เปิดเมนูเพิ่ม", exact: true });

  for (const width of viewportWidths) {
    await page.setViewportSize({ width, height: 900 });

    if (width >= 1151) {
      await expect(sidebar).toBeVisible();

      const expand = sidebar.getByRole("button", { name: "ขยายเมนู", exact: true });
      if (await expand.count()) await expand.click();

      await expect(async () => {
        const geometry = await sidebarCapture.evaluate((button) => {
          const buttonRect = button.getBoundingClientRect();
          const parentRect = button.parentElement?.getBoundingClientRect();
          const sidebarRect = button.closest("aside")?.getBoundingClientRect();

          return {
            buttonLeft: buttonRect.left,
            buttonRight: buttonRect.right,
            buttonWidth: buttonRect.width,
            parentLeft: parentRect?.left ?? 0,
            parentRight: parentRect?.right ?? 0,
            parentWidth: parentRect?.width ?? 0,
            sidebarRight: sidebarRect?.right ?? 0,
            documentWidth: document.documentElement.scrollWidth,
            viewportWidth: window.innerWidth,
          };
        });

        expect(geometry.viewportWidth).toBe(width);
        expect(
          geometry.buttonWidth,
          `sidebar button at ${width}px: ${JSON.stringify(geometry)}`,
        ).toBeGreaterThan(0);
        expect(
          geometry.buttonLeft,
          `button begins inside footer at ${width}px`,
        ).toBeGreaterThanOrEqual(geometry.parentLeft - 1);
        expect(geometry.buttonRight, `button ends inside footer at ${width}px`).toBeLessThanOrEqual(
          geometry.parentRight + 1,
        );
        expect(
          geometry.buttonRight,
          `button ends inside sidebar at ${width}px`,
        ).toBeLessThanOrEqual(geometry.sidebarRight + 1);
        expect(
          geometry.documentWidth,
          `page has no horizontal overflow at ${width}px`,
        ).toBeLessThanOrEqual(geometry.viewportWidth + 1);
      }).toPass({ timeout: 2_000, intervals: [50, 100, 200] });

      if (width === 1151 || width === 1800) {
        await page.screenshot({
          path: testInfo.outputPath(`sidebar-layout-${width}px.png`),
          fullPage: true,
        });
      }

      if (width === 1800) {
        await openAndCloseQuickCapture(page, sidebarCapture);

        await sidebar.getByRole("button", { name: "พับเมนู", exact: true }).click();
        const expand = sidebar.getByRole("button", { name: "ขยายเมนู", exact: true });
        await expect(expand).toHaveAttribute("aria-expanded", "false");
        await expect(sidebarCapture).toHaveCount(0);
        await expect(async () => {
          const sidebarWidth = await sidebar.evaluate(
            (element) => element.getBoundingClientRect().width,
          );
          expect(sidebarWidth).toBeCloseTo(72, 0);
        }).toPass({ timeout: 2_000, intervals: [50, 100, 200] });

        await openAndCloseQuickCapture(
          page,
          page.getByRole("banner").getByRole("button", { name: "เปิดเมนูเพิ่ม" }),
        );
        await expand.click();
        await expect(sidebar.getByRole("button", { name: "พับเมนู", exact: true })).toHaveAttribute(
          "aria-expanded",
          "true",
        );
      }
    } else {
      await expect(sidebar).toBeHidden();
      await expect(
        page.getByRole("banner").getByRole("button", { name: "เมนู", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("banner").getByRole("button", { name: "เปิดเมนูเพิ่ม" }),
      ).toBeVisible();

      await expect(async () => {
        const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(pageWidth, `page has no horizontal overflow at ${width}px`).toBeLessThanOrEqual(
          width + 1,
        );
      }).toPass({ timeout: 2_000, intervals: [50, 100, 200] });

      if (width === 390) {
        await openAndCloseMobileDrawer(page.locator('header button[aria-label="เมนู"]'), page);
        await openAndCloseMobileDrawer(
          page.locator('nav[aria-label="เมนูหลัก"] button[aria-label="เมนู"]'),
          page,
        );
        await openAndCloseQuickCapture(
          page,
          page.getByRole("banner").getByRole("button", { name: "เปิดเมนูเพิ่ม" }),
        );
        await openAndCloseQuickCapture(
          page,
          page.getByRole("navigation", { name: "เมนูหลัก" }).getByRole("button", {
            name: "เปิดเมนูเพิ่ม",
          }),
        );
      }
    }
  }
});
