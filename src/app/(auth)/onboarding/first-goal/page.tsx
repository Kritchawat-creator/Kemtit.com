import { redirect } from "next/navigation";

import { nextRouteFor, ROUTES } from "@/core/profile/onboarding";
import { getMe } from "@/core/profile/queries";

/**
 * Legacy onboarding URL kept for bookmarked/old clients.
 * Template-generated first-goal creation is retired; the canonical flow now
 * continues through Focus Areas and Starter Workspace.
 */
export default async function FirstGoalPage() {
  const me = await getMe();
  if (!me) redirect(ROUTES.login);
  redirect(nextRouteFor(me.profile));
}
