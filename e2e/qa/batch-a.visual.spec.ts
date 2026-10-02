import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { onboardNewUser } from "../helpers";

test("capture Batch A pages at the approved viewports", async ({ page }) => {
  const testEmail = await onboardNewUser(page, "batch-a-visual");

  const projectName = test.info().project.name;
  const viewport =
    projectName === "mobile-chrome"
      ? { width: 390, height: 844 }
      : projectName === "tablet-chrome"
        ? { width: 768, height: 1024 }
        : { width: 1440, height: 900 };
  await page.setViewportSize(viewport);

  const screenshotDirectory = join(process.cwd(), "docs/ui-optimization/qa/batch-a", projectName);
  mkdirSync(screenshotDirectory, { recursive: true });

  for (const [name, route] of [
    ["today", "/today"],
    ["planner-week", "/plan?view=week"],
    ["insights", "/insights"],
    ["finance-secondary-route", "/finance"],
  ]) {
    await page.goto(route);
    await expect(page.getByRole("main").getByRole("heading").nth(1)).toBeVisible({
      timeout: 15_000,
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
    await page.screenshot({
      path: join(screenshotDirectory, `${name}.png`),
      fullPage: false,
      scale: "css",
    });
  }
});
