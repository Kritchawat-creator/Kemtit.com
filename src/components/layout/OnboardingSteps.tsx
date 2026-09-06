import { useTranslations } from "next-intl";
import { cn } from "cn";

type Props = { current: 1 | 2 | 3; total?: number };

/** ตัวบอกขั้น onboarding (Design §8.2 + Claude Design 3c): แถบ 3 ช่วงเต็มความกว้าง + "2/3" ทางขวา */
export function OnboardingSteps({ current, total = 3 }: Props) {
  const t = useTranslations("onboarding");
  return (
    <div className="mb-5 flex items-center gap-3">
      <ol className="flex flex-1 items-center gap-1.5" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <li
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i + 1 <= current ? "bg-brand-500" : "bg-brand-100",
            )}
          />
        ))}
      </ol>
      <p className="text-small font-medium text-text-secondary">
        <span className="sr-only">{t("step", { current, total })}</span>
        <span aria-hidden="true">{t("stepShort", { current, total })}</span>
      </p>
    </div>
  );
}
