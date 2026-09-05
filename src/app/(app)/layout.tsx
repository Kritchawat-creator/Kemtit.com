import { redirect } from "next/navigation";
import { Suspense } from "react";
import type * as React from "react";

import { listParentCandidates } from "@/core/goals/queries";
import { nextRouteFor, ROUTES } from "@/core/profile/onboarding";
import { getMe } from "@/core/profile/queries";
import { AppShell } from "@/components/layout/AppShell";
import { QuickAddHost } from "@/components/layout/QuickAddHost";

/** ทุกหน้าในแอป: ต้อง login + จบ onboarding แล้ว (proxy.ts กันคนไม่ login ไว้ชั้นแรก) */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect(ROUTES.login);

  const gate = nextRouteFor(me.profile);
  if (gate !== ROUTES.dashboard) redirect(gate);

  const parentCandidates = await listParentCandidates();

  return (
    <AppShell me={me}>
      {children}
      <Suspense fallback={null}>
        <QuickAddHost parentCandidates={parentCandidates} />
      </Suspense>
    </AppShell>
  );
}
