import "server-only";

import { QueryError } from "@/core/shared/query-error";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ISODate } from "@/lib/date";

export type DailyPriorityOrder = {
  priority_task_ids: string[];
  version: number;
} | null;

export async function getDailyPriorityOrder(planDate: ISODate): Promise<DailyPriorityOrder> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("daily_plan_priority_orders")
    .select("priority_task_ids, version")
    .eq("plan_date", planDate)
    .maybeSingle();

  if (error) {
    console.error("[planning] getDailyPriorityOrder failed", { code: error.code });
    throw new QueryError("planning.getDailyPriorityOrder", error.code);
  }

  return data;
}
