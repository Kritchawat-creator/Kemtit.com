"use server";

import { getTranslations } from "next-intl/server";
import { createGoalCascade } from "@/core/goals/actions";
import { completeOnboarding } from "@/core/profile/actions";
import type { AppRoute } from "@/core/profile/onboarding";
import { getMe } from "@/core/profile/queries";
import { fail, zodFail, type ActionResult } from "@/core/shared/result";
import { formatThaiDate } from "@/lib/format";
import { sellerFirstGoalSpec } from "@/modules/seller/template";

import { firstGoalSchema } from "./schema";

/**
 * ขั้น 3 ของ onboarding (Decision 1.4) — app layer เป็น composition root: ผูก persona → template ของ module → core action
 */

export async function createFirstGoal(input: unknown): Promise<ActionResult<{ next: AppRoute }>> {
  const parsed = firstGoalSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const me = await getMe();
  if (!me) return fail("unauthorized");

  const t = await getTranslations("onboarding.firstGoal");
  const sampleKeys = ["1", "2", "3", "4", "5", "6"] as const;
  const spec = sellerFirstGoalSpec(parsed.data, {
    monthGoalTitle: (monthStart) =>
      t("monthGoalTitle", { month: formatThaiDate(monthStart, "monthYear") }),
    weekGoalTitle: (index, total) => t("weekGoalTitle", { index, total }),
    sampleTask: (index) => t(`sampleTasks.${sampleKeys[Math.min(index, sampleKeys.length) - 1]}`),
  });

  const created = await createGoalCascade(spec);
  if (!created.ok) return created;

  return completeOnboarding();
}
