import "server-only";

import { matchesDomainFilter, type DomainFilter } from "@/core/domain/domains";
import { periodOf, type Period, type PeriodType } from "@/core/domain/periods";
import { buildProgressIndex, paceStatus, type PaceStatus, type ProgressInfo } from "@/core/domain/progress";
import type { Task } from "@/core/tasks/schema";
import { type ISODate, todayBkk } from "@/lib/date";
import { createServerSupabase } from "@/lib/supabase/server";

import type { Goal, ParentCandidate } from "./schema";

export { candidatesFor } from "./candidates";

export type GoalWithProgress = Goal & { progress: ProgressInfo; period: Period; pace: PaceStatus };

export type GoalTreeNode = { goal: GoalWithProgress; children: GoalTreeNode[] };

const PERIOD_ORDER: Record<PeriodType, number> = { year: 0, quarter: 1, month: 2, week: 3, day: 4 };

function decorate(goals: Goal[], tasks: Pick<Task, "goal_id" | "completed_at" | "recurrence_rule">[], today: ISODate) {
  const index = buildProgressIndex(goals, tasks);
  return goals.map<GoalWithProgress>((goal) => {
    const progress = index.get(goal.id) ?? { percent: 0, kind: goal.goal_kind, childCount: 0 };
    const period = periodOf(goal.period_type, goal.period_start);
    return { ...goal, progress, period, pace: paceStatus(progress.percent, period, today) };
  });
}

/** goal ทั้งหมดของ user (RLS) พร้อม progress/pace — เรียงตามชั้นและวันเริ่ม */
export async function listGoalsWithProgress(options?: {
  includeArchived?: boolean;
  domainFilter?: DomainFilter;
}): Promise<GoalWithProgress[]> {
  const supabase = await createServerSupabase();
  let query = supabase.from("goals").select("*").order("period_start", { ascending: true }).order("created_at");
  if (!options?.includeArchived) query = query.neq("status", "archived");
  const [{ data: goals, error }, { data: tasks, error: taskError }] = await Promise.all([
    query,
    supabase.from("tasks").select("goal_id, completed_at, recurrence_rule").not("goal_id", "is", null),
  ]);
  if (error || taskError) {
    console.error("[goals] list failed", { code: error?.code ?? taskError?.code });
    return [];
  }
  const today = todayBkk();
  const decorated = decorate((goals ?? []) as Goal[], tasks ?? [], today)
    .filter((g) => matchesDomainFilter(g.domain, options?.domainFilter ?? "all"))
    .sort((a, b) => PERIOD_ORDER[a.period_type] - PERIOD_ORDER[b.period_type] || a.period_start.localeCompare(b.period_start));
  return decorated;
}

export function buildGoalTree(goals: GoalWithProgress[], rootId: string | null): GoalTreeNode[] {
  return goals
    .filter((g) => g.parent_id === rootId)
    .map((goal) => ({ goal, children: buildGoalTree(goals, goal.id) }));
}

export type GoalDetail = {
  goal: GoalWithProgress;
  parent: GoalWithProgress | null;
  tree: GoalTreeNode[];
  tasks: Task[];
};

export async function getGoalDetail(id: string): Promise<GoalDetail | null> {
  const [goals, tasksResult] = await Promise.all([
    listGoalsWithProgress({ includeArchived: true }),
    (await createServerSupabase()).from("tasks").select("*").eq("goal_id", id).order("due_date"),
  ]);
  const goal = goals.find((g) => g.id === id);
  if (!goal) return null;
  return {
    goal,
    parent: goal.parent_id ? (goals.find((g) => g.id === goal.parent_id) ?? null) : null,
    tree: buildGoalTree(goals, id),
    tasks: (tasksResult.data ?? []) as Task[],
  };
}

/** goal หลักเดือนนี้สำหรับ widget บนสุด (Design §8.4): metric ก่อน แล้วค่อย execution, เฉพาะ active */
export async function getMainMonthGoal(monthStart: ISODate): Promise<GoalWithProgress | null> {
  const goals = await listGoalsWithProgress();
  const monthGoals = goals.filter(
    (g) => g.period_type === "month" && g.period_start === monthStart && g.status !== "archived",
  );
  return monthGoals.find((g) => g.goal_kind === "metric") ?? monthGoals[0] ?? null;
}

/** ตัวเลือกเป้าหมายแม่: goal ชั้นบนถัดไปที่ยังไม่ archive — filter ช่วงทับกันในฟอร์ม */
export async function listParentCandidates(): Promise<ParentCandidate[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("goals")
    .select("id, title, period_type, period_start, domain")
    .neq("status", "archived")
    .order("period_start");
  if (error) return [];
  return (data ?? []) as ParentCandidate[];
}
