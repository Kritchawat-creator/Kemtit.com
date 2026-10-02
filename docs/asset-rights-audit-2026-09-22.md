# UI asset rights inventory — 2026-09-22

Status: **bounded asset remediation and local verification completed; wider rights gaps remain explicit**. The initial inventory below is retained as dated evidence. Active fonts, prototype icon geometry, and the Google button were subsequently replaced and checked as recorded in the remediation section. This is not clearance of the entire system or its trademarks.

## Scope and evidence

Inspected static assets and rendering references under `src/`, `public/`, and `docs/prototypes/planner-vnext/`, the icon generator, UI package manifests, and the local license files listed below. This is a UI asset review, not a complete audit of all direct and transitive dependencies, external services, historical design inputs, or uploaded content. No build or installation was performed for this inventory.

GitNexus was queried first for font, asset, image, icon, and logo use. It returned prototype icon flows. A subsequent status check reported `incremental-in-progress` and an incomplete/stale index, so the inventory does not claim complete graph coverage. Literal file and source searches supplied the evidence below.

## Static assets

The following table records the **initial** inspection. Its “in progress” entries are historical findings; the completed work and remaining gaps are reconciled below.

| Asset | Evidence at inspection | Status / action |
| --- | --- | --- |
| IBM Plex Sans Thai, weights 400/500/600 | `src/styles/theme.ts` loads `src/styles/fonts/IBMPlexSansThai-{400,500,600}.woff2`. The three-line `src/styles/fonts/LICENSE.txt` names IBM, Reserved Font Name “Plex”, SIL OFL 1.1, and google-webfonts-helper v11. | The local origin statement was not independent download verification. The three-line notice does **not** contain the full OFL license. **Remediation in progress:** replace with official Google Fonts original TTFs and package the full family OFL notice. |
| Prototype font copies | `docs/prototypes/planner-vnext/styles.css` loads the three WOFF2s in its `fonts/` directory. Their SHA-256 hashes exactly match the production copies. | No prototype font license file existed at inspection. **Remediation in progress:** official original TTFs and full OFL notice in the standalone prototype distribution. |
| Production Lucide icons | `lucide-react` imports throughout navigation, domain components, and `src/components/ui/`; installed version 1.41.0. | Local upstream license includes ISC and a separate MIT notice for Feather-derived icons. Preserve **both** complete notices when distributing the icons. |
| Prototype SVG icons | `ICON_PATHS` in `docs/prototypes/planner-vnext/app.js` contains inline geometric paths, rendered by `icon()`. | No attribution/provenance record was present for these paths. Appearance alone does not establish originality. **Remediation in progress:** canonical Lucide paths and full ISC/MIT notices. |
| Google sign-in mark | Two remote `g-logo.png` references in `docs/prototypes/planner-vnext/extras.js`, in the login button and simulated sign-in dialog. | Brand permission is separate from open-source licensing. **Remediation in progress:** replace with an official pre-approved Google button asset and record its source and branding conditions. Final implementation still needs verification. The original remote image also caused a network request despite the demo's no-data-leaves-browser wording. |
| Kemtit compass mark and application icons | `src/app/icon.svg`; inline geometric marks in `src/components/layout/Sidebar.tsx` and `NavigationRail.tsx`; `scripts/generate-icons.mjs` contains the construction for four PNGs in `public/icons/`. | Local construction is visible, but independent authorship, rights ownership, and brand/trademark clearance are **unverified**. The PNGs were not regenerated or compared with generator output during this audit. |
| Custom illustrations, charts, and decoration | Inline geometry in `src/components/domain/EmptyState.tsx`, `CompassDial.tsx`, `SalesChart.tsx`, and `ProgressRing.tsx`; prototype CSS/SVG decoration. | Project source is available. This does not independently certify originality or absence of third-party rights. Preserve source/provenance records for imported or commissioned designs. |
| Static photography, stock illustrations, video/audio | No such media files were found in the audited `src/`, `public/`, or prototype directories. The Storybook task-photo fixture uses a simple inline SVG. | This finding is restricted to the inspected local paths. It does not cover hosted, dynamically loaded, historical, or uploaded media. |

Original WOFF2 hashes, retained as inspection evidence rather than final replacement hashes:

| Weight | SHA-256, identical in production and prototype |
| --- | --- |
| 400 | `4c411f047c428be51c27c88a7573cd80c9121e1873751efd54c7a257437e8219` |
| 500 | `11b508d5887b1f274f4a1710885c026ab337b7682e7f15918ee2f5dc98e78241` |
| 600 | `d075db9eacd2f8ea99f325b58f59ebb243d0ebebdbf29e0c2b12d84159ae679c` |

## Rendered UI packages and notices

Versions below came from installed package manifests. The listed local license files were inspected; package metadata alone is not a substitute for the full notice. This table is deliberately limited to the rendered UI and asset packages identified in this review.

| Package | Installed version | Local license evidence | Rendering use |
| --- | --- | --- | --- |
| `lucide-react` | 1.41.0 | `node_modules/lucide-react/LICENSE`: ISC plus MIT/Feather notice | Navigation and component SVG icons |
| `radix-ui` | 1.6.7 | `node_modules/radix-ui/LICENSE`: MIT, WorkOS | UI primitives in `src/components/ui/` |
| `react-day-picker` | 10.0.1 | `node_modules/react-day-picker/LICENSE`: MIT, Giampaolo Bellavite and contributors | `src/components/ui/calendar.tsx` |
| `sonner` | 2.0.8 | `node_modules/sonner/LICENSE.md`: MIT, Emil Kowalski | Toast UI and `src/components/ui/sonner.tsx` |
| `input-otp` | 1.5.0 | `node_modules/input-otp/LICENSE`: MIT, Guilherme Rodz | OTP UI in `src/components/ui/input-otp.tsx` |
| `motion` | 13.2.0 | `node_modules/motion/LICENSE.md`: MIT, Motion B.V. | `src/components/domain/Celebration.tsx` |
| `tw-animate-css` | 1.4.0 | `node_modules/tw-animate-css/LICENSE`: MIT, Wombosvideo | CSS import in `src/styles/globals.css` |

`components.json` identifies shadcn and the Lucide icon library. Source comments also identify generated shadcn UI components. No checked-in full shadcn notice was found in the initial bounded search, and no installed `node_modules/shadcn` package was present. The coordinating task has now added the official upstream MIT notice as `public/licenses/shadcn-ui-LICENSE.txt`, retrieved on 2026-09-22. The exact copied registry revision remains unestablished; the current upstream notice does not resolve that provenance gap by itself.

The coordinating task has packaged the seven installed package notices above and the shadcn notice in `public/licenses/`. `public/licenses/ui-notices.json` records their versions, source paths/URL, destination files, and hashes, with an explicit bounded-scope statement. A follow-up check verified all eight file hashes against that manifest and verified that all seven installed package copies match their respective `node_modules` source files byte-for-byte. Lucide's packaged file includes the inherited MIT section. This verifies local packaging; the production deployment output was not inspected.

Keep the upstream copyright and license text intact in distributable third-party notices. Retain a source URL, version or pinned revision, and final asset hash for vendored files, and keep the manifest synchronized with dependency or asset updates.

## Completed remediation and verification

- **Active fonts:** production `src/styles/theme.ts` and prototype `styles.css` now reference original IBM Plex Sans Thai Regular/Medium/SemiBold TTFs from pinned Google Fonts commit `d935ac9235ee2071604dd67866959dc7528585d9`. All three font hashes and the full OFL hash match [source provenance](../src/styles/fonts/source-provenance.md); production/prototype pairs are byte-identical. The OFL retains IBM's copyright, Reserved Font Name “Plex”, all conditions, termination, and disclaimer. An additional copy is served from `public/licenses/IBM-Plex-Sans-Thai-OFL.txt`.
- **Legacy fonts:** unused prototype WOFF2s were removed from the served folder. Pre-existing production WOFF2s remain untouched as inactive historical files; their short `LICENSE.txt` is now explicitly labeled legacy-only. The active configuration does not reference them.
- **Prototype icons:** all 49 `ICON_PATHS` keys now map to canonical installed Lucide 1.41.0 SVG geometry. The full ISC and inherited MIT license was copied byte-for-byte. [Icon mapping and asset provenance](prototypes/planner-vnext/licenses/README.md) identifies every source icon. This does not establish exclusive trademark rights in those shared icon shapes.
- **Google button:** the unchanged official whole-button PNG is stored locally, SHA-256 `892062091f35e69dd838ba4a4f238d37a0562d52ecda6406eb343a1127251409`, dimensions 354 × 80. Browser verification confirmed rendering at 177 × 40 with its original ratio. The separate G in the demo dialog and runtime Google hotlinks were removed. The demo explicitly says it does not connect an account; production OAuth is not implemented by this change.
- **Notices:** the UI/font manifest now contains nine entries including the font notice. An additional [direct dependency inventory](direct-dependency-license-inventory-2026-09-22.md) covers all 22 runtime dependencies and four selected output-generating build dependencies. The 25 available primary notices are copied with matching hashes; `server-only` 0.0.1 declares MIT but its exact full notice remains unresolved. Bundled/transitive dependencies and actual release output were not cleared.
- **UI verification:** the final `nav4` assets were checked across 21 routes on desktop and a confirmed 390 × 844 viewport. All had headings, no page-level horizontal overflow, and no visible browser-default outset buttons. No new browser console errors were observed in this pass. The Google cancel/simulated-success flow still works. See [prototype QA](prototypes/planner-vnext/QA.md).

## Content and branding outside static clearance

`AvatarSlot.tsx`, `TaskPhotos.tsx`, `ImageSlot.tsx`, and `PhotoViewer.tsx` render user-supplied image URLs or uploaded files. Their contents and permissions are **unverified** by a repository inspection. Product terms and the content-handling workflow must address uploaded material separately; an application dependency license does not grant rights to those images.

The Kemtit name, compass design, and any third-party brands require separate consideration from software and font licenses. No trademark search, registration review, commissioned-design agreement review, or legal clearance was performed. A Google-provided sign-in asset remains subject to Google's branding conditions; it is not a general-purpose or copyright-free logo.

## Official reference sources

The coordinating task verified the following official references for remediation:

- [Google Fonts IBM Plex Sans Thai family OFL](https://github.com/google/fonts/blob/main/ofl/ibmplexsansthai/OFL.txt)
- [SIL Open Font License FAQ](https://openfontlicense.org/ofl-faq/)
- [Google identity branding guidelines](https://developers.google.com/identity/branding-guidelines)

The final local asset checks above complete the bounded remediation. The listed dependency, uploaded-content, authorship, deployment, and brand-clearance gaps remain open. This inventory is not a legal certification and does not assert that the entire system is copyright-free or guaranteed not to infringe third-party rights.
