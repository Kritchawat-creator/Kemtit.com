import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";
import storybook from "eslint-plugin-storybook";
import prettier from "eslint-config-prettier/flat";

/**
 * Persona modules — เพิ่มชื่อเมื่อมี module ใหม่ (creator, student, office)
 * ใช้สร้างกฎ "modules/* ห้าม import กันเอง" (Scope §4, POC Decisions M0 ข้อ 4)
 */
const MODULES = ["seller"];

const SRC = "src/**/*.{ts,tsx}";
const files = (...globs) => globs.map((g) => `src/${g}/**/*.{ts,tsx}`);

/** helper: กฎ no-restricted-imports สำหรับกลุ่มไฟล์ */
const restrictImports = (fileGlobs, patterns) => ({
  files: fileGlobs,
  rules: { "no-restricted-imports": ["error", { patterns }] },
});

const HEX_COLOR = "/#[0-9a-fA-F]{3,8}\\b/";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // eslint-config-next ลงทะเบียน plugin jsx-a11y ไว้แล้ว — เปิดชุด recommended เต็มเป็น error โดยไม่ลงทะเบียนซ้ำ (Design §15)
  { files: [SRC], rules: { ...jsxA11y.flatConfigs.recommended.rules } },
  ...storybook.configs["flat/recommended"],

  /* ---------- Architecture boundaries (Scope §4) ---------- */

  // core/ คือ shared kernel — ห้ามรู้จัก modules/ และ shared-services/
  restrictImports(files("core"), [
    {
      group: ["@/modules/**", "@/shared-services/**", "**/modules/**", "**/shared-services/**"],
      message:
        "core/ ห้าม import modules/ หรือ shared-services/ — ให้ modules เรียก core ไม่ใช่กลับกัน (Scope §4)",
    },
  ]),

  // modules/, shared-services/, components/ ห้ามแตะ Supabase ตรง ๆ — ผ่าน core/ports หรือ server action ใน core/
  restrictImports(files("modules", "shared-services", "components"), [
    {
      group: ["@supabase/*", "@/lib/supabase/**", "**/lib/supabase/**"],
      message:
        "ห้าม import Supabase ตรง ๆ ในชั้นนี้ — ผ่าน core/ports หรือ server action ใน core/ (POC Decisions M0 ข้อ 4)",
    },
  ]),

  // modules/<m> ห้าม import modules/<อื่น> — ทั้งผ่าน alias และ relative path
  ...MODULES.map((m) => {
    const others = MODULES.filter((x) => x !== m);
    return restrictImports(
      [`src/modules/${m}/**/*.{ts,tsx}`],
      [
        {
          group: ["@/modules/*", "@/modules/*/**", `!@/modules/${m}`, `!@/modules/${m}/**`],
          message: `modules/${m} ห้าม import module อื่น — สื่อสารผ่าน core/ports หรือ domain_events (Scope §4)`,
        },
        {
          regex: `^(\\.\\./)+(${others.length ? others.join("|") : "__no_other_module__"})(/|$)`,
          message: `modules/${m} ห้าม import module อื่นผ่าน relative path (Scope §4)`,
        },
      ],
    );
  }),

  /* ---------- Design system rules (Design §16 DoD) ---------- */

  // ห้าม hex สีดิบใน component/module/route — ต้องผ่าน semantic token ใน globals.css
  {
    files: files("components", "modules", "app", "shared-services"),
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `Literal[value=${HEX_COLOR}]`,
          message: "ห้ามใช้ hex สีดิบ — ใช้ semantic token จาก globals.css (Design §3.4)",
        },
        {
          selector: `TemplateElement[value.raw=${HEX_COLOR}]`,
          message: "ห้ามใช้ hex สีดิบ — ใช้ semantic token จาก globals.css (Design §3.4)",
        },
      ],
    },
  },

  // server-only env ห้ามหลุดไปฝั่ง client ผ่าน import ผิดที่
  restrictImports(files("components"), [
    {
      group: ["@/lib/env.server", "**/env.server"],
      message: "components/ ห้าม import env.server — รับค่าผ่าน props จาก Server Component",
    },
  ]),

  prettier,

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "storybook-static/**",
    "playwright-report/**",
    "test-results/**",
    "supabase/.temp/**",
    ".gitnexus/**",
  ]),
]);

// SRC ถูกใช้ผ่าน files(); export ไว้ให้ config อื่นอ้างได้
export { SRC };
export default eslintConfig;
