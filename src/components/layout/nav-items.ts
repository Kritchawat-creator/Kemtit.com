import {
  CalendarDays,
  ClipboardCheck,
  FolderKanban,
  HeartPulse,
  Inbox,
  LayoutDashboard,
  MoreHorizontal,
  Plus,
  Settings,
  ShoppingBag,
  Target,
  RefreshCw,
  WalletCards,
  type LucideIcon,
} from "@/components/icons/ui-icons";

import type { WorkMode } from "@/core/profile/work-modes";

export type NavKey =
  | "today"
  | "plan"
  | "insights"
  | "more"
  | "inbox"
  | "quickAdd"
  | "goals"
  | "calendar"
  | "reviews"
  | "life"
  | "finance"
  | "projects"
  | "workSales"
  | "dashboard"
  | "entries"
  | "tasks"
  | "reports"
  | "rescue"
  | "settings";

export type NavItem = {
  key: NavKey;
  href: string;
  icon: LucideIcon;
  badge?: "tasks" | "pro";
  disabled?: boolean;
};

export type NavSection = {
  key: "primary" | "context" | "more";
  items: NavItem[];
};

const PRIMARY_ITEMS: NavItem[] = [
  { key: "today", href: "/today", icon: LayoutDashboard },
  { key: "plan", href: "/plan", icon: CalendarDays },
  { key: "inbox", href: "/inbox", icon: Inbox },
  { key: "calendar", href: "/calendar", icon: CalendarDays },
  { key: "insights", href: "/insights", icon: ClipboardCheck },
];

const LIFE_ITEMS: NavItem[] = [
  { key: "goals", href: "/goals", icon: Target },
  { key: "reviews", href: "/reviews", icon: ClipboardCheck },
  { key: "life", href: "/life", icon: HeartPulse },
  { key: "finance", href: "/finance", icon: WalletCards },
];

const MORE_ITEMS: NavItem[] = [
  { key: "rescue", href: "/rescue", icon: RefreshCw },
  { key: "settings", href: "/settings", icon: Settings },
];

/** Desktop keeps operational surfaces visible while contextual modules remain grouped. */
export function navigationForWorkMode(workMode: WorkMode | null): NavSection[] {
  const workItems: NavItem[] =
    workMode === "professional"
      ? [{ key: "projects", href: "/work/projects", icon: FolderKanban }]
      : workMode === "seller"
        ? [{ key: "workSales", href: "/work/sales", icon: ShoppingBag }]
        : [];

  return [
    { key: "primary", items: PRIMARY_ITEMS },
    { key: "context", items: [...workItems, ...LIFE_ITEMS] },
    { key: "more", items: MORE_ITEMS },
  ];
}

export const NAV_SECTIONS = navigationForWorkMode(null);

/** Tablet keeps the five most-used destinations and the More hub. */
export const TABLET_NAV_ITEMS: ReadonlyArray<NavItem> = [
  ...PRIMARY_ITEMS,
  { key: "more", href: "/more", icon: MoreHorizontal },
];

/** Product core loop: Today → Plan → Capture → Insights → More. */
export const MOBILE_NAV_ITEMS: ReadonlyArray<{
  key: NavKey;
  href: string;
  icon: LucideIcon;
  quick?: boolean;
}> = [
  { key: "today", href: "/today", icon: LayoutDashboard },
  { key: "plan", href: "/plan", icon: CalendarDays },
  { key: "quickAdd", href: "#quick-add", icon: Plus, quick: true },
  { key: "insights", href: "/insights", icon: ClipboardCheck },
  { key: "more", href: "/more", icon: MoreHorizontal },
];

export const NAV_ITEMS = MOBILE_NAV_ITEMS;

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
