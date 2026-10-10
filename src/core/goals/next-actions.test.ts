import { describe, expect, it } from "vitest";

import { selectNextActionByGoal, type GoalTaskCandidate } from "./next-actions";

const task = (
  overrides: Partial<GoalTaskCandidate> & Pick<GoalTaskCandidate, "id" | "goal_id">,
) => ({
  title: overrides.id,
  planned_date: null,
  due_date: null,
  created_at: "2026-10-01T08:00:00.000Z",
  ...overrides,
});

describe("selectNextActionByGoal", () => {
  it("chooses the earliest planned action independently for each goal", () => {
    const next = selectNextActionByGoal([
      task({ id: "later", goal_id: "goal-1", planned_date: "2026-10-04" }),
      task({ id: "other", goal_id: "goal-2", due_date: "2026-10-03" }),
      task({ id: "first", goal_id: "goal-1", planned_date: "2026-10-02" }),
    ]);

    expect(next.get("goal-1")?.id).toBe("first");
    expect(next.get("goal-2")?.id).toBe("other");
  });

  it("uses due date when no planned date exists, then creation date when unscheduled", () => {
    const next = selectNextActionByGoal([
      task({ id: "unscheduled-new", goal_id: "goal-1", created_at: "2026-10-03T08:00:00Z" }),
      task({ id: "due", goal_id: "goal-1", due_date: "2026-10-02" }),
    ]);

    expect(next.get("goal-1")?.id).toBe("due");
  });
});
