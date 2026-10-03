import Link from "next/link";
import { ReceiptText, Target, WalletCards } from "@/components/icons/ui-icons";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

const EXAMPLES = [
  { key: "budget", icon: WalletCards, href: "#finance-budget-heading" },
  { key: "bill", icon: ReceiptText, href: "#finance-bills-heading" },
  { key: "saving", icon: Target, href: "/goals?new=goal&domain=finance&goalKind=metric&unit=THB" },
] as const;

export function FinanceStarterGuide() {
  const t = useTranslations("finance.starter");

  return (
    <section
      className="mb-4 rounded-xl bg-brand-50 p-5 shadow-md lg:mb-6"
      aria-labelledby="finance-starter-heading"
    >
      <div className="max-w-2xl">
        <span className="inline-flex rounded-full bg-bg-surface px-2.5 py-1 text-caption font-semibold text-brand-700">
          {t("exampleBadge")}
        </span>
        <h2 id="finance-starter-heading" className="mt-3 text-h2 text-text-primary">
          {t("title")}
        </h2>
        <p className="mt-1 text-small text-text-secondary">{t("description")}</p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {EXAMPLES.map(({ key, icon: Icon, href }) => (
          <article key={key} className="rounded-xl border border-border bg-bg-surface p-4 shadow-sm">
            <Icon className="size-5 text-brand-500" aria-hidden="true" />
            <p className="mt-2 text-body font-medium text-text-primary">{t(`${key}.title`)}</p>
            <p className="mt-1 text-caption text-text-secondary">{t(`${key}.description`)}</p>
            <p className="mt-3 text-caption font-medium text-text-muted">{t("notYourData")}</p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href={href} scroll={false}>{t(`${key}.cta`)}</Link>
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}
