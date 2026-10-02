import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

async function main() {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 2770, height: 1308 },
    deviceScaleFactor: 1,
  });
  const preview = `file://${path.join(directory, "preview.html")}`;

  for (const board of ["inbox", "tasks"]) {
    await page.goto(`${preview}?board=${board}`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(directory, `${board}.png`), fullPage: true });
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
