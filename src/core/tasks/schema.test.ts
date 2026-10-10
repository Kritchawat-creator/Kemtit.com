import { describe, expect, it } from "vitest";

import { taskFormSchema } from "./schema";

const validTask = {
  title: "Estimate a task",
  dueDate: "2026-10-10",
  plannedDate: "2026-10-10",
  deadline: null,
  domain: "work",
  recurrence: "none",
};

describe("taskFormSchema estimatedMinutes", () => {
  it.each([1, 30, 45, 1440, null, undefined])("accepts %s minutes", (estimatedMinutes) => {
    expect(taskFormSchema.safeParse({ ...validTask, estimatedMinutes }).success).toBe(true);
  });

  it.each([0, 1441, 30.5, Number.NaN])(
    "returns a corrective range message key for %s minutes",
    (estimatedMinutes) => {
      const result = taskFormSchema.safeParse({ ...validTask, estimatedMinutes });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.find((issue) => issue.path[0] === "estimatedMinutes")?.message,
        ).toBe("estimatedMinutesRange");
      }
    },
  );
});
