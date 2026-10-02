import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";

export async function listStarterSuggestionDecisions() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("suggestion_decisions")
    .select("suggestion_id, status, accepted_entity_type, accepted_entity_id, custom_title")
    .order("updated_at");

  if (error) {
    console.error("[starter] list decisions failed", { code: error.code });
    return [];
  }

  return data ?? [];
}
