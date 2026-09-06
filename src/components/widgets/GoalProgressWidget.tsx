import { Target } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { listGoalsWithProgress } from "@/core/goals/queries";
import { type ISODate, startOfMonthISO } from "@/lib/date";
import { EmptyState } from "@/components/domain/EmptyState";
import { Button } from "@/components/ui/button";

import { GoalProgressPanel } from "./GoalProgressPanel";
import { WidgetShell } from "./WidgetShell";

/** widget บนสุดเสมอ (Design §8.4): goal หลักเดือนนี้ — metric ก่อน execution; เป้าเดือนอื่นแสดงย่อด้านล่าง */
export async function GoalProgressWidget({ today }: { today: ISODate }) {
  const t = await getTranslations("widgets.goalProgress");
  const monthStart = startOfMonthISO(today);
  const goals = await listGoalsWithProgress();
  const monthGoals = goals.filter(
    (g) => g.period_type === "month" && g.period_start === monthStart,
  );
  const main = monthGoals.find((g) => g.goal_kind === "metric") ?? monthGoals[0] ?? null;
  const others = monthGoals.filter((g) => g.id !== main?.id);

  return (
    <WidgetShell
      title={t("title")}
      action={
        main ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/goals/${main.id}`}>{t("viewGoal")}</Link>
          </Button>
        ) : null
      }
    >
      {main ? (
        <GoalProgressPanel goal={main} others={others} today={today} />
      ) : (
        <EmptyState
          icon={Target}
          title={t("empty.title")}
          description={t("empty.description")}
          action={
            <Button asChild>
              <Link href="?new=goal" scroll={false}>
                {t("empty.cta")}
              </Link>
            </Button>
          }
        />
      )}
    </WidgetShell>
  );
}
