/** 6 life domain (Scope §5.1) — สี/ชื่ออยู่ที่ globals.css และ th.json */
export const DOMAINS = ["work", "health", "family", "finance", "growth", "relationships"] as const;
export type Domain = (typeof DOMAINS)[number];

/** filter "งาน / ชีวิต" (POC Decisions 3: domain UI ขั้นต่ำ) */
export type DomainFilter = "all" | "work" | "life";

export function isLifeDomain(domain: Domain): boolean {
  return domain !== "work";
}

export function matchesDomainFilter(domain: Domain, filter: DomainFilter): boolean {
  if (filter === "all") return true;
  if (filter === "work") return domain === "work";
  return isLifeDomain(domain);
}
