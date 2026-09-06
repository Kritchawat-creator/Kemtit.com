import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { listGoalsWithProgress } from "@/core/goals/queries";
import { type ISODate, startOfMonthISO } from "@/lib/date";
import { EmptyState } from "@/components/domain/EmptyState";
import { Button } from "@/components/ui/button";

import { GoalProgressPanel } from "./GoalProgressPanel";

/**
 * widget บนสุดเสมอ (Design §8.4 + Claude Design 2a hero): goal หลักเดือนนี้บนการ์ด brand-100 มุม 28px + หน้าปัดเข็มทิศ
 * metric ก่อน execution; เป้าเดือนอื่นแสดงย่อด้านล่าง · ไม่มีเป้า = การ์ดขาว "ยังไม่ได้ตั้งทิศ"
 */
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
    <section aria-label={t("title")}>
      <h2 className="sr-only">{t("title")}</h2>
      {main ? (
        <div className="rounded-2xl bg-brand-100 p-5 shadow-lg">
          <GoalProgressPanel goal={main} others={others} today={today} />
        </div>
      ) : (
        <EmptyState
          illustration="compass"
          eyebrow={t("empty.eyebrow")}
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
    </section>
  );
}
