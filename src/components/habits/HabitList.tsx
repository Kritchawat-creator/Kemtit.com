"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { toggleHabit } from "@/core/habits/actions";
import type { ISODate } from "@/lib/date";
import { Button } from "@/components/ui/button";

type Habit = { id: string; title: string; domain: string; cadence: string; done: boolean };

export function HabitList({ habits, date }: { habits: Habit[]; date: ISODate }) {
  const t = useTranslations();
  const td = useTranslations("domains");
  const router = useRouter();
  const [, startTransition] = useTransition();

  function toggle(habit: Habit) {
    startTransition(async () => {
      const result = await toggleHabit({ habitId: habit.id, date, done: !habit.done });
      if (!result.ok) {
        toast.error(t("errors.generic"));
        return;
      }
      toast.success(habit.done ? t("habits.uncompleted") : t("habits.completed"));
      router.refresh();
    });
  }

  if (habits.length === 0)
    return <p className="text-small text-text-secondary">{t("habits.empty")}</p>;

  return (
    <ul className="divide-y divide-border">
      {habits.map((habit) => (
        <li key={habit.id} className="flex min-h-14 items-center justify-between gap-3 py-2">
          <div>
            <p
              className={
                habit.done
                  ? "text-body text-text-muted line-through"
                  : "text-body text-text-primary"
              }
            >
              {habit.title}
            </p>
            <p className="text-caption text-text-secondary">
              {td(
                habit.domain as
                  "work" | "health" | "family" | "finance" | "growth" | "relationships",
              )}
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant={habit.done ? "default" : "outline"}
            aria-label={t("habits.toggle", { title: habit.title })}
            onClick={() => toggle(habit)}
          >
            <Check aria-hidden="true" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
