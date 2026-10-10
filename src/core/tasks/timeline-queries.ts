import "server-only";

import { COUNTED_DATA_ORIGINS } from "@/core/shared/data-origin";
import { domainInScope, type Scope } from "@/core/profile/scope";
import type { DayTaskItem } from "@/core/domain/dayplan";
import { QueryError } from "@/core/shared/query-error";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ISODate } from "@/lib/date";

import { getTaskCardData } from "./card-queries";
import type { TaskWithGoal } from "./schema";

const TASK_QUERY_BATCH = 500;
const TASK_TRAY_LIMIT = 200;

export type TimelineTaskGroup = { id: string; title: string; position: number };

/**
 * Build the Calendar tray from all active canonical tasks and only the actionable
 * recurring occurrences for the selected date. Occurrence source dates stay
 * immutable; scheduled dates are represented by the selected day-plan items.
 */
export async function getTimelineBoardItems(
  dayItems: DayTaskItem<TaskWithGoal>[],
  scope: Scope,
  selectedDate: ISODate,
) {
  const supabase = await createServerSupabase();
  let taskQuery = supabase
    .from("tasks")
    .select("*, goal:goals(id, title)")
    .in("data_origin", [...COUNTED_DATA_ORIGINS])
    .in("status", ["inbox", "planned"])
    .is("archived_at", null)
    .is("deleted_at", null)
    .is("completed_at", null)
    .order("planned_date", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false })
    .order("id");
  if (scope === "work") taskQuery = taskQuery.eq("domain", "work");
  else if (scope === "life") taskQuery = taskQuery.neq("domain", "work");
  const { data: taskRows, error: taskError } = await taskQuery.limit(TASK_TRAY_LIMIT + 1);
  if (taskError) {
    console.error("[calendar] active task tray query failed", { code: taskError.code });
    throw new QueryError("calendar.getTimelineBoardItems", taskError.code);
  }
  const fetchedTasks = (taskRows ?? []) as TaskWithGoal[];
  const hasMoreTasks = fetchedTasks.length > TASK_TRAY_LIMIT;
  const activeTasks = fetchedTasks.slice(0, TASK_TRAY_LIMIT);

  const recurringItems = dayItems.filter(
    (item) =>
      item.recurring &&
      !item.done &&
      !item.skipped &&
      item.actionable !== false &&
      domainInScope(item.task.domain, scope),
  );
  const selectedDayOneOffs = dayItems.filter(
    (item) =>
      !item.recurring &&
      !item.task.recurrence_rule &&
      !item.done &&
      !item.skipped &&
      item.actionable !== false &&
      item.task.completed_at === null &&
      (item.task.status === "inbox" || item.task.status === "planned") &&
      domainInScope(item.task.domain, scope),
  );
  const selectedDayOneOffsById = new Map(selectedDayOneOffs.map((item) => [item.task.id, item]));
  const oneOffTasksById = new Map(
    activeTasks.filter((task) => !task.recurrence_rule).map((task) => [task.id, task]),
  );
  for (const item of selectedDayOneOffs) {
    if (!oneOffTasksById.has(item.task.id)) oneOffTasksById.set(item.task.id, item.task);
  }
  const oneOffItems: DayTaskItem<TaskWithGoal>[] = [...oneOffTasksById.values()].map((task) => {
    const selectedDayItem = selectedDayOneOffsById.get(task.id);
    if (selectedDayItem) return { ...selectedDayItem, task };
    return {
      key: task.id,
      task,
      date: selectedDate,
      done: false,
      overdue: false,
      recurring: false,
      actionable: true,
    };
  });
  const canonicalItems = [...recurringItems, ...oneOffItems].filter((item) =>
    domainInScope(item.task.domain, scope),
  );
  const uniqueTaskRows = [
    ...new Map(canonicalItems.map((item) => [item.task.id, item.task])).values(),
  ];
  const assets = await getTaskCardData(uniqueTaskRows);
  const cardTasksById = new Map(assets.tasks.map((task) => [task.id, task]));
  const occurrenceIds = [
    ...new Set(canonicalItems.flatMap((item) => (item.occurrenceId ? [item.occurrenceId] : []))),
  ];

  const occurrenceRows: { id: string; updated_at: string }[] = [];
  for (let offset = 0; offset < occurrenceIds.length; offset += TASK_QUERY_BATCH) {
    const { data, error } = await supabase
      .from("task_occurrences")
      .select("id, updated_at")
      .in("id", occurrenceIds.slice(offset, offset + TASK_QUERY_BATCH));
    if (error) {
      console.error("[calendar] occurrence version query failed", { code: error.code });
      throw new QueryError("calendar.getTimelineBoardItems", error.code);
    }
    occurrenceRows.push(...(data ?? []));
  }
  const occurrenceUpdatedAt = new Map(occurrenceRows.map((row) => [row.id, row.updated_at]));

  const items = canonicalItems.flatMap((item) => {
    const task = cardTasksById.get(item.task.id);
    if (!task) return [];

    // A generated recurring instance has no persisted occurrence yet, so it
    // cannot own a linked block. Never attach a legacy series-level block to it.
    const occurrenceId = item.recurring ? (item.occurrenceId ?? null) : null;
    const currentBlocks =
      item.recurring && !item.occurrenceId
        ? []
        : task.linkedBlocks.filter((block) => block.task_occurrence_id === occurrenceId);

    return [
      {
        key: item.key,
        task,
        scheduledDate: item.recurring ? item.date : null,
        occurrenceDate: item.occurrenceDate ?? null,
        occurrenceUpdatedAt: item.occurrenceId
          ? (occurrenceUpdatedAt.get(item.occurrenceId) ?? null)
          : null,
        done: item.done,
        skipped: item.skipped ?? false,
        linkedBlocks: currentBlocks.map((block) => ({
          id: block.id,
          version: block.version,
          startAt: block.start_at,
          endAt: block.end_at,
          isLocked: block.is_locked,
        })),
      },
    ];
  });
  const visibleGroupIds = new Set(
    assets.tasks.flatMap((task) => (task.task_group_id ? [task.task_group_id] : [])),
  );
  const groups: TimelineTaskGroup[] = assets.groups
    .filter((group) => visibleGroupIds.has(group.id))
    .map(({ id, title, position }) => ({ id, title, position }));

  return { items, groups, hasMoreTasks };
}
