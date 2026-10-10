import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getMe } from "@/core/profile/queries";
import { nextRouteFor, ROUTES } from "@/core/profile/onboarding";

export default async function PrintLayout({ children }: { children: ReactNode }) {
  const me = await getMe();
  if (!me) redirect(ROUTES.login);

  const gate = nextRouteFor(me.profile);
  if (gate !== ROUTES.dashboard) redirect(gate);

  return children;
}
