import "server-only";

import { COUNTED_DATA_ORIGINS } from "@/core/shared/data-origin";
import { QueryError } from "@/core/shared/query-error";
import { createServerSupabase } from "@/lib/supabase/server";

export async function listNotes(noteDate?: string, limit = 50) {
  const supabase = await createServerSupabase();
  let query = supabase
    .from("notes")
    .select("*")
    .in("data_origin", [...COUNTED_DATA_ORIGINS])
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (noteDate) query = query.eq("note_date", noteDate);

  const { data, error } = await query;

  if (error) {
    console.error("[notes] list failed", { code: error.code });
    throw new QueryError("notes.list", error.code);
  }
  return data ?? [];
}

export async function listArchivedNotes(pageIndex = 0, pageSize = 50) {
  const offset = Math.max(0, pageIndex) * pageSize;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("notes")
    .select("id, title, body, note_date, archived_at")
    .in("data_origin", [...COUNTED_DATA_ORIGINS])
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false })
    .range(offset, offset + pageSize);

  if (error) {
    console.error("[notes] archive list failed", { code: error.code });
    throw new QueryError("notes.listArchived", error.code);
  }
  const rows = data ?? [];
  return { items: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
}
