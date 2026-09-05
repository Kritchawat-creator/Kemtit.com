/**
 * Domain events (Scope §5.3) — ใช้ทั้งเป็น event log สำหรับ metric §14 (R13) และคิว side effect ของ LINE (M5)
 * payload ห้ามมี PII เกินจำเป็น (ไม่ใส่อีเมล/ชื่อ)
 */
export type EventPayloads = {
  "goal.created": { goalId: string; periodType: string; goalKind: string; fromTemplate?: boolean };
  "goal.completed": { goalId: string; title: string; periodType: string };
  "task.completed": { taskId: string; goalId: string | null; date: string };
  "task.overdue": { taskIds: string[]; date: string };
  "onboarding.completed": { persona: string };
  "line.linked": Record<string, never>;
  "line.unlinked": Record<string, never>;
  "persona.viewed": { persona: string };
  "notification.sent": { channel: "line"; kind: string; dryRun: boolean };
};

export type EventType = keyof EventPayloads;

export const EVENT_TYPES = [
  "goal.created",
  "goal.completed",
  "task.completed",
  "task.overdue",
  "onboarding.completed",
  "line.linked",
  "line.unlinked",
  "persona.viewed",
  "notification.sent",
] as const satisfies readonly EventType[];
