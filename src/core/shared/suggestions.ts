import type { DataOrigin } from "./data-origin";

export type SuggestionDecision = "pending" | "accepted" | "skipped";

export type SuggestedItem<TType extends string = string, TDefaults = Record<string, unknown>> = {
  id: string;
  type: TType;
  origin: Extract<DataOrigin, "SUGGESTED">;
  area: string;
  titleKey: string;
  subtitleKey?: string;
  reasonKey?: string;
  defaultValues: TDefaults;
};
