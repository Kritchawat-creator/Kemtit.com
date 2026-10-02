import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { onboardNewUser } from "../helpers";

async function expectAvailableWidth(locator: Locator) {
  const { width, availableWidth } = await locator.evaluate((element) => {
    const parent = element.parentElement;
    if (!parent) throw new Error("Expected the command bar to have a layout parent");
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

test("capture Batch B Today and Quick Capture at the approved viewports", async ({ page }) => {
  const projectName = test.info().project.name;
  const viewport =
    projectName === "mobile-chrome"
      ? { width: 390, height: 844 }
      : projectName === "tablet-chrome"
        ? { width: 768, height: 1024 }
        : { width: 1440, height: 900 };
  await page.setViewportSize(viewport);
  const testEmail = await onboardNewUser(page, "batch-b-visual");

  const screenshotDirectory = join(process.cwd(), "docs/ui-optimization/qa/batch-b", projectName);
  mkdirSync(screenshotDirectory, { recursive: true });

  await page.goto("/today");
  await expect(page.getByRole("heading", { name: "วันนี้", exact: true })).toBeVisible();
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
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
  const captureEntry = page.getByRole("banner").getByRole("button", { name: "เปิดเมนูเพิ่ม" });
  await expect(captureEntry).toBeVisible();
  if (projectName === "mobile-chrome") {
    const addTask = await page.getByLabel("เพิ่มงาน").boundingBox();
    expect(addTask).not.toBeNull();
    expect(addTask!.y + addTask!.height).toBeLessThanOrEqual(viewport.height - 72);
  }
  await page.screenshot({
    path: join(screenshotDirectory, "today.png"),
    fullPage: false,
    scale: "css",
  });

  if (projectName === "mobile-chrome") {
    await expectAvailableWidth(captureEntry);
    await page.setViewportSize({ width: 360, height: 800 });
    await expectNoHorizontalOverflow(page);
    await expectAvailableWidth(captureEntry);
    await expect(captureEntry).toBeVisible();
    await page.setViewportSize(viewport);
  }

  await captureEntry.click();
  await expect(page.getByRole("dialog", { name: "บันทึกด่วน" })).toBeVisible();
  await page.screenshot({
    path: join(screenshotDirectory, "capture-input.png"),
    fullPage: false,
    scale: "css",
  });

  await page.getByLabel("คุณอยากเพิ่มอะไร").fill("ส่งรายงานพรุ่งนี้");
  const captureDialog = page.getByRole("dialog", { name: "บันทึกด่วน" });
  const preview = captureDialog.getByRole("region", {
    name: "ตัวอย่างจะอัปเดตตามข้อความที่พิมพ์",
  });
  await expect(preview).toBeVisible();
  await expect(preview.getByText("ส่งรายงานพรุ่งนี้", { exact: true })).toBeVisible();
  await expect(preview.getByText("งาน", { exact: true })).toBeVisible();

  if (projectName === "mobile-chrome") await expectAvailableWidth(preview);

  await page.screenshot({
    path: join(screenshotDirectory, "capture-proposal.png"),
    fullPage: false,
    scale: "css",
  });

  await captureDialog.getByText("แก้รายละเอียด (ไม่บังคับ)").click();
  await expect(captureDialog.getByLabel("ชื่อรายการ")).toBeVisible();
  await expect(captureDialog.locator("#quick-capture-date")).toBeVisible();

  if (projectName === "mobile-chrome") {
    const [titleWidth, dateWidth] = await Promise.all([
      captureDialog
        .getByLabel("ชื่อรายการ")
        .evaluate((element) => element.getBoundingClientRect().width),
      captureDialog
        .locator("#quick-capture-date")
        .evaluate((element) => element.getBoundingClientRect().width),
    ]);
    expect(Math.abs(titleWidth - dateWidth)).toBeLessThan(1);
  }
});
