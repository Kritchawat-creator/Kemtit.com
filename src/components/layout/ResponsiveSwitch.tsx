"use client";

import type * as React from "react";

import { useIsDesktop } from "@/hooks/use-is-mobile";

type Props = {
  /** ต้นไม้มือถือ — server-render มาก่อนเป็น prop (เหมือน CalendarMonth) ไม่ใช่ import แบบ lazy */
  mobile: React.ReactNode;
  /** ต้นไม้ desktop — server-render มาก่อนเป็น prop เช่นกัน */
  desktop: React.ReactNode;
};

/**
 * สลับ mobile ↔ desktop ด้วย useIsDesktop() (§1.10) — เรนเดอร์ครั้งละ "ต้นไม้" เดียวเท่านั้น
 * ห้ามส่งทั้งสอง tree แล้วซ่อนด้วย CSS (`hidden lg:block` ฯลฯ): repo นี้เจอ Playwright strict mode ล้ม
 * มาแล้ว 2 ครั้งจากการซ่อนด้วย CSS (tracking-log รอบ 13 "สลับด้วย useIsMobile เพื่อไม่ให้ชื่องานซ้ำใน DOM"
 * และรอบ 14 "hiding ด้วย CSS ตัวเลข 40,000 ซ้ำใน DOM") — getByText ไม่กรอง element ที่ display:none
 * SSR/first paint ถือเป็นมือถือก่อนเสมอ (useIsDesktop() คืน false ตอน SSR) แล้วสลับเป็น desktop หลัง hydrate
 */
export function ResponsiveSwitch({ mobile, desktop }: Props): React.ReactNode {
  return useIsDesktop() ? desktop : mobile;
}
