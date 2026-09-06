import { Plus, Target } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { cn } from "cn";

import type { DomainFilter } from "@/core/domain/domains";
import { PERIOD_TYPES, type PeriodType } from "@/core/domain/periods";
import { listGoalsWithProgress, type GoalWithProgress } from "@/core/goals/queries";
import { EmptyState } from "@/components/domain/EmptyState";
import { GoalCard } from "@/components/domain/GoalCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";

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

/** หน้าเป้าหมาย (Design §8.2): filter งาน/ชีวิต → GoalCard เรียงตามชั้น ปี → เดือน → สัปดาห์ */
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
        description={t("subtitle")}
        actions={
          <Button asChild>
            <Link href="?new=goal" scroll={false}>
              <Plus aria-hidden="true" />
              {t("new")}
            </Link>
          </Button>
        }
      />

      <nav aria-label={tf("label")} className="mb-6 flex gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/goals" : `/goals?domain=${f}`}
            aria-current={filter === f ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full border px-4 text-small transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:min-h-9",
              filter === f
                ? "border-transparent bg-brand-500 text-neutral-0"
                : "border-border bg-bg-surface text-text-secondary hover:border-border-strong",
            )}
          >
            {tf(f)}
          </Link>
        ))}
      </nav>

      {groups.length === 0 ? (
        <EmptyState
          icon={Target}
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
        <div className="space-y-8">
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
      <h2 id={`group-${type}`} className="mb-3 text-h2 text-text-primary">
        {label}
      </h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {goals.map((goal) => (
          <GoalCard key={goal.id} goal={goal} />
        ))}
      </div>
    </section>
  );
}
