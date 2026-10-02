import { cn } from "cn";
import { useTranslations } from "next-intl";

type Props = { current: number; total?: number };

/** Shared progress indicator for onboarding steps. */
export function OnboardingSteps({ current, total = 3 }: Props) {
  const t = useTranslations("onboarding");
  const safeCurrent = Math.min(Math.max(current, 1), total);

  return (
    <div className="mb-5 flex items-center gap-3">
      <ol className="flex flex-1 items-center gap-1.5" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <li
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i + 1 <= safeCurrent ? "bg-brand-500" : "bg-brand-100",
            )}
          />
        ))}
      </ol>
      <p className="text-small font-medium text-text-secondary">
        <span className="sr-only">{t("step", { current: safeCurrent, total })}</span>
        <span aria-hidden="true">{t("stepShort", { current: safeCurrent, total })}</span>
      </p>
    </div>
  );
}
