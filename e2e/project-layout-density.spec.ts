import { expect, test, type Page } from "@playwright/test";

import { signInWithOtp, uniqueEmail } from "./helpers";

const VIEWPORTS = [360, 390, 768, 1024, 1151, 1440, 1800] as const;

async function onboardEmployee(page: Page) {
  await signInWithOtp(page, uniqueEmail("project-layout-density"));
  await expect(page).toHaveURL(/\/onboarding\/persona/);
  await page.getByText("พนักงาน", { exact: true }).click();
  await page.getByRole("button", { name: "เลือกบทบาทนี้" }).click();
  await expect(page).toHaveURL(/\/onboarding\/focus/, { timeout: 15_000 });
  await page.getByText("งาน", { exact: true }).first().click();
  await page.getByRole("button", { name: "เตรียมพื้นที่เริ่มต้น" }).click();
  await expect(page).toHaveURL(/\/onboarding\/starter/, { timeout: 15_000 });
  await page.getByRole("button", { name: "ไปหน้าวันนี้" }).click();
  await expect(page).toHaveURL(/\/today/, { timeout: 20_000 });
}

async function readGeometry(page: Page, kind: "list" | "detail") {
  return page.evaluate((pageKind) => {
    const selectors = pageKind === "list"
      ? [
          'main section[aria-labelledby="projects-create-heading"]',
          'main section[aria-labelledby="projects-list-heading"]',
          'main section[aria-labelledby="projects-create-heading"] form',
          'main section[aria-labelledby="projects-list-heading"] > ul > li:first-child',
        ]
      : [
          'main aside',
          'main section[aria-labelledby="project-tasks-heading"]',
          'main aside > section[aria-labelledby="project-summary"]',
          'main section[aria-labelledby="project-tasks-heading"] > [data-variant="standalone"]',
        ];
    const elements = selectors.map((selector) => document.querySelector(selector));
    if (elements.some((element) => !(element instanceof HTMLElement))) {
      throw new Error(`Incomplete project ${pageKind} layout`);
    }
    const [left, right, leftCard, rightCard] = elements as HTMLElement[];
    const bounds = (element: HTMLElement) => {
      const { left, right, top, bottom, width, height } = element.getBoundingClientRect();
      return { left, right, top, bottom, width, height };
    };
    const leftBounds = bounds(left);
    const rightBounds = bounds(right);
    const rightCardBounds = bounds(rightCard);
    return {
      documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      viewportWidth: window.innerWidth,
      left: leftBounds,
      right: rightBounds,
      leftCard: bounds(leftCard),
      rightCard: rightCardBounds,
      unusedTail: Math.max(0, rightBounds.bottom - rightCardBounds.bottom),
    };
  }, kind);
}

async function checkGeometry(page: Page, kind: "list" | "detail", width: number) {
  let geometry: Awaited<ReturnType<typeof readGeometry>> | undefined;
  await expect(async () => {
    geometry = await readGeometry(page, kind);
    expect(geometry.documentWidth, `${kind}: no overflow at ${width}px`).toBeLessThanOrEqual(
      geometry.viewportWidth + 1,
    );
    expect(geometry.left.width, `${kind}: left column has width at ${width}px`).toBeGreaterThan(
      180,
    );
    expect(geometry.right.width, `${kind}: right column has width at ${width}px`).toBeGreaterThan(
      180,
    );
    expect(geometry.leftCard.width, `${kind}: left card has width at ${width}px`).toBeGreaterThan(
      160,
    );
    expect(geometry.rightCard.width, `${kind}: right card has width at ${width}px`).toBeGreaterThan(
      160,
    );

    if (kind === "list" && width >= 1024) {
      expect(geometry.right.left - geometry.left.right, `${kind}: column gap`).toBeGreaterThanOrEqual(
        20,
      );
      expect(geometry.right.left - geometry.left.right, `${kind}: column gap`).toBeLessThanOrEqual(
        28,
      );
      expect(Math.abs(geometry.left.top - geometry.right.top), `${kind}: column alignment`).toBeLessThanOrEqual(
        1,
      );
      expect(geometry.unusedTail, `${kind}: no large empty tail below the right card`).toBeLessThan(400);
    } else {
      expect(Math.abs(geometry.left.left - geometry.right.left), `${kind}: stacked left edge`).toBeLessThanOrEqual(
        1,
      );
      expect(Math.abs(geometry.left.width - geometry.right.width), `${kind}: stacked width`).toBeLessThanOrEqual(
        1,
      );
      expect(geometry.right.top - geometry.left.bottom, `${kind}: vertical gap`).toBe(16);
    }
  }).toPass({ timeout: 2_000, intervals: [50, 100, 200] });
  return geometry;
}

test("project list and detail cards stay readable across viewport widths", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await onboardEmployee(page);
  await page.goto("/work/projects");

  const projectTitle = `Project layout QA ${Date.now()}`;
  await page.getByLabel("ชื่อโปรเจกต์").fill(projectTitle);
  await page.getByRole("button", { name: "สร้างโปรเจกต์" }).click();
  await expect(page.getByText("สร้างโปรเจกต์แล้ว")).toBeVisible({ timeout: 15_000 });
  const projectLink = page.getByRole("link", { name: projectTitle, exact: true });
  await expect(projectLink).toBeVisible();
  const projectUrl = await projectLink.getAttribute("href");
  expect(projectUrl).toMatch(/^\/work\/projects\/[0-9a-f-]+$/i);

  for (const width of VIEWPORTS) {
    await page.setViewportSize({ width, height: 1000 });
    const geometry = await checkGeometry(page, "list", width);
    if (width === 1800) {
      console.info("PROJECT_LIST_DENSITY_1800", JSON.stringify(geometry));
      await page.screenshot({ path: testInfo.outputPath("project-list-1800.png"), fullPage: true });
    }
  }

  await page.goto(projectUrl!);
  await expect(page.getByRole("heading", { name: projectTitle, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "งานในโปรเจกต์", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "ยังไม่มีงานในโปรเจกต์", exact: true })).toBeVisible();

  for (const width of VIEWPORTS) {
    await page.setViewportSize({ width, height: 1000 });
    const geometry = await checkGeometry(page, "detail", width);
    if (width === 1800) {
      console.info("PROJECT_DETAIL_DENSITY_1800", JSON.stringify(geometry));
      await page.screenshot({ path: testInfo.outputPath("project-detail-1800.png"), fullPage: true });
    }
  }
});
