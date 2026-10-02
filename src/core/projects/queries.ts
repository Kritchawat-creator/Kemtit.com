import "server-only";

import { COUNTED_DATA_ORIGINS } from "@/core/shared/data-origin";
import { QueryError } from "@/core/shared/query-error";
import { isBeforeISO, type ISODate, todayBkk } from "@/lib/date";
import { createServerSupabase } from "@/lib/supabase/server";

import type { TaskWithGoal } from "@/core/tasks/schema";

export async function listProjects() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("projects")
    .select("*, goal:goals(id, title)")
    .in("data_origin", [...COUNTED_DATA_ORIGINS])
    .is("archived_at", null)
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("[projects] list failed", { code: error.code });
    throw new QueryError("projects.list", error.code);
  }
  return data ?? [];
}

export async function listArchivedProjects(pageIndex = 0, pageSize = 50) {
  const offset = Math.max(0, pageIndex) * pageSize;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("projects")
    .select("id, title, archived_at, archived_from_status")
    .in("data_origin", [...COUNTED_DATA_ORIGINS])
    .or("archived_at.not.is.null,status.eq.archived")
    .order("archived_at", { ascending: false })
    .range(offset, offset + pageSize);

  if (error) {
    console.error("[projects] archive list failed", { code: error.code });
    throw new QueryError("projects.listArchived", error.code);
  }
  const rows = data ?? [];
  return { items: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
}

export async function getProjectDetail(id: string) {
  const supabase = await createServerSupabase();
  const [{ data: project, error: projectError }, { data: tasks, error: tasksError }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("*, goal:goals(id, title)")
        .eq("id", id)
        .in("data_origin", [...COUNTED_DATA_ORIGINS])
        .maybeSingle(),
      supabase
        .from("tasks")
        .select("*, goal:goals(id, title)")
        .eq("project_id", id)
        .in("data_origin", [...COUNTED_DATA_ORIGINS])
        .is("archived_at", null)
        .is("deleted_at", null)
        .order("due_date")
        .order("created_at"),
    ]);
  if (projectError || tasksError) {
    const code = projectError?.code ?? tasksError?.code;
    console.error("[projects] detail failed", { code });
    throw new QueryError("projects.getDetail", code);
  }
  if (!project) return null;

  const today = todayBkk();
  const projectTasks = (tasks ?? []) as TaskWithGoal[];
  const items = projectTasks.map((task) => ({
    key: task.id,
    task,
    date: task.due_date ?? today,
    done: task.completed_at !== null || task.status === "completed",
    overdue:
      task.recurrence_rule === null &&
      task.completed_at === null &&
      task.due_date !== null &&
      isBeforeISO(task.due_date as ISODate, today),
    recurring: task.recurrence_rule !== null,
  }));
  const countableTasks = projectTasks.filter((task) => task.recurrence_rule === null);
  const completed = countableTasks.filter(
    (task) => task.completed_at !== null || task.status === "completed",
  ).length;
  const plannedMinutes = projectTasks.reduce(
    (total, task) => total + (task.estimated_minutes ?? 0),
    0,
  );
  return {
    project,
    tasks: items,
    progress: { completed, total: countableTasks.length },
    plannedMinutes,
    routineCount: projectTasks.length - countableTasks.length,
  };
}
