import type { ISODate } from "@/lib/date";

import { elapsedRatio, type Period } from "./periods";

/**
 * Progress rollup (POC Decisions 1.1-1.2) — pure function ไม่แตะ DB
 * - metric: current_value / target_value ที่ user กรอก — ไม่นับ task ลูกแม้มี task ผูก
 * - execution: ค่าเฉลี่ยน้ำหนักเท่ากันของ [progress ของ child goal แต่ละตัว, อัตราส่วน task ตรงที่เสร็จ (ถ้ามี task)]
 * - task ซ้ำ (recurrence_rule) ไม่นับเข้า execution progress — เป็น routine ไม่มีจุด "เสร็จ" (บันทึกใน implementation-plan)
 * คืนค่าเป็นเปอร์เซ็นต์ 0-100 ตาม snippet ใน Decision
 */
export type GoalKind = "metric" | "execution";

export type GoalLike = {
  id: string;
  parent_id: string | null;
  goal_kind: GoalKind;
  target_value: number | null;
  current_value: number;
};

export type TaskLike = {
  goal_id: string | null;
  completed_at: string | null;
  recurrence_rule: string | null;
};

export function computeProgress(goal: GoalLike, children: GoalLike[], tasks: TaskLike[]): number;
export function computeProgress(
  goal: GoalLike,
  children: GoalLike[],
  tasks: TaskLike[],
  resolveChild: (child: GoalLike) => number,
): number;
export function computeProgress(
  goal: GoalLike,
  children: GoalLike[],
  tasks: TaskLike[],
  resolveChild?: (child: GoalLike) => number,
): number {
  if (goal.goal_kind === "metric") {
    if (!goal.target_value || goal.target_value <= 0) return 0;
    return Math.min(100, (goal.current_value / goal.target_value) * 100);
  }
  const childProgress = children.map((c) => (resolveChild ? resolveChild(c) : computeProgress(c, [], [])));
  const countable = tasks.filter((t) => t.recurrence_rule === null);
  const taskProgress = countable.length
    ? (countable.filter((t) => t.completed_at).length / countable.length) * 100
    : null;
  const parts = [...childProgress, ...(taskProgress !== null ? [taskProgress] : [])];
  return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
}

export type ProgressInfo = {
  /** 0-100 */
  percent: number;
  kind: GoalKind;
  /** metric */
  current?: number;
  target?: number;
  /** execution */
  tasksDone?: number;
  tasksTotal?: number;
  childCount: number;
};

/** คำนวณ progress ของทุก goal ใน list แบบ bottom-up ครั้งเดียว (ใช้กับหน้า list/tree) */
export function buildProgressIndex(goals: GoalLike[], tasks: TaskLike[]): Map<string, ProgressInfo> {
  const byParent = new Map<string | null, GoalLike[]>();
  for (const g of goals) {
    const list = byParent.get(g.parent_id) ?? [];
    list.push(g);
    byParent.set(g.parent_id, list);
  }
  const tasksByGoal = new Map<string, TaskLike[]>();
  for (const t of tasks) {
    if (!t.goal_id) continue;
    const list = tasksByGoal.get(t.goal_id) ?? [];
    list.push(t);
    tasksByGoal.set(t.goal_id, list);
  }

  const memo = new Map<string, ProgressInfo>();
  const visiting = new Set<string>();

  const resolve = (goal: GoalLike): ProgressInfo => {
    const cached = memo.get(goal.id);
    if (cached) return cached;
    if (visiting.has(goal.id)) {
      // กันวงจร (ไม่ควรเกิดเพราะ DB ตรวจ parent) — ถือว่า 0
      return { percent: 0, kind: goal.goal_kind, childCount: 0 };
    }
    visiting.add(goal.id);

    const children = byParent.get(goal.id) ?? [];
    const own = tasksByGoal.get(goal.id) ?? [];
    const percent = computeProgress(goal, children, own, (child) => resolve(child).percent);
    const countable = own.filter((t) => t.recurrence_rule === null);
    const info: ProgressInfo = {
      percent,
      kind: goal.goal_kind,
      childCount: children.length,
      ...(goal.goal_kind === "metric"
        ? { current: goal.current_value, target: goal.target_value ?? 0 }
        : { tasksDone: countable.filter((t) => t.completed_at).length, tasksTotal: countable.length }),
    };
    visiting.delete(goal.id);
    memo.set(goal.id, info);
    return info;
  };

  for (const g of goals) resolve(g);
  return memo;
}

export type PaceStatus = "notStarted" | "onTrack" | "behind" | "done";

/**
 * "ตกเป้า" (Design §8.2 สี warning): % จริง < % เวลาที่ผ่านไป − 10 จุด ระหว่าง period ยัง active (Q8)
 */
export function paceStatus(percent: number, period: Period, today: ISODate): PaceStatus {
  if (percent >= 100) return "done";
  const elapsed = elapsedRatio(period, today) * 100;
  if (elapsed === 0) return "notStarted";
  return percent < elapsed - 10 ? "behind" : "onTrack";
}

/** metric goal สำเร็จเมื่อ current ≥ target */
export function isMetricComplete(goal: Pick<GoalLike, "goal_kind" | "target_value" | "current_value">): boolean {
  return goal.goal_kind === "metric" && goal.target_value !== null && goal.current_value >= goal.target_value;
}
