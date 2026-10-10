import type { Domain } from "@/core/domain/domains";

export const STARTER_PACK_IDS = ["life", "work", "study"] as const;
export type StarterPackId = (typeof STARTER_PACK_IDS)[number];

const PACK_DOMAINS: Record<StarterPackId, Domain> = {
  life: "health",
  work: "work",
  study: "growth",
};

export function isStarterPackId(value: unknown): value is StarterPackId {
  return typeof value === "string" && (STARTER_PACK_IDS as readonly string[]).includes(value);
}

export function starterPackDomain(pack: StarterPackId): Domain {
  return PACK_DOMAINS[pack];
}
