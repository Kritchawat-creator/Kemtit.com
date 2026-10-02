import { isLifeDomain, type Domain } from "@/core/domain/domains";

export const SCOPE_IDS = ["all", "work", "life"] as const;
export type Scope = (typeof SCOPE_IDS)[number];

export function isScope(value: unknown): value is Scope {
  return typeof value === "string" && (SCOPE_IDS as readonly string[]).includes(value);
}

export function domainInScope(domain: Domain, scope: Scope): boolean {
  if (scope === "all") return true;
  if (scope === "work") return domain === "work";
  return isLifeDomain(domain);
}
