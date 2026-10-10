import "server-only";

import { authFailureContext, isUnauthenticatedAuthError } from "@/core/auth/session-errors";
import { QueryError } from "@/core/shared/query-error";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

import { releaseNoteRowSchema } from "./schema";
import type { ReleaseNote, ReleaseNoteSummary } from "./types";

type ReleaseNoteRow = Tables<"release_notes">;

const releaseNoteSummaryFields = "id, version, build_id, title_th, title_en, published_at";
const releaseNoteFields = `${releaseNoteSummaryFields}, new_items_th, new_items_en, improved_items_th, improved_items_en, fixed_items_th, fixed_items_en, created_at`;

async function getCurrentUser() {
  const supabase = await createServerSupabase();
  let user: { id: string } | null = null;
  let authError: unknown = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
    authError = result.error;
  } catch (error) {
    authError = error;
  }

  if (authError) {
    if (isUnauthenticatedAuthError(authError)) return { supabase, user: null };
    const context = authFailureContext(authError);
    console.error("[releases] current user lookup failed", context);
    throw new QueryError("releases.currentUser", context.code);
  }

  return { supabase, user };
}

function mapSummary(row: Pick<ReleaseNoteRow, "id" | "version" | "build_id" | "title_th" | "title_en" | "published_at">, isRead: boolean): ReleaseNoteSummary {
  if (!row.published_at) throw new QueryError("releases.invalidPublishedAt", "invalid_data");
  return {
    id: row.id,
    version: row.version,
    buildId: row.build_id,
    publishedAt: row.published_at,
    title: { th: row.title_th, en: row.title_en },
    isRead,
  };
}

function parseReleaseNote(row: ReleaseNoteRow, isRead: boolean): ReleaseNote {
  const parsed = releaseNoteRowSchema.safeParse(row);
  if (!parsed.success) {
    console.error("[releases] published release content failed validation");
    throw new QueryError("releases.invalidPublishedContent", "invalid_data");
  }

  return {
    ...mapSummary(parsed.data, isRead),
    newItems: { th: parsed.data.new_items_th, en: parsed.data.new_items_en },
    improvedItems: { th: parsed.data.improved_items_th, en: parsed.data.improved_items_en },
    fixedItems: { th: parsed.data.fixed_items_th, en: parsed.data.fixed_items_en },
  };
}

async function getReadReleaseIds(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string,
  releaseNoteIds: string[],
) {
  if (releaseNoteIds.length === 0) return new Set<string>();

  const { data, error } = await supabase
    .from("release_note_reads")
    .select("release_note_id")
    .eq("user_id", userId)
    .in("release_note_id", releaseNoteIds);
  if (error) {
    console.error("[releases] read markers lookup failed", { code: error.code });
    throw new QueryError("releases.readMarkers", error.code);
  }
  return new Set((data ?? []).map((row) => row.release_note_id));
}

export async function listPublishedReleaseNotes(): Promise<ReleaseNoteSummary[]> {
  const { supabase, user } = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("release_notes")
    .select(releaseNoteSummaryFields)
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(50);
  if (error) {
    console.error("[releases] list failed", { code: error.code });
    throw new QueryError("releases.list", error.code);
  }

  const rows = (data ?? []).filter((row) => row.published_at !== null);
  const readIds = await getReadReleaseIds(
    supabase,
    user.id,
    rows.map((row) => row.id),
  );
  return rows.map((row) => mapSummary(row, readIds.has(row.id)));
}

export async function getPublishedReleaseNote(releaseNoteId: string): Promise<ReleaseNote | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(releaseNoteId)) {
    return null;
  }

  const { supabase, user } = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("release_notes")
    .select(releaseNoteFields)
    .eq("id", releaseNoteId)
    .maybeSingle();
  if (error) {
    console.error("[releases] detail failed", { code: error.code });
    throw new QueryError("releases.detail", error.code);
  }
  if (!data || !data.published_at) return null;

  const readIds = await getReadReleaseIds(supabase, user.id, [data.id]);
  return parseReleaseNote(data, readIds.has(data.id));
}

export async function hasUnreadPublishedReleaseNote(): Promise<boolean> {
  const { supabase, user } = await getCurrentUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from("release_notes")
    .select("id")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[releases] latest note lookup failed", { code: error.code });
    throw new QueryError("releases.latest", error.code);
  }
  if (!data) return false;

  const { data: read, error: readError } = await supabase
    .from("release_note_reads")
    .select("release_note_id")
    .eq("user_id", user.id)
    .eq("release_note_id", data.id)
    .maybeSingle();
  if (readError) {
    console.error("[releases] latest read marker lookup failed", { code: readError.code });
    throw new QueryError("releases.latestReadMarker", readError.code);
  }
  return !read;
}
