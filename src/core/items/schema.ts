import type { Database } from "@/types/database";

export const ITEM_ENTITY_TYPES = [
  "goal",
  "task",
  "project",
  "habit",
  "event",
  "bill",
  "expense",
  "income",
  "note",
] as const;
export type ItemEntityType = (typeof ITEM_ENTITY_TYPES)[number];

export const ITEM_RELATION_TYPES = [
  "CONTRIBUTES_TO",
  "BELONGS_TO",
  "SCHEDULED_AS",
  "TRACKED_AS",
  "PLANNED_IN",
  "SYNCED_WITH",
] as const;
export type ItemRelationType = (typeof ITEM_RELATION_TYPES)[number];

type ItemRegistryRow = Database["public"]["Tables"]["item_registry"]["Row"];
type ItemLinkRow = Database["public"]["Tables"]["item_links"]["Row"];

export type ItemIdentity = Omit<ItemRegistryRow, "entity_type"> & {
  entity_type: ItemEntityType;
};

export type ItemLink = Omit<ItemLinkRow, "relation_type"> & {
  relation_type: ItemRelationType;
};
