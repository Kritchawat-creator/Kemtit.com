import { expect, test } from "@playwright/test";

import { onboardNewUser } from "./helpers";

test("V2 responsive shell: final IA routes render without dead navigation", async ({
  page,
  isMobile,
}) => {
  await onboardNewUser(page, "v2-responsive");

  const routes: Array<[string, string]> = [
    ["/today", "วันนี้"],
    ["/plan", "แผน"],
    ["/insights", "วิเคราะห์"],
    ["/more", "เพิ่มเติม"],
    ["/inbox", "กล่องเข้า"],
    ["/calendar", "ปฏิทิน"],
    ["/goals", "เป้าหมาย"],
    ["/reviews", "ทบทวนรายสัปดาห์"],
    ["/life", "ชีวิต"],
    ["/finance", "การเงิน"],
  ];

  for (const [route, heading] of routes) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(route.replace("/", "\\/")));
    await expect(page.getByRole("heading", { name: heading, exact: true }).first()).toBeVisible();
  }

  await page.goto("/insights");
  const reportTabs = page.getByRole("navigation", { name: "ประเภทรายงาน" });
  await expect(reportTabs).toBeVisible();
  await expect
    .poll(() => reportTabs.evaluate((element) => getComputedStyle(element).overflowX))
    .toBe("auto");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  if (isMobile) {
    expect(await reportTabs.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
      true,
    );
  }

  await page.goto("/today");
  const navigations = page.getByRole("navigation", { name: "เมนูหลัก" });

  if (isMobile) {
    const navigation = navigations.last();
    await expect(navigation.getByRole("link", { name: "วันนี้", exact: true })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "แผน", exact: true })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "วิเคราะห์", exact: true })).toBeVisible();
    const moreMenuButton = navigation.getByRole("button", { name: "เมนู", exact: true });
    await expect(moreMenuButton).toBeVisible();
    await expect(navigation.getByLabel("เปิดเมนูเพิ่ม")).toBeVisible();
    await moreMenuButton.click();
    const moreDrawer = page.getByRole("dialog");
    const financeLink = moreDrawer.getByRole("link", { name: /^การเงิน/ });
    await expect(financeLink).toBeVisible();
    await financeLink.click();
    await expect(page).toHaveURL(/\/finance$/);
  } else if (test.info().project.name === "tablet-chrome") {
    const moreMenuButton = page.getByRole("button", { name: "เมนู", exact: true });
    await expect(moreMenuButton).toBeVisible();
    await moreMenuButton.click();

    const tabletNavigation = page
      .getByRole("dialog")
      .getByRole("navigation", { name: "เมนูหลัก" });
    await expect(tabletNavigation.getByRole("link")).toHaveCount(11);
    await expect(
      tabletNavigation.getByRole("link", { name: "วันนี้", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(tabletNavigation.getByRole("link", { name: "แผน", exact: true })).toBeVisible();
    await expect(
      tabletNavigation.getByRole("link", { name: "วิเคราะห์", exact: true }),
    ).toBeVisible();

    await tabletNavigation.getByRole("link", { name: "การเงิน", exact: true }).click();
    await expect(page).toHaveURL(/\/finance$/);
    await moreMenuButton.click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("navigation", { name: "เมนูหลัก" })
        .getByRole("link", { name: "การเงิน", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  } else {
    const navigation = navigations.first();
    await expect(navigation.getByRole("link", { name: "วันนี้", exact: true })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "แผน", exact: true })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "วิเคราะห์", exact: true })).toBeVisible();

    await page.goto("/finance");
    await expect(
      navigations.first().getByRole("link", { name: "การเงิน", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  }
});
