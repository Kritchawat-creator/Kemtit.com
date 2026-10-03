import { expect, test } from "@playwright/test";

import { onboardNewUser } from "./helpers";

test("Inbox planning keeps the canonical task and exposes its details in Tasks and Today", async ({
  page,
}) => {
  await onboardNewUser(page, "inbox-task-plan");
  await page.goto("/inbox");

  const title = "เตรียมเอกสารสุขภาพประจำปี";
  await page.getByLabel("งานใหม่ในกล่องเข้า").fill(title);
  await page.getByRole("radio", { name: "สุขภาพ" }).click();
  await page.getByRole("button", { name: "เก็บเข้ากล่องเข้า" }).click();

  const inboxTask = page.locator("[data-task-id]").filter({ hasText: title });
  await expect(inboxTask).toBeVisible();
  await expect(inboxTask.getByText("สุขภาพ", { exact: true })).toBeVisible();
  const taskId = await inboxTask.getAttribute("data-task-id");
  expect(taskId).toBeTruthy();

  await inboxTask.getByRole("button", { name: "วางวันนี้" }).click();
  await expect(inboxTask).toHaveCount(0);

  await page.goto("/tasks?view=planned");
  const plannedTask = page.locator(`[data-task-id="${taskId}"]`);
  await expect(plannedTask).toBeVisible();
  await expect(plannedTask.getByText(title, { exact: true })).toBeVisible();

  await plannedTask.getByRole("button", { name: `เปิดรายละเอียด ${title}` }).click();
  await expect(page.getByText("วันที่ตั้งใจทำ", { exact: true })).toBeVisible();
  await expect(page.getByText("กำหนดส่ง (ถ้ามี)", { exact: true })).toBeVisible();

  await page.goto("/today?scope=life");
  await expect(page.getByRole("button", { name: `เปิดรายละเอียด ${title}` })).toBeVisible();

  await page.goto("/inbox");
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
});

test("Inbox task titles keep readable space across responsive widths", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1151, height: 900 });
  await onboardNewUser(page, "inbox-row-layout");
  await page.goto("/inbox");

  const title = "จัดเตรียม annual review และ follow-up ให้ทีม";
  await page.getByLabel("งานใหม่ในกล่องเข้า").fill(title);
  await page.getByRole("button", { name: "เก็บเข้ากล่องเข้า" }).click();

  const task = page.locator("[data-task-id]").filter({ hasText: title });
  await expect(task).toBeVisible();

  for (const width of [1151, 1440, 1800, 1024, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    const readGeometry = () =>
      task.evaluate((row) => {
        const titleColumn = row.children[0] as HTMLElement | undefined;
        const actionColumn = row.children[1] as HTMLElement | undefined;
        const list = row.closest("ul");
        const rowBox = row.getBoundingClientRect();
        const titleBox = titleColumn?.getBoundingClientRect();
        const actionsBox = actionColumn?.getBoundingClientRect();

        return {
          viewportWidth: window.innerWidth,
          listWidth: list?.getBoundingClientRect().width ?? 0,
          rowDirection: getComputedStyle(row).flexDirection,
          titleWidth: titleBox?.width ?? 0,
          rowWidth: row.clientWidth,
          rowScrollWidth: row.scrollWidth,
          rowLeft: rowBox.left,
          rowRight: rowBox.right,
          actionsLeft: actionsBox?.left ?? 0,
          actionsRight: actionsBox?.right ?? 0,
          pageWidth: document.documentElement.clientWidth,
          pageScrollWidth: document.documentElement.scrollWidth,
        };
      });

    // ShellFrame animates responsive padding for 200ms; retry the complete layout
    // assertions until the shell and inbox geometry have settled at this viewport.
    await expect(async () => {
      const geometry = await readGeometry();
      expect(geometry.viewportWidth, `viewport at ${width}px`).toBe(width);
      expect(
        geometry.titleWidth,
        `title column at ${width}px: ${JSON.stringify(geometry)}`,
      ).toBeGreaterThanOrEqual(180);
      expect(geometry.rowScrollWidth, `task row overflow at ${width}px`).toBeLessThanOrEqual(
        geometry.rowWidth + 1,
      );
      expect(geometry.actionsLeft, `actions begin within row at ${width}px`).toBeGreaterThanOrEqual(
        geometry.rowLeft - 1,
      );
      expect(geometry.actionsRight, `actions end within row at ${width}px`).toBeLessThanOrEqual(
        geometry.rowRight + 1,
      );
      expect(
        geometry.pageScrollWidth,
        `page has no horizontal overflow at ${width}px`,
      ).toBeLessThanOrEqual(geometry.pageWidth + 1);
    }).toPass({ timeout: 2_000, intervals: [50, 100, 200] });

    if (width === 1151 || width === 1800) {
      await page.screenshot({
        path: testInfo.outputPath(`inbox-row-${width}px.png`),
        fullPage: true,
      });
    }
  }
});
