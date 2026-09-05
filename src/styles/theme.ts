import { IBM_Plex_Sans_Thai } from "next/font/google";

/**
 * ค่า theme ที่ต้องใช้จาก JavaScript/Next metadata (อ่าน CSS variable ไม่ได้)
 * ทุกอย่างที่เป็นสี/ระยะ/ขนาดสำหรับ component อยู่ใน globals.css เท่านั้น
 */

/** IBM Plex Sans Thai (Design §4.1) — ผูกกับ --font-sans ใน globals.css ผ่านตัวแปรนี้ */
export const plexThai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-plex-thai",
});

/** ค่าเดียวกับ --color-brand-500 — ใช้กับ <meta name="theme-color"> และ manifest เท่านั้น */
export const brandThemeColor = "#7a5fe0";

/** ค่าเดียวกับ --color-neutral-50 (พื้นหน้า) — ใช้กับ manifest background_color เท่านั้น */
export const pageBackgroundColor = "#fbfaff";
