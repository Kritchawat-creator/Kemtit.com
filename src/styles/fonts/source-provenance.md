# IBM Plex Sans Thai source provenance

The active IBM Plex Sans Thai files are unmodified upstream TTFs from the official
Google Fonts repository. They are pinned to commit
[`d935ac9235ee2071604dd67866959dc7528585d9`](https://github.com/google/fonts/commit/d935ac9235ee2071604dd67866959dc7528585d9)
and mirrored byte-for-byte in both `src/styles/fonts/` and
`docs/prototypes/planner-vnext/fonts/`.

| File | Weight | Exact upstream URL | SHA-256 |
| --- | ---: | --- | --- |
| `IBMPlexSansThai-Regular.ttf` | 400 | https://raw.githubusercontent.com/google/fonts/d935ac9235ee2071604dd67866959dc7528585d9/ofl/ibmplexsansthai/IBMPlexSansThai-Regular.ttf | `eee061d1bac39be40f9bb94498898cd1894f5d3d9a2f0ee6cbd48a6bd03d052b` |
| `IBMPlexSansThai-Medium.ttf` | 500 | https://raw.githubusercontent.com/google/fonts/d935ac9235ee2071604dd67866959dc7528585d9/ofl/ibmplexsansthai/IBMPlexSansThai-Medium.ttf | `46ba1b7365cc2c583914f23914cce46e836a72662e34f6e3029b15aaa10b792e` |
| `IBMPlexSansThai-SemiBold.ttf` | 600 | https://raw.githubusercontent.com/google/fonts/d935ac9235ee2071604dd67866959dc7528585d9/ofl/ibmplexsansthai/IBMPlexSansThai-SemiBold.ttf | `9d7526a0c8dfad63c49815d0cce9eea1026f018468b81c579997e953620a67d3` |
| `OFL.txt` | license | https://raw.githubusercontent.com/google/fonts/d935ac9235ee2071604dd67866959dc7528585d9/ofl/ibmplexsansthai/OFL.txt | `7e6b2818edbd8f6a01ae80641cc8f16a51080d08fb4e532be3a0b6f74adb07da` |

The pre-existing WOFF2 files remain only in `src/styles/fonts/` as legacy historical
assets; they are not referenced by production `next/font/local` and are not served
by the standalone prototype. The prototype copies were removed because its font
directory is served wholesale. The active files in both setups are the TTFs above.
