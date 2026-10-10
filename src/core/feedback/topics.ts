export const feedbackTopicCodes = [
  "easy_to_use",
  "hard_to_use",
  "slow",
  "error",
  "more_features",
] as const;

export type FeedbackTopicCode = (typeof feedbackTopicCodes)[number];
