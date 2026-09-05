import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { EmptyState } from "@/components/domain/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("calendar");
  return { title: t("title") };
}

/** M1 placeholder — เนื้อหาจริงมาใน milestone ถัดไป */
export default async function Page() {
  const t = await getTranslations("calendar");
  return (
    <>
      <PageHeader title={t("title")} />
      <EmptyState
        icon={CalendarDays}
        title={t("empty.title")}
        description={t("empty.description")}
        action={
          <Button asChild>
            <Link href="?new=task" scroll={false}>{t("empty.cta")}</Link>
          </Button>
        }
      />
    </>
  );
}
