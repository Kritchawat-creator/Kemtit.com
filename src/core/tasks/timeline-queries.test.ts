import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseMock, getTaskCardDataMock } = vi.hoisted(() => ({
  createServerSupabaseMock: vi.fn(),
  getTaskCardDataMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: createServerSupabaseMock,
}));
vi.mock("./card-queries", () => ({ getTaskCardData: getTaskCardDataMock }));

import { getTimelineBoardItems } from "./timeline-queries";
import type { DayTaskItem } from "@/core/domain/dayplan";
import type { TaskWithGoal } from "./schema";

type QueryResult = { data: unknown[] | null; error: { code: string } | null };
type QueryBuilder = {
  select: (...args: unknown[]) => QueryBuilder;
  in: (column: string, values: unknown[]) => QueryBuilder;
  is: (column: string, value: unknown) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  neq: (column: string, value: unknown) => QueryBuilder;
  order: (...args: unknown[]) => QueryBuilder;
  limit: (value: number) => QueryBuilder;
  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2>;
};

function makeTask(id: string, domain: string): TaskWithGoal {
  return {
    id,
    domain,
    title: id,
    recurrence_rule: null,
    status: "planned",
    completed_at: null,
    archived_at: null,
    deleted_at: null,
    data_origin: "USER",
    planned_date: null,
    due_date: null,
    deadline: null,
    task_group_id: null,
    task_group_position: 0,
  } as unknown as TaskWithGoal;
}

function makeSupabase(taskRows: TaskWithGoal[]) {
  const queryCalls: { table: string; operation: string; args: unknown[] }[] = [];
  const from = vi.fn((table: string) => {
    let rows: unknown[] = table === "tasks" ? taskRows : [];
    const query = {} as QueryBuilder;
    Object.assign(query, {
      select: (...args: unknown[]) => {
        queryCalls.push({ table, operation: "select", args });
        return query;
      },
      in: (column: string, values: unknown[]) => {
        queryCalls.push({ table, operation: "in", args: [column, values] });
        rows = rows.filter((row) => values.includes((row as Record<string, unknown>)[column]));
        return query;
      },
      is: (column: string, value: unknown) => {
        queryCalls.push({ table, operation: "is", args: [column, value] });
        rows = rows.filter((row) => (row as Record<string, unknown>)[column] === value);
        return query;
      },
      eq: (column: string, value: unknown) => {
        queryCalls.push({ table, operation: "eq", args: [column, value] });
        rows = rows.filter((row) => (row as Record<string, unknown>)[column] === value);
        return query;
      },
      neq: (column: string, value: unknown) => {
        queryCalls.push({ table, operation: "neq", args: [column, value] });
        rows = rows.filter((row) => (row as Record<string, unknown>)[column] !== value);
        return query;
      },
      order: (...args: unknown[]) => {
        queryCalls.push({ table, operation: "order", args });
        return query;
      },
      limit: (value: number) => {
        queryCalls.push({ table, operation: "limit", args: [value] });
        rows = rows.slice(0, value);
        return query;
      },
      then<TResult1 = QueryResult, TResult2 = never>(
        onFulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
        onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ): Promise<TResult1 | TResult2> {
        return Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected);
      },
    });
    return query;
  });

  createServerSupabaseMock.mockResolvedValue({ from });
  return { queryCalls };
}

describe("Calendar timeline task queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies Life scope before the tray limit and merges selected-day tasks outside that page", async () => {
    const libraryRows = [
      ...Array.from({ length: 220 }, (_, index) => makeTask(`work-${index}`, "work")),
      ...Array.from({ length: 220 }, (_, index) => makeTask(`life-${index}`, "growth")),
    ];
    const selectedDayTask = makeTask("selected-day-only", "growth");
    const linkedBlock = {
      id: "linked-block-1",
      task_id: selectedDayTask.id,
      task_occurrence_id: null,
      occurrence_date: null,
      start_at: "2026-10-09T02:30:00.000Z",
      end_at: "2026-10-09T03:00:00.000Z",
      version: 2,
      is_locked: false,
    };
    const { queryCalls } = makeSupabase(libraryRows);
    getTaskCardDataMock.mockImplementation(async (tasks: TaskWithGoal[]) => ({
      tasks: tasks.map((task) => ({
        ...task,
        photos: [],
        linkedBlocks: task.id === selectedDayTask.id ? [linkedBlock] : [],
      })),
      groups: [],
      groupMembers: [],
      pendingPhotos: [],
    }));
    const selectedDayItem = {
      key: selectedDayTask.id,
      task: selectedDayTask,
      date: "2026-10-09",
      done: false,
      overdue: false,
      recurring: false,
      actionable: true,
    } as DayTaskItem<TaskWithGoal>;

    const result = await getTimelineBoardItems([selectedDayItem], "life", "2026-10-09");

    const domainFilterIndex = queryCalls.findIndex(
      (call) => call.table === "tasks" && call.operation === "neq" && call.args[0] === "domain",
    );
    const limitIndex = queryCalls.findIndex(
      (call) => call.table === "tasks" && call.operation === "limit",
    );
    expect(domainFilterIndex).toBeGreaterThanOrEqual(0);
    expect(domainFilterIndex).toBeLessThan(limitIndex);
    expect(result.hasMoreTasks).toBe(true);
    expect(result.items).toHaveLength(201);
    expect(result.items.every((item) => item.task.domain !== "work")).toBe(true);
    expect(result.items).toContainEqual(
      expect.objectContaining({
        key: selectedDayTask.id,
        task: expect.objectContaining({ id: selectedDayTask.id }),
        linkedBlocks: [expect.objectContaining({ id: linkedBlock.id, version: 2 })],
      }),
    );
    expect(getTaskCardDataMock).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: selectedDayTask.id })]),
    );
  });
});
