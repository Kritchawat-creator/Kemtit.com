import { periodOf, suggestChildPeriods } from "@/core/domain/periods";
import type { GoalSpec } from "@/core/goals/schema";
import { isAfterISO, type ISODate } from "@/lib/date";

export const professionalPersona = { id: "professional" as const };

export type ProfessionalTemplateLabels = {
  weekGoalTitle: (index: number, total: number) => string;
  sampleTask: (index: number) => string;
};

export type ProfessionalFirstGoalInput = { monthStart: ISODate; title: string };

/**
 * Professional onboarding starts with an execution outcome rather than forcing
 * every knowledge worker into an arbitrary numeric "items" metric.
 */
export function professionalFirstGoalSpec(
  input: ProfessionalFirstGoalInput,
  labels: ProfessionalTemplateLabels,
): GoalSpec {
  const month = periodOf("month", input.monthStart);
  const weeks = suggestChildPeriods(month, "week");
  return {
    title: input.title.trim(),
    periodType: "month",
    periodStart: month.start,
    domain: "work",
    goalKind: "execution",
    children: weeks.map((week, index) => ({
      title: labels.weekGoalTitle(index + 1, weeks.length),
      periodType: "week",
      periodStart: week.start,
      domain: "work",
      goalKind: "execution",
      tasks: [
        {
          title: labels.sampleTask(index + 1),
          dueDate: isAfterISO(month.start, week.start) ? month.start : week.start,
          domain: "work",
        },
      ],
    })),
  };
}
