import type { Domain } from "@/core/domain/domains";
import type { TaskPriority } from "@/core/tasks/schema";
import type { SuggestedItem } from "@/core/shared/suggestions";

import { domainForFocusArea, type FocusAreaId, type RoleCode } from "./roles";

export type StarterSuggestionKind = "task" | "goal" | "habit";

export type StarterSuggestionCopyKey =
  | "employeeGoal"
  | "sellerGoal"
  | "studentGoal"
  | "freelancerGoal"
  | "workPriority"
  | "dailyLifePlan"
  | "financeBudget"
  | "healthRoutine"
  | "studyRoutine";

type StarterTaskDefaults = {
  kind: "task";
  domain: Domain;
  due: "today";
  priority: TaskPriority;
  estimatedMinutes?: number;
};

type StarterGoalDefaults = {
  kind: "goal";
  domain: Domain;
  periodType: "month";
  goalKind: "execution";
};

type StarterHabitDefaults = {
  kind: "habit";
  domain: Domain;
  cadence: "daily" | "weekly";
  targetPerWeek: number;
  estimatedMinutes?: number;
};

export type StarterSuggestionDefaults =
  | StarterTaskDefaults
  | StarterGoalDefaults
  | StarterHabitDefaults;

export type StarterSuggestion = SuggestedItem<StarterSuggestionKind, StarterSuggestionDefaults> & {
  area: FocusAreaId;
  copyKey: StarterSuggestionCopyKey;
};

const ROLE_GOALS: Record<RoleCode, StarterSuggestion> = {
  employee: {
    id: "starter-role-employee-goal",
    type: "goal",
    origin: "SUGGESTED",
    area: "work",
    copyKey: "employeeGoal",
    titleKey: "employeeGoal.title",
    subtitleKey: "employeeGoal.subtitle",
    reasonKey: "role",
    defaultValues: {
      kind: "goal",
      domain: "work",
      periodType: "month",
      goalKind: "execution",
    },
  },
  seller: {
    id: "starter-role-seller-goal",
    type: "goal",
    origin: "SUGGESTED",
    area: "work",
    copyKey: "sellerGoal",
    titleKey: "sellerGoal.title",
    subtitleKey: "sellerGoal.subtitle",
    reasonKey: "role",
    defaultValues: {
      kind: "goal",
      domain: "work",
      periodType: "month",
      goalKind: "execution",
    },
  },
  student: {
    id: "starter-role-student-goal",
    type: "goal",
    origin: "SUGGESTED",
    area: "study",
    copyKey: "studentGoal",
    titleKey: "studentGoal.title",
    subtitleKey: "studentGoal.subtitle",
    reasonKey: "role",
    defaultValues: {
      kind: "goal",
      domain: "growth",
      periodType: "month",
      goalKind: "execution",
    },
  },
  freelancer: {
    id: "starter-role-freelancer-goal",
    type: "goal",
    origin: "SUGGESTED",
    area: "work",
    copyKey: "freelancerGoal",
    titleKey: "freelancerGoal.title",
    subtitleKey: "freelancerGoal.subtitle",
    reasonKey: "role",
    defaultValues: {
      kind: "goal",
      domain: "work",
      periodType: "month",
      goalKind: "execution",
    },
  },
};

const FOCUS_SUGGESTIONS: Record<FocusAreaId, StarterSuggestion> = {
  work: {
    id: "starter-focus-work-priority",
    type: "task",
    origin: "SUGGESTED",
    area: "work",
    copyKey: "workPriority",
    titleKey: "workPriority.title",
    subtitleKey: "workPriority.subtitle",
    reasonKey: "focus",
    defaultValues: {
      kind: "task",
      domain: domainForFocusArea("work"),
      due: "today",
      priority: "high",
      estimatedMinutes: 30,
    },
  },
  daily_life: {
    id: "starter-focus-daily-life-plan",
    type: "task",
    origin: "SUGGESTED",
    area: "daily_life",
    copyKey: "dailyLifePlan",
    titleKey: "dailyLifePlan.title",
    subtitleKey: "dailyLifePlan.subtitle",
    reasonKey: "focus",
    defaultValues: {
      kind: "task",
      domain: domainForFocusArea("daily_life"),
      due: "today",
      priority: "normal",
      estimatedMinutes: 10,
    },
  },
  finance: {
    id: "starter-focus-finance-budget",
    type: "task",
    origin: "SUGGESTED",
    area: "finance",
    copyKey: "financeBudget",
    titleKey: "financeBudget.title",
    subtitleKey: "financeBudget.subtitle",
    reasonKey: "focus",
    defaultValues: {
      kind: "task",
      domain: domainForFocusArea("finance"),
      due: "today",
      priority: "normal",
      estimatedMinutes: 15,
    },
  },
  health: {
    id: "starter-focus-health-routine",
    type: "habit",
    origin: "SUGGESTED",
    area: "health",
    copyKey: "healthRoutine",
    titleKey: "healthRoutine.title",
    subtitleKey: "healthRoutine.subtitle",
    reasonKey: "focus",
    defaultValues: {
      kind: "habit",
      domain: domainForFocusArea("health"),
      cadence: "weekly",
      targetPerWeek: 3,
      estimatedMinutes: 20,
    },
  },
  study: {
    id: "starter-focus-study-routine",
    type: "habit",
    origin: "SUGGESTED",
    area: "study",
    copyKey: "studyRoutine",
    titleKey: "studyRoutine.title",
    subtitleKey: "studyRoutine.subtitle",
    reasonKey: "focus",
    defaultValues: {
      kind: "habit",
      domain: domainForFocusArea("study"),
      cadence: "weekly",
      targetPerWeek: 5,
      estimatedMinutes: 25,
    },
  },
};

export function getStarterSuggestions(
  role: RoleCode,
  focusAreas: readonly FocusAreaId[],
): StarterSuggestion[] {
  const suggestions = [ROLE_GOALS[role], ...focusAreas.map((area) => FOCUS_SUGGESTIONS[area])];
  return suggestions.filter(
    (suggestion, index) => suggestions.findIndex((candidate) => candidate.id === suggestion.id) === index,
  );
}

export function findStarterSuggestion(
  role: RoleCode,
  focusAreas: readonly FocusAreaId[],
  suggestionId: string,
): StarterSuggestion | null {
  return getStarterSuggestions(role, focusAreas).find((suggestion) => suggestion.id === suggestionId) ?? null;
}
