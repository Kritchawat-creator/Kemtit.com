import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { onboardNewUser } from "../helpers";

async function expectAvailableWidth(locator: Locator) {
  const { width, availableWidth } = await locator.evaluate((element) => {
    const parent = element.parentElement;
    if (!parent) throw new Error("Expected the mobile block to have a layout parent");
    const parentStyle = getComputedStyle(parent);
    const availableWidth =
      parent.clientWidth -
      Number.parseFloat(parentStyle.paddingLeft) -
      Number.parseFloat(parentStyle.paddingRight);

    return { width: element.getBoundingClientRect().width, availableWidth };
  });

  expect(width).toBeGreaterThanOrEqual(availableWidth - 2);
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}

test("capture Batch C Inbox and Tasks at the approved viewports", async ({ page }) => {
  const projectName = test.info().project.name;
  const viewport =
    projectName === "mobile-chrome"
      ? { width: 390, height: 844 }
      : projectName === "tablet-chrome"
        ? { width: 768, height: 1024 }
        : { width: 1440, height: 900 };
  await page.setViewportSize(viewport);
  const testEmail = await onboardNewUser(page, "batch-c-visual");

  const screenshotDirectory = join(process.cwd(), "docs/ui-optimization/qa/batch-c", projectName);
  mkdirSync(screenshotDirectory, { recursive: true });

  await page.goto("/inbox");
  await expect(page.getByRole("heading", { name: "กล่องเข้า", exact: true })).toBeVisible();
  await page.addStyleTag({
    content:
      "nextjs-portal, button[aria-label='Open Next.js Dev Tools'] { display: none !important; }",
  });
  await page.evaluate((email) => {
    const textNodes = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = textNodes.nextNode();
    while (node) {
      if (node.nodeValue?.includes(email)) {
        node.nodeValue = node.nodeValue.replaceAll(email, "บัญชีทดสอบ");
      }
      node = textNodes.nextNode();
    }
  }, testEmail);

  const title = "เอกสารสำหรับนัดตรวจสุขภาพ";
  const captureCard = page.locator('[aria-labelledby="inbox-capture-heading"]');
  await page.getByLabel("งานใหม่ในกล่องเข้า").fill(title);
  await page.getByRole("radio", { name: "สุขภาพ", exact: true }).click();

  if (projectName === "mobile-chrome") {
    await expectAvailableWidth(captureCard);
    await expectAvailableWidth(page.getByLabel("งานใหม่ในกล่องเข้า"));
    await expectAvailableWidth(page.getByRole("button", { name: "เก็บเข้ากล่องเข้า" }));
    await expectNoHorizontalOverflow(page);
    await page.setViewportSize({ width: 360, height: 800 });
    await expectNoHorizontalOverflow(page);
    await expectAvailableWidth(captureCard);
    await expectAvailableWidth(page.getByLabel("งานใหม่ในกล่องเข้า"));
    await expectAvailableWidth(page.getByRole("button", { name: "เก็บเข้ากล่องเข้า" }));
    await page.setViewportSize(viewport);
  }

  await page.getByRole("button", { name: "เก็บเข้ากล่องเข้า" }).click();
  const inboxTask = page.locator("[data-task-id]").filter({ hasText: title });
  await expect(inboxTask).toBeVisible();
  const captureToast = page.getByText("เก็บงานเข้ากล่องเข้าแล้ว", { exact: true });
  if (await captureToast.count()) await expect(captureToast).toBeHidden();
  const taskId = await inboxTask.getAttribute("data-task-id");
  expect(taskId).toBeTruthy();

  if (projectName === "mobile-chrome") {
    await expectAvailableWidth(page.locator("main ul").first());
    await expectAvailableWidth(inboxTask);
    await expectAvailableWidth(inboxTask.getByRole("button", { name: "วางวันนี้" }));
    await page.setViewportSize({ width: 360, height: 800 });
    await expectNoHorizontalOverflow(page);
    await expectAvailableWidth(page.locator("main ul").first());
    await expectAvailableWidth(inboxTask);
    await expectAvailableWidth(inboxTask.getByRole("button", { name: "วางวันนี้" }));
    await page.setViewportSize(viewport);
  }

  await page.screenshot({
    path: join(screenshotDirectory, "inbox.png"),
    fullPage: false,
    scale: "css",
  });

  await inboxTask.getByRole("button", { name: "วางวันนี้" }).click();
  await expect(inboxTask).toHaveCount(0);
  await page.goto("/tasks?view=planned");
  await page.addStyleTag({
    content:
      "nextjs-portal, button[aria-label='Open Next.js Dev Tools'] { display: none !important; }",
  });

  const plannedTask = page.locator(`[data-task-id="${taskId}"]`);
  await expect(plannedTask).toBeVisible();
  await expect(plannedTask.getByText(title, { exact: true })).toBeVisible();

  if (projectName === "mobile-chrome") {
    await expectAvailableWidth(page.locator("main form"));
    await expectAvailableWidth(page.getByLabel("ค้นหาจากชื่องาน"));
    await expectAvailableWidth(page.locator('main select[name="view"]'));
    await expectAvailableWidth(page.getByRole("button", { name: "ค้นหา", exact: true }));
    await expectAvailableWidth(page.locator("main ul").first());
    await expectNoHorizontalOverflow(page);
    await page.setViewportSize({ width: 360, height: 800 });
    await expectAvailableWidth(page.locator("main form"));
    await expectAvailableWidth(page.getByLabel("ค้นหาจากชื่องาน"));
    await expectAvailableWidth(page.locator('main select[name="view"]'));
    await expectAvailableWidth(page.getByRole("button", { name: "ค้นหา", exact: true }));
    await expectAvailableWidth(page.locator("main ul").first());
    await expectNoHorizontalOverflow(page);
    await page.setViewportSize(viewport);
  }

  await page.screenshot({
    path: join(screenshotDirectory, "tasks.png"),
    fullPage: false,
    scale: "css",
  });

  await plannedTask.getByRole("button", { name: `เปิดรายละเอียด ${title}` }).click();
  await expect(page.getByText("วันที่ตั้งใจทำ", { exact: true })).toBeVisible();
  await expect(page.getByText("กำหนดส่ง (ถ้ามี)", { exact: true })).toBeVisible();

  if (projectName === "mobile-chrome") {
    const detailSheet = page.getByRole("dialog");
    await expect(detailSheet).toBeInViewport({ ratio: 0.8 });
    const detailSheetBox = await detailSheet.boundingBox();
    expect(detailSheetBox).not.toBeNull();
    expect(Math.abs(detailSheetBox!.width - viewport.width)).toBeLessThanOrEqual(2);
    await expectNoHorizontalOverflow(page);
    await page.setViewportSize({ width: 360, height: 800 });
    await expect(detailSheet).toBeInViewport({ ratio: 0.8 });
    const narrowDetailSheetBox = await detailSheet.boundingBox();
    expect(narrowDetailSheetBox).not.toBeNull();
    expect(Math.abs(narrowDetailSheetBox!.width - 360)).toBeLessThanOrEqual(2);
    await expectNoHorizontalOverflow(page);
    await page.setViewportSize(viewport);
  }

  await page.screenshot({
    path: join(screenshotDirectory, "task-detail.png"),
    fullPage: false,
    scale: "css",
    animations: "disabled",
  });
});
