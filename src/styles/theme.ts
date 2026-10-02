import localFont from "next/font/local";

/**
 * ค่า theme ที่ต้องใช้จาก JavaScript/Next metadata (อ่าน CSS variable ไม่ได้)
 * ทุกอย่างที่เป็นสี/ระยะ/ขนาดสำหรับ component อยู่ใน globals.css เท่านั้น
 */

/**
 * IBM Plex Sans Thai (Design §4.1) — self-host ผ่าน next/font/local (ไฟล์ TTF ต้นฉบับจาก Google Fonts ใน src/styles/fonts; ไม่ทำ subset หรือ re-encode)
 * เหตุผล: next/font/google ดาวน์โหลดจาก Google ตอน build → build ล้มถ้าเครือข่าย/Google Fonts มีปัญหา และเพิ่ม LCP
 * ไฟล์ต้นฉบับและ OFL 1.1 provenance อยู่ใน src/styles/fonts/source-provenance.md — ผูกกับ --font-sans ใน globals.css ผ่านตัวแปรนี้
 */
export const plexThai = localFont({
  src: [
    { path: "./fonts/IBMPlexSansThai-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexSansThai-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/IBMPlexSansThai-SemiBold.ttf", weight: "600", style: "normal" },
  ],
  display: "swap",
  variable: "--font-plex-thai",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

/** ค่าเดียวกับ --color-brand-500 — ใช้กับ <meta name="theme-color"> และ manifest เท่านั้น */
export const brandThemeColor = "#6656e8";

/** ค่าเดียวกับ --color-neutral-50 (พื้นหน้า) — ใช้กับ manifest background_color เท่านั้น */
export const pageBackgroundColor = "#f5f7fb";
