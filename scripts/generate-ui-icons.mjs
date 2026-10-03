import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { UI_ICON_GEOMETRY } from "./ui-icon-geometry.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(projectRoot, "public/icons/ui");
const ids = Object.keys(UI_ICON_GEOMETRY).sort();
const svgRoot =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">';

mkdirSync(outputDirectory, { recursive: true });

for (const id of ids) {
  const geometry = UI_ICON_GEOMETRY[id];
  writeFileSync(path.join(outputDirectory, `${id}.svg`), `${svgRoot}${geometry}</svg>\n`);
}

const symbols = ids
  .map((id) => `<symbol id="icon-${id}" viewBox="0 0 24 24">${UI_ICON_GEOMETRY[id]}</symbol>`)
  .join("\n  ");
writeFileSync(
  path.join(outputDirectory, "sprite.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg">\n  ${symbols}\n</svg>\n`,
);

const gallery = ids
  .map(
    (id) =>
      `      <figure><svg viewBox="0 0 24 24" role="img" aria-label="${id}"><use href="./sprite.svg#icon-${id}"></use></svg><figcaption>${id}</figcaption></figure>`,
  )
  .join("\n");
writeFileSync(
  path.join(outputDirectory, "preview.html"),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Kemtit UI icon preview</title>
    <style>
      :root { color-scheme: light; font: 14px/1.45 system-ui, sans-serif; color: #29233f; background: #faf9ff; }
      body { margin: 0; padding: 28px; }
      h1 { margin: 0 0 6px; font-size: 20px; }
      p { margin: 0 0 20px; color: #6e6883; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 10px; }
      figure { display: grid; justify-items: center; gap: 9px; margin: 0; min-height: 82px; padding: 14px 8px; border: 1px solid #e6e1f2; border-radius: 12px; background: white; color: #6656e8; }
      svg { width: 32px; height: 32px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
      figcaption { color: #514b64; font-size: 11px; text-align: center; }
      @media (min-width: 860px) { body { padding: 36px; } }
    </style>
  </head>
  <body>
    <h1>Kemtit UI icons</h1>
    <p>Original outline shapes, 24 × 24 viewBox, currentColor stroke.</p>
    <main class="grid">
${gallery}
    </main>
  </body>
</html>
`,
);

console.log(`Wrote ${ids.length} SVG icons, sprite, and preview to public/icons/ui`);
