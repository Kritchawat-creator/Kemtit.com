import { CalendarDays, LayoutDashboard, Settings, Target, type LucideIcon } from "lucide-react";

export type NavKey = "dashboard" | "goals" | "calendar" | "settings";

/** 4 แท็บหลัก (Design §8.1) — ลำดับเดียวกันทั้ง bottom nav และ sidebar */
export const NAV_ITEMS: ReadonlyArray<{ key: NavKey; href: string; icon: LucideIcon }> = [
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "goals", href: "/goals", icon: Target },
  { key: "calendar", href: "/calendar", icon: CalendarDays },
  { key: "settings", href: "/settings", icon: Settings },
];

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
