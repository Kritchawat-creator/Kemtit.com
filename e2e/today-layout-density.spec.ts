import { expect, test, type Page } from "@playwright/test";

import { onboardNewUser } from "./helpers";

const viewportWidths = [360, 390, 768, 1024, 1151, 1440, 1800];
const scopes = ["all", "work", "life"] as const;

type TodayCardGeometry = {
  heading: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fragmentCount: number;
};

type TodayLayoutGeometry = {
  cards: TodayCardGeometry[];
  columnXs: number[];
  columnBottomImbalance: number;
  tallestCardHeight: number;
  orderedByColumns: boolean;
  verticalGaps: number[];
  documentWidth: number;
  viewportWidth: number;
};

async function readTodayLayoutGeometry(page: Page): Promise<TodayLayoutGeometry> {
  return page.getByTestId("today-card-layout").evaluate((layout) => {
    const cards = Array.from(
      layout.querySelectorAll<HTMLElement>('[data-testid="today-layout-card"]'),
    );
    const geometry = cards.map((card) => {
      const rect = card.getBoundingClientRect();
      const heading = card.querySelector("h2, h3")?.textContent?.replace(/\s+/g, " ").trim();

      return {
        heading: heading || card.getAttribute("aria-label") || "unlabelled Today card",
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        fragmentCount: card.getClientRects().length,
      };
    });
    const columnBottoms = new Map<number, number>();
    const verticalGaps: number[] = [];

    for (const [index, card] of geometry.entries()) {
      const columnX = Math.round(card.x);
      columnBottoms.set(columnX, Math.max(columnBottoms.get(columnX) ?? 0, card.y + card.height));

      const previous = geometry[index - 1];
      if (previous && Math.round(previous.x) === columnX) {
        verticalGaps.push(card.y - (previous.y + previous.height));
      }
    }

    const orderedByColumns = geometry.every((card, index) => {
      if (index === 0) return true;
      const previous = geometry[index - 1];
      if (card.x > previous.x + 1) return true;
      return Math.abs(card.x - previous.x) <= 1 && card.y >= previous.y + previous.height - 1;
    });
    const bottoms = Array.from(columnBottoms.values());

    return {
      cards: geometry,
      columnXs: Array.from(columnBottoms.keys()).sort((left, right) => left - right),
      columnBottomImbalance: bottoms.length > 0 ? Math.max(...bottoms) - Math.min(...bottoms) : 0,
      tallestCardHeight: Math.max(0, ...geometry.map((card) => card.height)),
      orderedByColumns,
      verticalGaps,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });
}

test("Today cards stay readable and balanced across responsive widths and scopes", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "This test sets its own viewport widths.");
  test.setTimeout(120_000);
  await onboardNewUser(page, "today-layout-density");

  for (const scope of scopes) {
    await page.goto(`/today?scope=${scope}`);
    const layout = page.getByTestId("today-card-layout");
    await expect(layout).toBeVisible();
    let baselineHeadings: string[] | undefined;

    for (const width of viewportWidths) {
      await page.setViewportSize({ width, height: 1200 });

      await expect(async () => {
        const geometry = await readTodayLayoutGeometry(page);
        const viewportContext = `${scope} scope at ${width}px`;
        const expectedColumns = width >= 1440 ? 3 : width >= 1151 ? 2 : 1;

        expect(
          geometry.cards.length,
          `${viewportContext}: Today cards remain visible`,
        ).toBeGreaterThan(4);
        expect(geometry.columnXs.length, `${viewportContext}: responsive column count`).toBe(
          expectedColumns,
        );
        expect(
          geometry.documentWidth,
          `${viewportContext}: page has no horizontal overflow`,
        ).toBeLessThanOrEqual(geometry.viewportWidth);
        expect(
          geometry.cards.every((card) => card.width > 0 && card.height > 0),
          `${viewportContext}: every card has readable dimensions`,
        ).toBe(true);
        expect(
          geometry.cards.every((card) => card.fragmentCount === 1),
          `${viewportContext}: cards do not fragment across columns`,
        ).toBe(true);
        expect(geometry.orderedByColumns, `${viewportContext}: visual and DOM order agree`).toBe(
          true,
        );
        expect(
          geometry.verticalGaps.every((gap) => gap >= 14 && gap <= 18),
          `${viewportContext}: cards retain a 16px vertical gap`,
        ).toBe(true);

        if (expectedColumns > 1) {
          expect(
            geometry.columnBottomImbalance,
            `${viewportContext}: blank column tail stays within one card height`,
          ).toBeLessThanOrEqual(geometry.tallestCardHeight + 16);
        } else {
          expect(
            geometry.columnBottomImbalance,
            `${viewportContext}: single column has no tail gap`,
          ).toBe(0);
        }
      }).toPass({ timeout: 2_000, intervals: [50, 100, 200] });

      const geometry = await readTodayLayoutGeometry(page);
      const headings = geometry.cards.map((card) => card.heading);
      if (baselineHeadings) {
        expect(
          headings,
          `${scope} scope keeps the same cards and reading order at ${width}px`,
        ).toEqual(baselineHeadings);
      } else {
        baselineHeadings = headings;
      }

      if (scope === "all" && width === 1151) {
        await page.screenshot({
          path: testInfo.outputPath("today-layout-density-1151.png"),
          fullPage: true,
        });
      }
      if (scope === "all" && width === 1800) {
        await page.screenshot({
          path: testInfo.outputPath("today-layout-density-1800.png"),
          fullPage: true,
        });
      }
    }
  }
});
