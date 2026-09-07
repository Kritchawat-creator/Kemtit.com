import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  LayoutDashboard,
  NotebookPen,
  Settings,
  Target,
  type LucideIcon,
} from "lucide-react";

export type NavKey =
  "dashboard" | "goals" | "entries" | "tasks" | "calendar" | "reports" | "settings";

export type NavItem = {
  key: NavKey;
  href: string;
  icon: LucideIcon;
  /** "tasks" = จำนวนงานค้าง/ต้องทำวันนี้ (ซ่อนเมื่อ 0) · "pro" = ป้าย PRO คงที่ */
  badge?: "tasks" | "pro";
  /** เมนูที่ยังไม่เปิดใช้งานจริงใน POC (เช่น รายงาน Pro) — render เป็น span ไม่ใช่ลิงก์ */
  disabled?: boolean;
};

/**
 * เมนู sidebar desktop (Claude Design turn 7): กลุ่ม "หลัก" 5 รายการ + "เพิ่มเติม" 2 รายการ
 * แทนที่ NAV_ITEMS เดิม (4 แท็บ) — มือถือยังใช้ 4 แท็บเดิมผ่าน MOBILE_NAV_ITEMS ด้านล่าง ไม่เปลี่ยน
 */
export const NAV_SECTIONS: ReadonlyArray<{ key: "primary" | "more"; items: NavItem[] }> = [
  {
    key: "primary",
    items: [
      { key: "dashboard", href: "/dashboard", icon: LayoutDashboard },
      { key: "goals", href: "/goals", icon: Target },
      { key: "entries", href: "/entries", icon: NotebookPen },
      { key: "tasks", href: "/tasks", icon: CheckSquare, badge: "tasks" },
      { key: "calendar", href: "/calendar", icon: CalendarDays },
    ],
  },
  {
    key: "more",
    items: [
      { key: "reports", href: "#", icon: BarChart3, disabled: true, badge: "pro" },
      { key: "settings", href: "/settings", icon: Settings },
    ],
  },
];

/** 4 แท็บบนมือถือ (Design §8.1) — ลำดับเดียวกันทั้ง bottom nav และ sidebar เดิม ไม่เปลี่ยน */
export const MOBILE_NAV_ITEMS: ReadonlyArray<{ key: NavKey; href: string; icon: LucideIcon }> = [
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "goals", href: "/goals", icon: Target },
  { key: "calendar", href: "/calendar", icon: CalendarDays },
  { key: "settings", href: "/settings", icon: Settings },
];

/** alias ของเดิมไว้ให้ของที่ยังอ้างชื่อนี้ (text-search ยืนยันมีแค่ Sidebar/BottomNav ที่ import — ทั้งคู่แก้ตามด้านบนแล้ว) */
export const NAV_ITEMS = MOBILE_NAV_ITEMS;

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
