"use server";

import { revalidatePath } from "next/cache";

import { COUNTED_DATA_ORIGINS } from "@/core/shared/data-origin";
import { fail, ok, zodFail, type ActionResult } from "@/core/shared/result";
import { createServerSupabase } from "@/lib/supabase/server";

import { archiveProjectSchema, projectSchema, updateProjectSchema } from "./schema";

export async function listProjectOptions(): Promise<ActionResult<{ id: string; title: string }[]>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { data, error } = await supabase
    .from("projects")
    .select("id, title")
    .eq("user_id", user.id)
    .in("data_origin", [...COUNTED_DATA_ORIGINS])
    .is("archived_at", null)
    .order("updated_at", { ascending: false });
  if (error) return fail("generic");
  return ok(data ?? []);
}

export async function createProject(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  if (parsed.data.goalId) {
    const { data: goal } = await supabase
      .from("goals")
      .select("id")
      .eq("id", parsed.data.goalId)
      .in("data_origin", [...COUNTED_DATA_ORIGINS])
      .maybeSingle();
    if (!goal) return fail("invalidGoal");
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      domain: parsed.data.domain,
      goal_id: parsed.data.goalId ?? null,
      target_date: parsed.data.targetDate ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return fail("generic");

  revalidatePath("/work/projects");
  revalidatePath("/today");
  return ok({ id: data.id });
}

export async function updateProject(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = updateProjectSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  if (parsed.data.values.goalId) {
    const { data: goal } = await supabase
      .from("goals")
      .select("id")
      .eq("id", parsed.data.values.goalId)
      .in("data_origin", [...COUNTED_DATA_ORIGINS])
      .maybeSingle();
    if (!goal) return fail("invalidGoal");
  }

  const { data, error } = await supabase
    .from("projects")
    .update({
      title: parsed.data.values.title,
      description: parsed.data.values.description ?? null,
      domain: parsed.data.values.domain,
      goal_id: parsed.data.values.goalId ?? null,
      target_date: parsed.data.values.targetDate ?? null,
    })
    .eq("id", parsed.data.id)
    .in("data_origin", [...COUNTED_DATA_ORIGINS])
    .is("archived_at", null)
    .select("id")
    .maybeSingle();
  if (error) return fail("generic");
  if (!data) return fail("notFound");

  revalidatePath("/work/projects");
  revalidatePath(`/work/projects/${data.id}`);
  revalidatePath("/today");
  return ok({ id: data.id });
}

export async function archiveProject(input: unknown): Promise<ActionResult> {
  const parsed = archiveProjectSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { data, error } = await supabase.rpc("archive_project_atomic", {
    p_project_id: parsed.data.id,
  });
  if (error)
    return error.message?.includes("project_not_found") ? fail("notFound") : fail("generic");
  if (!data) return fail("notFound");

  revalidatePath("/work/projects");
  revalidatePath(`/work/projects/${data}`);
  revalidatePath("/today");
  revalidatePath("/archive");
  return ok(null);
}

export async function restoreProject(input: unknown): Promise<ActionResult> {
  const parsed = archiveProjectSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { data, error } = await supabase.rpc("restore_project_atomic", {
    p_project_id: parsed.data.id,
  });
  if (error)
    return error.message?.includes("project_not_found") ? fail("notFound") : fail("generic");
  if (!data) return fail("notFound");

  revalidatePath("/work/projects");
  revalidatePath(`/work/projects/${data}`);
  revalidatePath("/today");
  revalidatePath("/archive");
  return ok(null);
}
