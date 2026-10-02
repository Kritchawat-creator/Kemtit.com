# Third-party UI asset notices

Recorded 2026-09-22. This file covers fonts, icons and direct rendered UI libraries reviewed for the planner design work. It is not a complete software bill of materials or a trademark clearance opinion.

| Component | License | Full notice |
| --- | --- | --- |
| IBM Plex Sans Thai | SIL Open Font License 1.1 | [Distributed font license](public/licenses/IBM-Plex-Sans-Thai-OFL.txt); [pinned source and hashes](src/styles/fonts/source-provenance.md) |
| Lucide icons, including Feather-derived icons | ISC and inherited MIT notices | [Lucide notice](public/licenses/lucide-react-LICENSE.txt) |
| Radix UI | MIT | [Radix notice](public/licenses/radix-ui-LICENSE.txt) |
| React DayPicker | MIT | [DayPicker notice](public/licenses/react-day-picker-LICENSE.txt) |
| Sonner | MIT | [Sonner notice](public/licenses/sonner-LICENSE.txt) |
| Input OTP | MIT | [Input OTP notice](public/licenses/input-otp-LICENSE.txt) |
| Motion | MIT | [Motion notice](public/licenses/motion-LICENSE.txt) |
| tw-animate-css | MIT | [Animation CSS notice](public/licenses/tw-animate-css-LICENSE.txt) |
| shadcn/ui source components | MIT; exact copied registry revision not established | [shadcn notice](public/licenses/shadcn-ui-LICENSE.txt) |

Installed versions, source files and notice hashes are recorded in [ui-notices.json](public/licenses/ui-notices.json). The notices retain their original copyright statements and permissions. Their inclusion does not relicense Kemtit or grant rights to third-party trademarks.

The extended [direct dependency inventory](docs/direct-dependency-license-inventory-2026-09-22.md) covers 22 runtime packages and four selected output-generating build packages. The 25 available primary license texts are also copied to `public/licenses/` with their source paths and hashes in [direct-dependency-notices.json](public/licenses/direct-dependency-notices.json). `server-only` 0.0.1 declares MIT but lacks a full notice in its installed package; the exact upstream notice remains unresolved. Bundled/transitive code and actual deployment output are not covered by this inventory.

The planner prototype distributes its own font and icon notices alongside its local assets. The Google sign-in button is a separately governed branded asset; see [Google's guidelines](https://developers.google.com/identity/branding-guidelines) and the prototype's asset provenance. Google assets are not covered by the font or Lucide licenses.

Project-specific marks and user-supplied media are tracked separately in the [asset rights audit](docs/asset-rights-audit-2026-09-22.md). See the [asset usage policy](docs/asset-usage-policy.md) before adding, replacing or publishing assets.
