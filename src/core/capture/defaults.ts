import "server-only";

import { DOMAINS, type Domain } from "@/core/domain/domains";
import { COUNTED_DATA_ORIGINS } from "@/core/shared/data-origin";
import { createServerSupabase } from "@/lib/supabase/server";

export type CaptureSmartDefaults = {
  preferredDomain: Domain;
  taskEstimatedMinutes: number | null;
  habitCadence: "daily" | "weekly";
  habitTargetPerWeek: number;
};

export async function getCaptureSmartDefaults(
  fallbackDomain: Domain,
): Promise<CaptureSmartDefaults> {
  const supabase = await createServerSupabase();
  const [{ data: tasks }, { data: habits }] = await Promise.all([
    supabase
      .from("tasks")
      .select("domain, estimated_minutes, created_at")
      .in("data_origin", [...COUNTED_DATA_ORIGINS])
      .is("archived_at", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("habits")
      .select("domain, cadence, target_per_week, created_at")
      .in("data_origin", [...COUNTED_DATA_ORIGINS])
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const domainScore = new Map<Domain, number>(
    DOMAINS.map((domain) => [domain, 0] as const),
  );
  for (const [index, row] of (tasks ?? []).entries()) {
    if (!(DOMAINS as readonly string[]).includes(row.domain)) continue;
    const domain = row.domain as Domain;
    domainScore.set(domain, (domainScore.get(domain) ?? 0) + Math.max(1, 30 - index));
  }
  for (const [index, row] of (habits ?? []).entries()) {
    if (!(DOMAINS as readonly string[]).includes(row.domain)) continue;
    const domain = row.domain as Domain;
    domainScore.set(domain, (domainScore.get(domain) ?? 0) + Math.max(1, 15 - index));
  }

  const preferredDomain = [...domainScore.entries()].reduce(
    (best, candidate) => (candidate[1] > best[1] ? candidate : best),
    [fallbackDomain, domainScore.get(fallbackDomain) ?? 0] as [Domain, number],
  )[0];

  const estimates = (tasks ?? [])
    .flatMap((row) => (row.estimated_minutes && row.estimated_minutes > 0 ? [row.estimated_minutes] : []))
    .slice(0, 12);
  const taskEstimatedMinutes =
    estimates.length > 0
      ? Math.max(5, Math.min(480, Math.round(estimates.reduce((sum, value) => sum + value, 0) / estimates.length / 5) * 5))
      : null;

  const recentHabit = (habits ?? [])[0];
  const habitCadence = recentHabit?.cadence === "weekly" ? "weekly" : "daily";
  const habitTargetPerWeek = Math.max(
    1,
    Math.min(7, recentHabit?.target_per_week ?? (habitCadence === "daily" ? 7 : 3)),
  );

  return { preferredDomain, taskEstimatedMinutes, habitCadence, habitTargetPerWeek };
}
