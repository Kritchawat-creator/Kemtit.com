import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";

import type { ItemEntityType, ItemIdentity, ItemLink } from "./schema";

export async function getItemIdentity(
  entityType: ItemEntityType,
  entityId: string,
): Promise<ItemIdentity | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("item_registry")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .maybeSingle();

  if (error) {
    console.error("[items] identity lookup failed", { code: error.code, entityType });
    return null;
  }

  return data as ItemIdentity | null;
}

export async function listItemLinks(itemId: string): Promise<{
  outgoing: ItemLink[];
  incoming: ItemLink[];
}> {
  const supabase = await createServerSupabase();
  const [{ data: outgoing, error: outgoingError }, { data: incoming, error: incomingError }] =
    await Promise.all([
      supabase.from("item_links").select("*").eq("source_item_id", itemId).order("created_at"),
      supabase.from("item_links").select("*").eq("target_item_id", itemId).order("created_at"),
    ]);

  if (outgoingError || incomingError) {
    console.error("[items] link lookup failed", {
      code: outgoingError?.code ?? incomingError?.code,
      itemId,
    });
    return { outgoing: [], incoming: [] };
  }

  return {
    outgoing: (outgoing ?? []) as ItemLink[],
    incoming: (incoming ?? []) as ItemLink[],
  };
}
