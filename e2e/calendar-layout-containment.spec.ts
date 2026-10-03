import { expect, test, type Page } from "@playwright/test";

import { onboardNewUser } from "./helpers";

const viewportWidths = [320, 360, 390, 768, 1024, 1151, 1440, 1800];
const calendarViews = ["day", "week", "month"] as const;
const fixtureDate = "2026-10-02";

async function expectCalendarState(page: Page, view: string, date: string) {
  await expect
    .poll(() => {
      const url = new URL(page.url());
      return {
        pathname: url.pathname,
        view: url.searchParams.get("view"),
        date: url.searchParams.get("date"),
      };
    })
    .toEqual({ pathname: "/calendar", view, date });
}

test("Calendar navigation stays contained across viewport widths and views", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "This test sets its own viewport widths.");
  test.setTimeout(180_000);

  await onboardNewUser(page, "calendar-layout");

  const main = page.getByRole("main");
  const sidebar = page.locator("aside").first();

  for (const width of viewportWidths) {
    await page.setViewportSize({ width, height: 900 });

    if (width >= 1151) {
      await expect(sidebar).toBeVisible();

      const expandSidebar = sidebar.getByRole("button", { name: "ขยายเมนู", exact: true });
      if (await expandSidebar.count()) await expandSidebar.click();
      await expect(sidebar.getByRole("button", { name: "พับเมนู", exact: true })).toBeVisible();

      await expect(async () => {
        const geometry = await page.evaluate(() => {
          const aside = document.querySelector("aside");
          const mainElement = document.querySelector("main");
          const sidebarRect = aside?.getBoundingClientRect();
          const mainRect = mainElement?.getBoundingClientRect();

          return {
            sidebarRight: sidebarRect?.right ?? 0,
            mainLeft: mainRect?.left ?? 0,
          };
        });

        expect(geometry.mainLeft).toBeGreaterThanOrEqual(geometry.sidebarRight);
      }).toPass({ timeout: 3_000, intervals: [50, 100, 200] });
    } else {
      await expect(sidebar).toBeHidden();
    }

    for (const view of calendarViews) {
      await page.goto(`/calendar?view=${view}&date=${fixtureDate}`);

      const pageHeader = main.locator("header").first();
      const today = pageHeader.getByRole("link", { name: "วันนี้", exact: true });
      const rangeNav = today.locator("xpath=..");
      const rangeLinks = rangeNav.getByRole("link");
      const previous = rangeNav.locator("a[aria-label]").first();
      const next = rangeNav.locator("a[aria-label]").last();
      const label = rangeNav.locator("span").first();

      await expect(today).toBeVisible();
      await expect(previous).toBeVisible();
      await expect(next).toBeVisible();
      await expect(rangeLinks).toHaveCount(3);
      await expect(label).toBeVisible();
      await expect(label).not.toHaveText("");

      const geometry = await rangeNav.evaluate((navElement) => {
        const navRect = navElement.getBoundingClientRect();
        const toolbar = navElement.parentElement;
        const toolbarRect = toolbar?.getBoundingClientRect();
        const dateLabel = navElement.querySelector("span");
        const labelRect = dateLabel?.getBoundingClientRect();

        return {
          navLeft: navRect.left,
          navRight: navRect.right,
          navWidth: navRect.width,
          navClientWidth: navElement.clientWidth,
          navScrollWidth: navElement.scrollWidth,
          toolbarLeft: toolbarRect?.left ?? 0,
          toolbarRight: toolbarRect?.right ?? 0,
          toolbarClientWidth: toolbar?.clientWidth ?? 0,
          toolbarScrollWidth: toolbar?.scrollWidth ?? 0,
          labelWidth: labelRect?.width ?? 0,
          labelClientWidth: dateLabel?.clientWidth ?? 0,
          labelScrollWidth: dateLabel?.scrollWidth ?? 0,
          controls: Array.from(navElement.querySelectorAll("a")).map((control) => {
            const rect = control.getBoundingClientRect();
            return { width: rect.width, height: rect.height };
          }),
        };
      });

      expect(geometry.navWidth, `${view} nav at ${width}px`).toBeGreaterThan(0);
      expect(
        geometry.navLeft,
        `${view} nav starts inside toolbar at ${width}px`,
      ).toBeGreaterThanOrEqual(geometry.toolbarLeft - 1);
      expect(
        geometry.navRight,
        `${view} nav ends inside toolbar at ${width}px`,
      ).toBeLessThanOrEqual(geometry.toolbarRight + 1);
      expect(
        geometry.navScrollWidth,
        `${view} nav has no clipped content at ${width}px`,
      ).toBeLessThanOrEqual(geometry.navClientWidth + 1);
      expect(
        geometry.toolbarScrollWidth,
        `calendar toolbar has no horizontal overflow at ${width}px`,
      ).toBeLessThanOrEqual(geometry.toolbarClientWidth + 1);
      expect(
        geometry.labelWidth,
        `${view} date label remains readable at ${width}px`,
      ).toBeGreaterThanOrEqual(143);
      expect(
        geometry.labelScrollWidth,
        `${view} date label is not clipped at ${width}px`,
      ).toBeLessThanOrEqual(geometry.labelClientWidth + 1);

      const minimumControlSize = width < 768 ? 44 : 40;
      for (const control of geometry.controls) {
        expect(control.width, `${view} control width at ${width}px`).toBeGreaterThanOrEqual(
          minimumControlSize - 1,
        );
        expect(control.height, `${view} control height at ${width}px`).toBeGreaterThanOrEqual(
          minimumControlSize - 1,
        );
      }

      const pageWidth = await page.evaluate(() => ({
        body: document.body.scrollWidth,
        document: document.documentElement.scrollWidth,
      }));
      expect(pageWidth.body, `${view} body has no overflow at ${width}px`).toBeLessThanOrEqual(
        width + 1,
      );
      expect(
        pageWidth.document,
        `${view} document has no overflow at ${width}px`,
      ).toBeLessThanOrEqual(width + 1);

      if (width === 320 && view === "month") {
        await page.screenshot({
          path: testInfo.outputPath("calendar-layout-containment-320px.png"),
          fullPage: true,
        });
      }

      if (width === 320) {
        const nextDate = new URL((await next.getAttribute("href"))!, page.url()).searchParams.get(
          "date",
        )!;

        await next.click();
        await expectCalendarState(page, view, nextDate);

        const previousDate = new URL(
          (await previous.getAttribute("href"))!,
          page.url(),
        ).searchParams.get("date")!;
        await previous.click();
        await expectCalendarState(page, view, previousDate);

        const todayDate = new URL((await today.getAttribute("href"))!, page.url()).searchParams.get(
          "date",
        )!;
        await today.click();
        await expectCalendarState(page, view, todayDate);
      }
    }
  }
});
