"use server";

import { revalidatePath } from "next/cache";

import { fail, ok, zodFail, type ActionResult } from "@/core/shared/result";
import { todayBkk } from "@/lib/date";
import { createServerSupabase } from "@/lib/supabase/server";

import {
  archiveNoteSchema,
  convertNoteToTaskSchema,
  noteSchema,
  updateNoteSchema,
} from "./schema";

function revalidateNotes() {
  revalidatePath("/inbox");
  revalidatePath("/today");
  revalidatePath("/calendar");
  revalidatePath("/insights");
}

export async function createNote(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { data, error } = await supabase
    .from("notes")
    .insert({
      user_id: user.id,
      title: parsed.data.title,
      body: parsed.data.body ?? null,
      note_date: parsed.data.noteDate ?? todayBkk(),
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[notes] create failed", { code: error?.code });
    return fail("generic");
  }

  revalidateNotes();
  return ok({ id: data.id });
}

export async function updateNote(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = updateNoteSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { data, error } = await supabase
    .from("notes")
    .update({
      title: parsed.data.title,
      body: parsed.data.body ?? null,
    })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error) return fail("generic");
  if (!data) return fail("notFound");

  revalidateNotes();
  return ok({ id: data.id });
}

export async function archiveNote(input: unknown): Promise<ActionResult> {
  const parsed = archiveNoteSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { data, error } = await supabase
    .from("notes")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error) return fail("generic");
  if (!data) return fail("notFound");

  revalidateNotes();
  revalidatePath("/archive");
  return ok(null);
}

export async function restoreNote(input: unknown): Promise<ActionResult> {
  const parsed = archiveNoteSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { data, error } = await supabase
    .from("notes")
    .update({ archived_at: null })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .not("archived_at", "is", null)
    .select("id")
    .maybeSingle();

  if (error) return fail("generic");
  if (!data) return fail("notFound");

  revalidateNotes();
  revalidatePath("/archive");
  return ok(null);
}

export async function convertNoteToTask(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = convertNoteToTaskSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { data: note, error: readError } = await supabase
    .from("notes")
    .select("id, title, body, note_date, linked_task_id")
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .is("archived_at", null)
    .maybeSingle();

  if (readError) return fail("generic");
  if (!note) return fail("notFound");
  if (note.linked_task_id) return ok({ id: note.linked_task_id });

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      goal_id: null,
      title: note.title,
      due_date: note.note_date,
      planned_date: note.note_date,
      domain: parsed.data.domain,
      recurrence_rule: null,
      notes: note.body?.slice(0, 2000) ?? null,
      priority: "normal",
      estimated_minutes: null,
      status: "planned",
    })
    .select("id")
    .single();

  if (taskError || !task) {
    console.error("[notes] convert task create failed", { code: taskError?.code });
    return fail("generic");
  }

  const { data: linked, error: linkError } = await supabase
    .from("notes")
    .update({ linked_task_id: task.id })
    .eq("id", note.id)
    .eq("user_id", user.id)
    .is("linked_task_id", null)
    .select("id")
    .maybeSingle();

  if (linkError || !linked) {
    await supabase.from("tasks").delete().eq("id", task.id).eq("user_id", user.id);
    return fail("generic");
  }

  revalidateNotes();
  revalidatePath("/tasks");
  return ok({ id: task.id });
}
