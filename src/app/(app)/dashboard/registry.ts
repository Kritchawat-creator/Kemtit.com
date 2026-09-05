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
  /** จำนวนคอลัมน์บน desktop (grid 2 คอลัมน์ใน POC) */
  span: 1 | 2;
};

export const WIDGETS: Record<WidgetId, WidgetDefinition> = {
  "goal-progress": { id: "goal-progress", component: GoalProgressWidget, span: 1 },
  "today-tasks": { id: "today-tasks", component: TodayTasksWidget, span: 1 },
};

const DEFAULT_LAYOUT: WidgetId[] = ["goal-progress", "today-tasks"];

export function layoutForPersona(persona: PersonaId | null): WidgetDefinition[] {
  const ids = persona === "seller" ? DEFAULT_LAYOUT : DEFAULT_LAYOUT;
  return ids.map((id) => WIDGETS[id]);
}
