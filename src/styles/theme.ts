import localFont from "next/font/local";

/**
 * ค่า theme ที่ต้องใช้จาก JavaScript/Next metadata (อ่าน CSS variable ไม่ได้)
 * ทุกอย่างที่เป็นสี/ระยะ/ขนาดสำหรับ component อยู่ใน globals.css เท่านั้น
 */

/**
 * IBM Plex Sans Thai (Design §4.1) — self-host ผ่าน next/font/local (ไฟล์ woff2 subset thai+latin ใน src/styles/fonts)
 * เหตุผล: next/font/google ดาวน์โหลดจาก Google ตอน build → build ล้มถ้าเครือข่าย/Google Fonts มีปัญหา และเพิ่ม LCP
 * ไฟล์มาจาก google-webfonts-helper (OFL 1.1) — ผูกกับ --font-sans ใน globals.css ผ่านตัวแปรนี้
 */
export const plexThai = localFont({
  src: [
    { path: "./fonts/IBMPlexSansThai-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexSansThai-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/IBMPlexSansThai-600.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
  variable: "--font-plex-thai",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

/** ค่าเดียวกับ --color-brand-500 — ใช้กับ <meta name="theme-color"> และ manifest เท่านั้น */
export const brandThemeColor = "#7a5fe0";

/** ค่าเดียวกับ --color-neutral-50 (พื้นหน้า) — ใช้กับ manifest background_color เท่านั้น */
export const pageBackgroundColor = "#fbfaff";
