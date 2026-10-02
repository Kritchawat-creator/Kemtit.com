/**
 * Domain events (Scope §5.3) — ใช้ทั้งเป็น event log สำหรับ metric §14 (R13) และคิว side effect ของ LINE (M5)
 * payload ห้ามมี PII เกินจำเป็น (ไม่ใส่อีเมล/ชื่อ)
 */
export type EventPayloads = {
  "goal.created": { goalId: string; periodType: string; goalKind: string; fromTemplate?: boolean };
  "goal.completed": { goalId: string; title: string; periodType: string };
  "entry.logged": { goalId: string; entryId: string; amount: number; date: string };
  "task.completed": { taskId: string; goalId: string | null; date: string };
  "task.overdue": { taskIds: string[]; date: string };
  "daily.plan.ready": { date: string };
  "daily.brief": {
    date: string;
    workMode: "seller" | "professional";
    importantTaskTitles: string[];
    revenueRemaining: number | null;
    requiredDailyPace: number | null;
    plannedWorkloadMinutes: number | null;
    remainingCapacityMinutes: number | null;
  };
  "weekly.review.ready": { weekStart: string };
  "habit.reminder": { habitId: string; title: string; date: string };
  "investment.reminder": {
    goalId: string;
    title: string;
    monthlyTarget: number | null;
    date: string;
  };
  "onboarding.completed":
    | { persona: string }
    | { role: string; focusAreas: string[] };
  "line.linked": Record<string, never>;
  "line.unlinked": Record<string, never>;
  "persona.viewed": { persona: string };
  "notification.sent": {
    channel: "line";
    kind: string;
    dryRun: boolean;
    sourceEventId: string;
  };
};

export type EventType = keyof EventPayloads;

export const EVENT_TYPES = [
  "goal.created",
  "goal.completed",
  "entry.logged",
  "task.completed",
  "task.overdue",
  "daily.plan.ready",
  "daily.brief",
  "weekly.review.ready",
  "habit.reminder",
  "investment.reminder",
  "onboarding.completed",
  "line.linked",
  "line.unlinked",
  "persona.viewed",
  "notification.sent",
] as const satisfies readonly EventType[];
