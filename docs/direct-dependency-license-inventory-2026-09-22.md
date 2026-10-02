# Direct dependency license inventory — 2026-09-22

## Scope and result

Inspected all **22 direct runtime dependencies** declared in the root `package.json`, plus four selected build dependencies that generate UI or runtime output: `serwist`, `@serwist/next`, `tailwindcss`, and `@tailwindcss/postcss`. Versions and SPDX declarations below come from each installed `node_modules/<package>/package.json`, not from the version range in the root manifest. Local primary license text was inspected without installing packages, changing runtime code, or using network sources.

All 26 inspected manifests declare MIT, ISC, or Apache-2.0. No noncommercial or custom restriction was identified in the inspected primary license text. **This is not blanket rights clearance:** `server-only` has an unresolved full-notice gap; Lucide has an additional inherited MIT notice; bundled/transitive code and the actual deployment output are outside this inventory.

## Direct runtime dependencies

“Full text present” means the installed primary file includes the grant, conditions, and disclaimer; it does not mean deployment packaging or every embedded component was verified. No separately named top-level `NOTICE` file was found for these packages. The local source path is the exact evidence file; its containing package also holds the manifest used for the version and SPDX declaration.

| Package | Installed version | Declared SPDX | Local notice / source path | Evidence status |
| --- | --- | --- | --- | --- |
| `@hookform/resolvers` | 5.9.1 | MIT | `node_modules/@hookform/resolvers/LICENSE` | Full text present |
| `@supabase/ssr` | 0.12.6 | MIT | `node_modules/@supabase/ssr/LICENSE` | Full text present |
| `@supabase/supabase-js` | 2.115.0 | MIT | `node_modules/@supabase/supabase-js/LICENSE` | Full text present |
| `class-variance-authority` | 0.7.1 | Apache-2.0 | `node_modules/class-variance-authority/LICENSE` | Full Apache 2.0 text and Joe Bell copyright; no separate NOTICE found in this package |
| `cn` | 0.2.5 | MIT | `node_modules/cn/LICENSE` | Full text present |
| `date-fns` | 4.4.0 | MIT | `node_modules/date-fns/LICENSE.md` | Full text present |
| `date-fns-tz` | 3.2.0 | MIT | `node_modules/date-fns-tz/LICENSE.md` | Full text present |
| `input-otp` | 1.5.0 | MIT | `node_modules/input-otp/LICENSE` | Full text present |
| `lucide-react` | 1.41.0 | ISC | `node_modules/lucide-react/LICENSE` | Full ISC **and inherited MIT/Feather text** present; retain both |
| `motion` | 13.2.0 | MIT | `node_modules/motion/LICENSE.md` | Full text present |
| `next` | 16.3.4 | MIT | `node_modules/next/license.md` | Full primary text present; nested compiled components have additional notices outside this inventory |
| `next-intl` | 4.14.2 | MIT | `node_modules/next-intl/LICENSE` | Full text present |
| `next-themes` | 0.4.6 | MIT | `node_modules/next-themes/license.md` | Full text present |
| `radix-ui` | 1.6.7 | MIT | `node_modules/radix-ui/LICENSE` | Full text present |
| `react` | 19.2.8 | MIT | `node_modules/react/LICENSE` | Full text present |
| `react-day-picker` | 10.0.1 | MIT | `node_modules/react-day-picker/LICENSE` | Full text present |
| `react-dom` | 19.2.8 | MIT | `node_modules/react-dom/LICENSE` | Full text present |
| `react-hook-form` | 7.87.0 | MIT | `node_modules/react-hook-form/LICENSE` | Full text present |
| `server-only` | 0.0.1 | MIT | `node_modules/server-only/package.json` only | **Missing full license/notice locally; provenance gap unresolved** |
| `sonner` | 2.0.8 | MIT | `node_modules/sonner/LICENSE.md` | Full text present |
| `tw-animate-css` | 1.4.0 | MIT | `node_modules/tw-animate-css/LICENSE` | Full text present |
| `zod` | 4.5.4 | MIT | `node_modules/zod/LICENSE` | Full text present |

## Selected build dependencies

These four packages are declared in `devDependencies` but were specifically included because they generate or contribute to UI/runtime output. Their inclusion does not assert that every file in each package is shipped to users.

| Package | Installed version | Declared SPDX | Local notice / source path | Evidence status |
| --- | --- | --- | --- | --- |
| `serwist` | 9.5.12 | MIT | `node_modules/serwist/LICENSE` | Full text present; retains Google LLC, ShadowWalker, Anthony Fu, and Serwist copyright attribution |
| `@serwist/next` | 9.5.12 | MIT | `node_modules/@serwist/next/LICENSE` | Full text present; same multiple-party attribution |
| `tailwindcss` | 4.3.3 | MIT | `node_modules/tailwindcss/LICENSE` | Full text present |
| `@tailwindcss/postcss` | 4.3.3 | MIT | `node_modules/@tailwindcss/postcss/LICENSE` | Full text present |

No separately named top-level `NOTICE` was found in these four package directories.

## Gaps and notice handling

1. **`server-only` 0.0.1:** the installed manifest declares MIT and identifies the React homepage/issue tracker, but the package contains no LICENSE or NOTICE file. Its `index.js` has only the client-import error and no copyright notice; `empty.js` is empty. Obtain a version-appropriate official notice/provenance record before claiming complete notice coverage. The missing file is not evidence of a noncommercial restriction, and substituting a generic MIT template would not establish the correct copyright holder.
2. **Lucide:** manifest SPDX `ISC` does not capture the separate MIT text for the named Feather-derived icons. Preserve the whole existing license file, not only its ISC section.
3. **Apache 2.0:** preserve the complete `class-variance-authority` license and its copyright/attribution. Its local text includes redistribution and modification-notice conditions. No separate NOTICE file was found; this observation does not waive notices introduced by future versions or other incorporated components.
4. **Bundled code:** the installed Next package contains additional license files under `node_modules/next/dist/compiled/`, including `webpack`, `edge-runtime`, `buffer`, and other components. The root Next MIT file is not evidence that all those components share one license. Their detailed review, all package transitives, optional/platform packages, and the remaining development toolchain are outside this task.
5. **Distribution:** this report identifies local evidence paths. It does not establish which dependency code survives tree-shaking, runs only on a server, appears in generated service workers/CSS, or is included in a release archive. Verify notices against the actual distributed output and preserve original texts as required. The earlier eight-entry UI notice manifest is a separately bounded collection; it must not be described as complete coverage of all 26 packages or their transitives without further packaging and checks.

The coordinating task subsequently copied all 25 available primary notices unchanged to `public/licenses/`. [direct-dependency-notices.json](../public/licenses/direct-dependency-notices.json) records the exact versions, source paths, destination files, SHA-256 hashes, and the unresolved `server-only` gap. All 25 source/copy pairs were verified byte-for-byte. The UI/font manifest remains a separate bounded index.

Keep versions and original notices synchronized with dependency updates. Repository-local availability of a license does not prove that it is included in a deployed artifact. This document is not an actual deployment SBOM, legal certification, copyright-free assertion, patent opinion, or trademark clearance. Uploaded media, external service terms, font rights, branded assets, and Kemtit branding require their separate evidence and reviews.
