import { describe, expect, it } from "vitest";

import { reorderVisiblePriorityIds, splitPrioritizedDayItems } from "./prioritized-day-items";

describe("splitPrioritizedDayItems", () => {
  it("keeps saved priority order and does not collapse distinct occurrences", () => {
    const items = [
      { key: "task-b", task: { id: "task-b", title: "Second priority" } },
      { key: "task-a:one", task: { id: "task-a", title: "First priority" } },
      { key: "task-a:two", task: { id: "task-a", title: "First priority" } },
      { key: "task-c", task: { id: "task-c", title: "Other task" } },
    ];

    const result = splitPrioritizedDayItems(items, ["task-a", "task-b"]);

    expect(result.prioritized.map((item) => item.key)).toEqual([
      "task-a:one",
      "task-a:two",
      "task-b",
    ]);
    expect(result.remaining.map((item) => item.key)).toEqual(["task-c"]);
  });

  it("ignores duplicate or out-of-limit task ids", () => {
    const items = ["a", "b", "c", "d"].map((id) => ({ task: { id } }));

    const result = splitPrioritizedDayItems(items, ["d", "b", "d", "a"], 2);

    expect(result.prioritized.map((item) => item.task.id)).toEqual(["d", "b"]);
    expect(result.remaining.map((item) => item.task.id)).toEqual(["a", "c"]);
  });
});

describe("reorderVisiblePriorityIds", () => {
  it("reorders visible scope picks while preserving hidden scope picks in their slots", () => {
    expect(
      reorderVisiblePriorityIds(
        ["life-a", "work-a", "work-b"],
        ["work-a", "work-b"],
        ["work-b", "work-a"],
      ),
    ).toEqual(["life-a", "work-b", "work-a"]);
  });

  it("leaves the original order intact when the visible selection does not match", () => {
    expect(reorderVisiblePriorityIds(["a", "hidden"], ["a"], ["b"])).toEqual(["a", "hidden"]);
  });
});
