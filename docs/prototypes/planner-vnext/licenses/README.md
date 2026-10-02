# Prototype asset provenance

This folder records the third-party assets used by the standalone planner prototype. It is documentation for this prototype only; it does not change production licensing or branding policy.

## Lucide icon nodes

`app.js` mirrors the canonical `__iconNode` geometry from the installed `lucide-react` **1.41.0** ESM files. React-only `key` metadata is omitted because the prototype renders the same SVG nodes directly. The full package license is copied unchanged to [`lucide-react-LICENSE`](./lucide-react-LICENSE).

| Prototype key | Canonical icon | Installed source |
| --- | --- | --- |
| `calendar` | `calendar` | `node_modules/lucide-react/dist/esm/icons/calendar.mjs` |
| `inbox` | `inbox` | `node_modules/lucide-react/dist/esm/icons/inbox.mjs` |
| `target` | `target` | `node_modules/lucide-react/dist/esm/icons/target.mjs` |
| `chart` | `chart-line` | `node_modules/lucide-react/dist/esm/icons/chart-line.mjs` |
| `settings` | `settings` | `node_modules/lucide-react/dist/esm/icons/settings.mjs` |
| `plus` | `plus` | `node_modules/lucide-react/dist/esm/icons/plus.mjs` |
| `check` | `check` | `node_modules/lucide-react/dist/esm/icons/check.mjs` |
| `check-circle` | `circle-check` | `node_modules/lucide-react/dist/esm/icons/circle-check.mjs` |
| `arrow` | `arrow-right` | `node_modules/lucide-react/dist/esm/icons/arrow-right.mjs` |
| `clock` | `clock` | `node_modules/lucide-react/dist/esm/icons/clock.mjs` |
| `heart` | `heart` | `node_modules/lucide-react/dist/esm/icons/heart.mjs` |
| `wallet` | `wallet-cards` | `node_modules/lucide-react/dist/esm/icons/wallet-cards.mjs` |
| `folder` | `folder` | `node_modules/lucide-react/dist/esm/icons/folder.mjs` |
| `chevron` | `chevron-right` | `node_modules/lucide-react/dist/esm/icons/chevron-right.mjs` |
| `chevron-left` | `chevron-left` | `node_modules/lucide-react/dist/esm/icons/chevron-left.mjs` |
| `chevron-right` | `chevron-right` | `node_modules/lucide-react/dist/esm/icons/chevron-right.mjs` |
| `sparkles` | `sparkles` | `node_modules/lucide-react/dist/esm/icons/sparkles.mjs` |
| `home` | `house` | `node_modules/lucide-react/dist/esm/icons/house.mjs` |
| `menu` | `menu` | `node_modules/lucide-react/dist/esm/icons/menu.mjs` |
| `search` | `search` | `node_modules/lucide-react/dist/esm/icons/search.mjs` |
| `x` | `x` | `node_modules/lucide-react/dist/esm/icons/x.mjs` |
| `compass` | `compass` | `node_modules/lucide-react/dist/esm/icons/compass.mjs` |
| `review` | `clipboard-list` | `node_modules/lucide-react/dist/esm/icons/clipboard-list.mjs` |
| `briefcase` | `briefcase` | `node_modules/lucide-react/dist/esm/icons/briefcase.mjs` |
| `repeat` | `repeat-2` | `node_modules/lucide-react/dist/esm/icons/repeat-2.mjs` |
| `dollar` | `circle-dollar-sign` | `node_modules/lucide-react/dist/esm/icons/circle-dollar-sign.mjs` |
| `lock` | `lock` | `node_modules/lucide-react/dist/esm/icons/lock.mjs` |
| `play` | `play` | `node_modules/lucide-react/dist/esm/icons/play.mjs` |
| `pause` | `pause` | `node_modules/lucide-react/dist/esm/icons/pause.mjs` |
| `undo` | `undo-2` | `node_modules/lucide-react/dist/esm/icons/undo-2.mjs` |
| `flag` | `flag` | `node_modules/lucide-react/dist/esm/icons/flag.mjs` |
| `list` | `list` | `node_modules/lucide-react/dist/esm/icons/list.mjs` |
| `sun` | `sun` | `node_modules/lucide-react/dist/esm/icons/sun.mjs` |
| `moon` | `moon` | `node_modules/lucide-react/dist/esm/icons/moon.mjs` |
| `bell` | `bell` | `node_modules/lucide-react/dist/esm/icons/bell.mjs` |
| `book` | `book-open` | `node_modules/lucide-react/dist/esm/icons/book-open.mjs` |
| `link` | `link` | `node_modules/lucide-react/dist/esm/icons/link.mjs` |
| `refresh` | `refresh-cw` | `node_modules/lucide-react/dist/esm/icons/refresh-cw.mjs` |
| `sliders` | `sliders-horizontal` | `node_modules/lucide-react/dist/esm/icons/sliders-horizontal.mjs` |
| `timer` | `timer` | `node_modules/lucide-react/dist/esm/icons/timer.mjs` |
| `move` | `move-right` | `node_modules/lucide-react/dist/esm/icons/move-right.mjs` |
| `trend` | `trending-up` | `node_modules/lucide-react/dist/esm/icons/trending-up.mjs` |
| `user` | `user` | `node_modules/lucide-react/dist/esm/icons/user.mjs` |
| `login` | `log-in` | `node_modules/lucide-react/dist/esm/icons/log-in.mjs` |
| `dots` | `ellipsis` | `node_modules/lucide-react/dist/esm/icons/ellipsis.mjs` |
| `calendar-plus` | `calendar-plus` | `node_modules/lucide-react/dist/esm/icons/calendar-plus.mjs` |
| `goal` | `goal` | `node_modules/lucide-react/dist/esm/icons/goal.mjs` |
| `project` | `folder-plus` | `node_modules/lucide-react/dist/esm/icons/folder-plus.mjs` |
| `habit` | `notebook-pen` | `node_modules/lucide-react/dist/esm/icons/notebook-pen.mjs` |

Package source: <https://github.com/lucide-icons/lucide/tree/main/packages/lucide-react>. Installed license SHA-256: `b495047bd93a9b06913511076f504daba17d5bbeb3e0650f3bb53a4220329c57`.

## Google pre-approved button asset

The prototype uses the unchanged official standard light rectangular button PNG, stored at [`assets/google-sign-in-standard-white.png`](../assets/google-sign-in-standard-white.png). It is displayed as an image button so the bundled artwork keeps its aspect ratio and Google-provided typography.

- Asset source: <https://developers.google.com/static/identity/gsi/web/images/standard-button-white.png>
- Branding guidance: <https://developers.google.com/identity/branding-guidelines>
- Downloaded dimensions: 354 × 80 RGBA PNG
- SHA-256: `892062091f35e69dd838ba4a4f238d37a0562d52ecda6406eb343a1127251409`

This records provenance only. It does not claim that Google artwork is OFL-licensed, trademark-free, or otherwise available outside the branding terms at the source above.
