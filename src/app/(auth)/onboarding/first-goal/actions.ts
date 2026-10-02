"use server";

import { getMe } from "@/core/profile/queries";
import { ROUTES, type AppRoute } from "@/core/profile/onboarding";
import { fail, ok, zodFail, type ActionResult } from "@/core/shared/result";

import { firstGoalSchema } from "./schema";

/**
 * Legacy compatibility endpoint.
 *
 * The previous onboarding action created template-generated goals/tasks as
 * normal USER records. The UX redesign forbids that behavior. Existing clients
 * that still submit this form are redirected into Starter Workspace without
 * persisting the generated cascade.
 */
export async function createFirstGoal(
  input: unknown,
): Promise<ActionResult<{ next: AppRoute }>> {
  const parsed = firstGoalSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const me = await getMe();
  if (!me) return fail("unauthorized");

  return ok({ next: ROUTES.starter });
}
