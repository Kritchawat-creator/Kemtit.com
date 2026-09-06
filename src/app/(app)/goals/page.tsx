import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import type { DomainFilter } from "@/core/domain/domains";
import { PERIOD_TYPES, type PeriodType } from "@/core/domain/periods";
import { listGoalsWithProgress, type GoalWithProgress } from "@/core/goals/queries";
import { todayBkk } from "@/lib/date";
import { formatThaiDate } from "@/lib/format";
import { EmptyState } from "@/components/domain/EmptyState";
import { GoalCard } from "@/components/domain/GoalCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { SegmentedNav } from "@/components/ui/segmented-nav";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("goals");
  return { title: t("title") };
}

const FILTERS: DomainFilter[] = ["all", "work", "life"];

function parseFilter(value: string | string[] | undefined): DomainFilter {
  return typeof value === "string" && (FILTERS as string[]).includes(value)
    ? (value as DomainFilter)
    : "all";
}

/** หน้าเป้าหมาย (Design §8.2 + Claude Design 3h): pill เดือน → segmented filter → GoalCard เรียงตามชั้น ปี → เดือน → สัปดาห์ */
export default async function GoalsPage({ searchParams }: PageProps<"/goals">) {
  const { domain } = await searchParams;
  const filter = parseFilter(domain);
  const [t, tf, goals] = await Promise.all([
    getTranslations("goals"),
    getTranslations("domainFilter"),
    listGoalsWithProgress({ domainFilter: filter }),
  ]);

  const groups = PERIOD_TYPES.map((type) => ({
    type,
    goals: goals.filter((g) => g.period_type === type),
  })).filter((g) => g.goals.length > 0);

  return (
    <>
      <PageHeader
        title={t("title")}
        meta={formatThaiDate(todayBkk(), "monthYear")}
        actions={
          <span className="inline-flex h-7 items-center rounded-full bg-bg-surface px-3 text-caption font-medium text-text-secondary">
            {formatThaiDate(todayBkk(), "monthYear")}
          </span>
        }
        toolbarStart={
          <SegmentedNav
            label={tf("label")}
            items={FILTERS.map((f) => ({
              key: f,
              href: f === "all" ? "/goals" : `/goals?domain=${f}`,
              label: tf(f),
              active: filter === f,
            }))}
          />
        }
        toolbarEnd={
          <Button asChild>
            <Link href="?new=goal" scroll={false}>
              <Plus aria-hidden="true" />
              {t("newDesktop")}
            </Link>
          </Button>
        }
      />

      {groups.length === 0 ? (
        <EmptyState
          illustration="compass"
          eyebrow={filter === "all" ? t("empty.eyebrow") : undefined}
          title={filter === "all" ? t("empty.title") : t("emptyFiltered.title")}
          description={filter === "all" ? t("empty.description") : t("emptyFiltered.description")}
          action={
            <Button asChild>
              <Link href="?new=goal" scroll={false}>
                {t("empty.cta")}
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6 lg:mt-3">
          {groups.map((group) => (
            <GoalGroup
              key={group.type}
              type={group.type}
              goals={group.goals}
              label={t(`groups.${group.type}`)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function GoalGroup({
  type,
  goals,
  label,
}: {
  type: PeriodType;
  goals: GoalWithProgress[];
  label: string;
}) {
  return (
    <section aria-labelledby={`group-${type}`}>
      <h2 id={`group-${type}`} className="mb-2 text-h2 text-brand-800">
        {label}
      </h2>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {goals.map((goal) => (
          <GoalCard key={goal.id} goal={goal} className="lg:px-6 lg:py-5" />
        ))}
      </div>
    </section>
  );
}
