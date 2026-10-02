import "server-only";

import { COUNTED_DATA_ORIGINS } from "@/core/shared/data-origin";
import { QueryError } from "@/core/shared/query-error";
import { createServerSupabase } from "@/lib/supabase/server";

export async function listCalendarEvents(from: string, to: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .in("data_origin", [...COUNTED_DATA_ORIGINS])
    .gte("event_date", from)
    .lte("event_date", to)
    .order("event_date")
    .order("start_time", { nullsFirst: true });

  if (error) {
    console.error("[calendar-events] list failed", { code: error.code });
    throw new QueryError("calendar-events.list", error.code);
  }
  return data ?? [];
}
