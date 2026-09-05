import { getRequestConfig } from "next-intl/server";

/**
 * next-intl แบบ "without i18n routing" — ภาษาเดียว (ไทย) ไม่มี [locale] segment ใน app/
 * (POC Decisions M0 ข้อ 6, Design §12) — เพิ่มภาษาอื่นภายหลังได้โดยเปลี่ยนที่นี่จุดเดียว
 */
export const APP_LOCALE = "th" as const;
export const APP_TIME_ZONE = "Asia/Bangkok" as const;

export default getRequestConfig(async () => ({
  locale: APP_LOCALE,
  timeZone: APP_TIME_ZONE,
  messages: (await import("../messages/th.json")).default,
}));
