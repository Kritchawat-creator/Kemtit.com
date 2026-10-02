import "server-only";

import { COUNTED_DATA_ORIGINS } from "@/core/shared/data-origin";
import { QueryError } from "@/core/shared/query-error";
import { addDaysISO, type ISODate } from "@/lib/date";
import { createServerSupabase } from "@/lib/supabase/server";

/** Active, counted time blocks whose start falls within a Calendar week or month grid. */
export async function getTimeBlocksForCalendarRange(from: ISODate, to: ISODate) {
  const supabase = await createServerSupabase();
  const until = addDaysISO(to, 1);
  const { data, error } = await supabase
    .from("time_blocks")
    .select("*")
    .in("data_origin", [...COUNTED_DATA_ORIGINS])
    .eq("status", "active")
    .gte("start_at", `${from}T00:00:00+07:00`)
    .lt("start_at", `${until}T00:00:00+07:00`)
    .order("start_at");

  if (error) {
    console.error("[planning] getTimeBlocksForCalendarRange failed", { code: error.code });
    throw new QueryError("planning.getTimeBlocksForCalendarRange", error.code);
  }
  return data ?? [];
}
