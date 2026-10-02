"use server";

import { COUNTED_DATA_ORIGINS } from "@/core/shared/data-origin";
import { fail, ok, zodFail, type ActionResult } from "@/core/shared/result";
import { createServerSupabase } from "@/lib/supabase/server";

import {
  addSubtaskSchema,
  deleteSubtaskSchema,
  listSubtasksSchema,
  reorderSubtasksSchema,
  toggleSubtaskSchema,
  updateSubtaskSchema,
} from "./schema";

export type TaskSubtask = {
  id: string;
  task_id: string;
  user_id: string;
  title: string;
  position: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

async function requireUser() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

async function ownsTask(supabase: Awaited<ReturnType<typeof createServerSupabase>>, taskId: string) {
  const { data } = await supabase
    .from("tasks")
    .select("id")
    .eq("id", taskId)
    .in("data_origin", [...COUNTED_DATA_ORIGINS])
    .maybeSingle();
  return Boolean(data);
}

async function ownedSubtaskTaskId(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  subtaskId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("task_subtasks")
    .select("task_id")
    .eq("id", subtaskId)
    .maybeSingle();
  if (!data || !(await ownsTask(supabase, data.task_id))) return null;
  return data.task_id;
}

export async function listTaskSubtasks(input: unknown): Promise<ActionResult<TaskSubtask[]>> {
  const parsed = listSubtasksSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { supabase, user } = await requireUser();
  if (!user) return fail("unauthorized");
  if (!(await ownsTask(supabase, parsed.data.taskId))) return fail("notFound");

  const { data, error } = await supabase
    .from("task_subtasks")
    .select("id, task_id, user_id, title, position, completed_at, created_at, updated_at")
    .eq("task_id", parsed.data.taskId)
    .order("position")
    .order("created_at");
  if (error) return fail("generic");
  return ok((data ?? []) as TaskSubtask[]);
}

export async function addSubtask(input: unknown): Promise<ActionResult<TaskSubtask>> {
  const parsed = addSubtaskSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { supabase, user } = await requireUser();
  if (!user) return fail("unauthorized");
  if (!(await ownsTask(supabase, parsed.data.taskId))) return fail("notFound");

  const { data: last } = await supabase
    .from("task_subtasks")
    .select("position")
    .eq("task_id", parsed.data.taskId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("task_subtasks")
    .insert({
      task_id: parsed.data.taskId,
      user_id: user.id,
      title: parsed.data.title,
      position: (last?.position ?? -1) + 1,
    })
    .select("id, task_id, user_id, title, position, completed_at, created_at, updated_at")
    .single();
  if (error || !data) return fail("generic");
  return ok(data as TaskSubtask);
}

export async function updateSubtask(input: unknown): Promise<ActionResult<TaskSubtask>> {
  const parsed = updateSubtaskSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { supabase, user } = await requireUser();
  if (!user) return fail("unauthorized");
  if (!(await ownedSubtaskTaskId(supabase, parsed.data.id))) return fail("notFound");

  const { data, error } = await supabase
    .from("task_subtasks")
    .update({ title: parsed.data.title })
    .eq("id", parsed.data.id)
    .select("id, task_id, user_id, title, position, completed_at, created_at, updated_at")
    .maybeSingle();
  if (error) return fail("generic");
  if (!data) return fail("notFound");
  return ok(data as TaskSubtask);
}

export async function deleteSubtask(input: unknown): Promise<ActionResult> {
  const parsed = deleteSubtaskSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { supabase, user } = await requireUser();
  if (!user) return fail("unauthorized");
  if (!(await ownedSubtaskTaskId(supabase, parsed.data.id))) return fail("notFound");

  const { error, count } = await supabase
    .from("task_subtasks")
    .delete({ count: "exact" })
    .eq("id", parsed.data.id);
  if (error) return fail("generic");
  if (!count) return fail("notFound");
  return ok(null);
}

export async function toggleSubtask(input: unknown): Promise<ActionResult<TaskSubtask>> {
  const parsed = toggleSubtaskSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { supabase, user } = await requireUser();
  if (!user) return fail("unauthorized");
  if (!(await ownedSubtaskTaskId(supabase, parsed.data.id))) return fail("notFound");

  const { data, error } = await supabase
    .from("task_subtasks")
    .update({ completed_at: parsed.data.done ? new Date().toISOString() : null })
    .eq("id", parsed.data.id)
    .select("id, task_id, user_id, title, position, completed_at, created_at, updated_at")
    .maybeSingle();
  if (error) return fail("generic");
  if (!data) return fail("notFound");
  return ok(data as TaskSubtask);
}

export async function reorderSubtasks(input: unknown): Promise<ActionResult> {
  const parsed = reorderSubtasksSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { supabase, user } = await requireUser();
  if (!user) return fail("unauthorized");
  if (!(await ownsTask(supabase, parsed.data.taskId))) return fail("notFound");

  const { data: rows, error: readError } = await supabase
    .from("task_subtasks")
    .select("id, task_id")
    .eq("task_id", parsed.data.taskId)
    .in("id", parsed.data.ids);
  if (readError) return fail("generic");
  if (rows?.length !== parsed.data.ids.length) return fail("notFound");

  for (const [position, id] of parsed.data.ids.entries()) {
    const { error } = await supabase.from("task_subtasks").update({ position }).eq("id", id);
    if (error) return fail("generic");
  }
  return ok(null);
}
