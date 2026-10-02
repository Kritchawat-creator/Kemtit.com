import { redirect } from "next/navigation";
import { Suspense } from "react";
import type * as React from "react";

import { getCaptureSmartDefaults } from "@/core/capture/defaults";
import { listEntryGoalOptions } from "@/core/entries/queries";
import { listParentCandidates } from "@/core/goals/queries";
import { nextRouteFor, ROUTES } from "@/core/profile/onboarding";
import { domainForFocusArea } from "@/core/profile/roles";
import { listProjects } from "@/core/projects/queries";
import { getMe } from "@/core/profile/queries";
import { AppShell } from "@/components/layout/AppShell";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { QuickAddHost } from "@/components/layout/QuickAddHost";

/** ทุกหน้าในแอป: ต้อง login + จบ onboarding แล้ว (proxy.ts กันคนไม่ login ไว้ชั้นแรก) */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect(ROUTES.login);

  const gate = nextRouteFor(me.profile);
  if (gate !== ROUTES.dashboard) redirect(gate);

  const preferredFocus =
    me.profile.default_scope === "work"
      ? "work"
      : (me.profile.focus_areas.find((area) =>
          me.profile.default_scope === "life" ? area !== "work" : true,
        ) ??
        me.profile.focus_areas[0] ??
        "work");
  const preferredCaptureDomain = domainForFocusArea(preferredFocus);

  const [parentCandidates, entryGoals, projects, captureSmartDefaults] = await Promise.all([
    listParentCandidates(),
    listEntryGoalOptions(),
    listProjects(),
    getCaptureSmartDefaults(preferredCaptureDomain),
  ]);

  return (
    <AppShell me={me}>
      <OfflineBanner />
      {children}
      <Suspense fallback={null}>
        <QuickAddHost
          parentCandidates={parentCandidates}
          preferredCaptureDomain={preferredCaptureDomain}
          captureSmartDefaults={captureSmartDefaults}
          entryGoals={entryGoals}
          projectOptions={projects.map((project) => ({ id: project.id, title: project.title }))}
        />
      </Suspense>
    </AppShell>
  );
}
