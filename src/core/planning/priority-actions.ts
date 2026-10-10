"use server";

import { revalidatePath } from "next/cache";

import { fail, ok, zodFail, type ActionResult } from "@/core/shared/result";
import { createServerSupabase } from "@/lib/supabase/server";

import { dailyPriorityOrderSchema, undoDailyPriorityOrderSchema } from "./priority-schema";

type PriorityState = {
  operationId: string;
  priorityTaskIds: string[];
  version: number;
  undone?: boolean;
};

export async function setDailyPriorityOrder(input: unknown): Promise<ActionResult<PriorityState>> {
  const parsed = dailyPriorityOrderSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { data, error } = await supabase.rpc("set_daily_plan_priorities_atomic", {
    p_operation_id: parsed.data.operationId,
    p_plan_date: parsed.data.planDate,
    p_priority_task_ids: parsed.data.priorityTaskIds,
    p_expected_version: parsed.data.expectedVersion,
  });
  if (error) {
    console.error("[planning] setDailyPriorityOrder failed", { code: error.code });
    return fail("generic");
  }

  const result = parsePriorityState(data);
  if (!result) return fail("generic");
  if (result.status === "conflict") return fail("priorityConflict");
  if (result.status !== "applied") return fail("generic");

  revalidatePath("/today");
  return ok({
    operationId: result.operationId,
    priorityTaskIds: result.priorityTaskIds,
    version: result.version,
    undone: result.undone,
  });
}

export async function undoDailyPriorityOrder(input: unknown): Promise<ActionResult<PriorityState>> {
  const parsed = undoDailyPriorityOrderSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { data, error } = await supabase.rpc("undo_daily_plan_priorities_atomic", {
    p_operation_id: parsed.data.operationId,
  });
  if (error) {
    console.error("[planning] undoDailyPriorityOrder failed", { code: error.code });
    return fail("generic");
  }

  const result = parsePriorityState(data);
  if (!result) return fail("generic");
  if (result.status === "conflict") return fail("priorityConflict");
  if (result.status !== "applied") return fail("generic");

  revalidatePath("/today");
  return ok({
    operationId: result.operationId,
    priorityTaskIds: result.priorityTaskIds,
    version: result.version,
    undone: result.undone,
  });
}

function parsePriorityState(value: unknown):
  | { status: "conflict"; reason?: string }
  | {
      status: "applied";
      operationId: string;
      priorityTaskIds: string[];
      version: number;
      undone?: boolean;
    }
  | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.status === "conflict") {
    return {
      status: "conflict",
      reason: typeof record.reason === "string" ? record.reason : undefined,
    };
  }
  if (
    record.status !== "applied" ||
    typeof record.operationId !== "string" ||
    !Array.isArray(record.priorityTaskIds) ||
    !record.priorityTaskIds.every((id) => typeof id === "string") ||
    typeof record.version !== "number"
  )
    return null;
  return {
    status: "applied",
    operationId: record.operationId,
    priorityTaskIds: record.priorityTaskIds,
    version: record.version,
    undone: record.undone === true,
  };
}
