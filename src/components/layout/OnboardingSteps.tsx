import { useTranslations } from "next-intl";
import { cn } from "cn";

type Props = { current: 1 | 2 | 3; total?: number };

/** ตัวบอกขั้น onboarding (Design §8.2: ต้องเห็นว่าอยู่ขั้นไหนและเหลือกี่ขั้นใน 3 วินาที) */
export function OnboardingSteps({ current, total = 3 }: Props) {
  const t = useTranslations("onboarding");
  return (
    <div className="mb-6 flex items-center gap-3">
      <ol className="flex items-center gap-1.5" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <li
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i + 1 <= current ? "w-6 bg-brand-500" : "w-3 bg-brand-100",
            )}
          />
        ))}
      </ol>
      <p className="text-caption text-text-secondary">{t("step", { current, total })}</p>
    </div>
  );
}
