import { z } from "zod";

import { feedbackTopicCodes } from "./topics";

export { feedbackTopicCodes } from "./topics";

export const feedbackTopicCodeSchema = z.enum(feedbackTopicCodes);

export const feedbackSubmissionSchema = z
  .object({
    requestId: z.uuid(),
    topicCode: feedbackTopicCodeSchema,
  })
  .strict();

export type { FeedbackTopicCode } from "./topics";
export type FeedbackSubmissionInput = z.infer<typeof feedbackSubmissionSchema>;
