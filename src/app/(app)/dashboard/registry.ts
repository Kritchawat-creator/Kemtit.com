import type { PersonaId } from "@/core/profile/personas";
import type { ISODate } from "@/lib/date";
import { GoalProgressWidget } from "@/components/widgets/GoalProgressWidget";
import { TodayTasksWidget } from "@/components/widgets/TodayTasksWidget";

/**
 * Widget registry (composition root — app/ เป็นชั้นเดียวที่รู้จักทั้ง core และ modules)
 * POC (Decision 3): layout คงที่ 2 widget ทุก persona — GoalProgress บนสุดเสมอ (Design §8.4)
 * MVP: เพิ่ม widget ต่อ persona + react-grid-layout + dashboard_layouts ที่นี่จุดเดียว
 */
export type WidgetId = "goal-progress" | "today-tasks";

export type WidgetDefinition = {
  id: WidgetId;
  component: (props: { today: ISODate }) => Promise<React.JSX.Element>;
  /** จำนวนคอลัมน์บน desktop (grid 12 คอลัมน์ — Claude Design turn 4: ยอดขาย 8 / งานวันนี้ 4) */
  span: 4 | 8 | 12;
};

export const WIDGETS: Record<WidgetId, WidgetDefinition> = {
  "goal-progress": { id: "goal-progress", component: GoalProgressWidget, span: 8 },
  "today-tasks": { id: "today-tasks", component: TodayTasksWidget, span: 4 },
};

/** class คงที่ต่อ span (Tailwind ไม่ทำ class แบบ dynamic) */
export const SPAN_CLASS: Record<WidgetDefinition["span"], string> = {
  4: "lg:col-span-4",
  8: "lg:col-span-8",
  12: "lg:col-span-12",
};

const DEFAULT_LAYOUT: WidgetId[] = ["goal-progress", "today-tasks"];

export function layoutForPersona(persona: PersonaId | null): WidgetDefinition[] {
  const ids = persona === "seller" ? DEFAULT_LAYOUT : DEFAULT_LAYOUT;
  return ids.map((id) => WIDGETS[id]);
}
