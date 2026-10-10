// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setDailyPriorityOrder: vi.fn(),
  undoDailyPriorityOrder: vi.fn(),
  refresh: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

vi.mock("@/core/planning/priority-actions", () => ({
  setDailyPriorityOrder: mocks.setDailyPriorityOrder,
  undoDailyPriorityOrder: mocks.undoDailyPriorityOrder,
}));
vi.mock("@/components/domain/TaskList", () => ({
  TaskList: ({ items }: { items: { key: string; task: { title: string } }[] }) => (
    <div>
      {items.map((item) => (
        <span key={item.key}>{item.task.title}</span>
      ))}
    </div>
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, values?: Record<string, string | number>) =>
    values ? `${key} ${Object.values(values).join("/")}` : key,
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));

import { DailyPriorityList } from "./DailyPriorityList";

const taskA = "00000000-0000-4000-8000-000000000001";
const taskB = "00000000-0000-4000-8000-000000000002";
const taskC = "00000000-0000-4000-8000-000000000003";
const hiddenLifeTask = "00000000-0000-4000-8000-000000000004";

function item(id: string, title: string, key = id) {
  return {
    key,
    date: "2026-10-09",
    task: {
      id,
      title,
      domain: "work",
      due_date: "2026-10-09",
      recurrence_rule: null,
      completed_at: null,
      goal_id: null,
    },
    done: false,
    overdue: false,
    recurring: false,
  } as never;
}

function renderList(
  priorityTaskIds = [taskA, taskB],
  eligiblePriorityTaskIds = [taskA, taskB, taskC],
  userId = "user-1",
) {
  return render(
    <DailyPriorityList
      userId={userId}
      planDate="2026-10-09"
      items={[
        item(taskA, "Task A"),
        item(taskA, "Task A", `${taskA}:second`),
        item(taskB, "Task B"),
        item(taskC, "Task C"),
      ]}
      eligiblePriorityTaskIds={eligiblePriorityTaskIds}
      priorityTaskIds={priorityTaskIds}
      version={2}
      priorityIsSaved
      goalOptions={[]}
    />,
  );
}

describe("DailyPriorityList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    mocks.setDailyPriorityOrder.mockResolvedValue({
      ok: true,
      data: {
        operationId: "00000000-0000-4000-8000-000000000010",
        priorityTaskIds: [taskB, taskA],
        version: 3,
      },
    });
    mocks.undoDailyPriorityOrder.mockResolvedValue({
      ok: true,
      data: {
        operationId: "00000000-0000-4000-8000-000000000010",
        priorityTaskIds: [taskA, taskB],
        version: 4,
        undone: true,
      },
    });
  });

  it("reorders by keyboard controls, preserves hidden-scope picks, and offers Undo", async () => {
    mocks.setDailyPriorityOrder.mockResolvedValueOnce({
      ok: true,
      data: {
        operationId: "00000000-0000-4000-8000-000000000010",
        priorityTaskIds: [hiddenLifeTask, taskB, taskA],
        version: 3,
      },
    });
    mocks.undoDailyPriorityOrder.mockResolvedValueOnce({
      ok: true,
      data: {
        operationId: "00000000-0000-4000-8000-000000000010",
        priorityTaskIds: [hiddenLifeTask, taskA, taskB],
        version: 4,
        undone: true,
      },
    });
    renderList([hiddenLifeTask, taskA, taskB], [hiddenLifeTask, taskA, taskB, taskC]);

    fireEvent.click(screen.getByRole("button", { name: "moveDown Task A" }));

    await waitFor(() =>
      expect(mocks.setDailyPriorityOrder).toHaveBeenCalledWith({
        operationId: expect.any(String),
        planDate: "2026-10-09",
        priorityTaskIds: [hiddenLifeTask, taskB, taskA],
        expectedVersion: 2,
      }),
    );
    expect(screen.getAllByText("Task A")).toHaveLength(3);

    const toastOptions = mocks.toast.mock.calls[0][1];
    expect(toastOptions.action.label).toBe("common.undo");
    toastOptions.action.onClick();

    await waitFor(() =>
      expect(mocks.undoDailyPriorityOrder).toHaveBeenCalledWith({
        operationId: mocks.setDailyPriorityOrder.mock.calls[0][0].operationId,
      }),
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("enforces the global three-task limit while retaining every occurrence in a priority group", () => {
    renderList([hiddenLifeTask, taskA, taskB], [hiddenLifeTask, taskA, taskB, taskC]);
    fireEvent.click(screen.getByText("choosePriorities"));

    expect(screen.getAllByText("Task A")).toHaveLength(3);
    expect(screen.getByRole("checkbox", { name: "Task A" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Task B" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Task C" })).toBeDisabled();
    expect(screen.getByText("planning.topPrioritiesHint 3/3")).toBeVisible();
  });

  it("adds a task when checked and removes it when unchecked", async () => {
    mocks.setDailyPriorityOrder
      .mockResolvedValueOnce({
        ok: true,
        data: { operationId: "op-add", priorityTaskIds: [taskA, taskB, taskC], version: 3 },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { operationId: "op-remove", priorityTaskIds: [taskA, taskC], version: 4 },
      });
    renderList();
    fireEvent.click(screen.getByText("choosePriorities"));

    fireEvent.click(screen.getByRole("checkbox", { name: "Task C" }));
    await waitFor(() =>
      expect(mocks.setDailyPriorityOrder).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ priorityTaskIds: [taskA, taskB, taskC] }),
      ),
    );
    expect(screen.getByRole("checkbox", { name: "Task C" })).toBeChecked();

    fireEvent.click(screen.getByRole("checkbox", { name: "Task B" }));
    await waitFor(() =>
      expect(mocks.setDailyPriorityOrder).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ priorityTaskIds: [taskA, taskC] }),
      ),
    );
    expect(screen.getByRole("checkbox", { name: "Task B" })).not.toBeChecked();
  });

  it("keeps uncertain priority operations isolated by account", async () => {
    const pendingRequest = {
      kind: "apply",
      userId: "user-1",
      operationId: "00000000-0000-4000-8000-000000000011",
      planDate: "2026-10-09",
      priorityTaskIds: [taskB, taskA],
      previousPriorityTaskIds: [taskA, taskB],
      expectedVersion: 2,
    };
    window.sessionStorage.setItem(
      "kemtit:daily-priority:user-1:2026-10-09",
      JSON.stringify(pendingRequest),
    );

    renderList([taskA, taskB], [taskA, taskB, taskC], "user-2");
    fireEvent.click(screen.getByRole("button", { name: "moveDown Task A" }));

    await waitFor(() => expect(mocks.setDailyPriorityOrder).toHaveBeenCalledTimes(1));
    expect(window.sessionStorage.getItem("kemtit:daily-priority:user-1:2026-10-09")).toBe(
      JSON.stringify(pendingRequest),
    );
  });

  it("keeps an uncertain apply in session storage and retries the exact operation after remount", async () => {
    mocks.setDailyPriorityOrder.mockRejectedValueOnce(new Error("response lost"));
    const firstRender = renderList();

    fireEvent.click(screen.getByRole("button", { name: "moveDown Task A" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("priorityRetryPending"),
    );

    const firstRequest = mocks.setDailyPriorityOrder.mock.calls[0][0];
    expect(firstRequest).toMatchObject({
      planDate: "2026-10-09",
      priorityTaskIds: [taskB, taskA],
      expectedVersion: 2,
    });
    expect(
      JSON.parse(
        window.sessionStorage.getItem("kemtit:daily-priority:user-1:2026-10-09") ?? "null",
      ),
    ).toMatchObject({ kind: "apply", operationId: firstRequest.operationId });

    firstRender.unmount();
    renderList();
    await waitFor(() => expect(screen.getByRole("status")).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "common.retry" }));

    await waitFor(() => expect(mocks.setDailyPriorityOrder).toHaveBeenCalledTimes(2));
    expect(mocks.setDailyPriorityOrder.mock.calls[1][0]).toEqual(firstRequest);
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(window.sessionStorage.getItem("kemtit:daily-priority:user-1:2026-10-09")).toBeNull();
  });

  it("retries an uncertain Undo with the same operation ID", async () => {
    mocks.undoDailyPriorityOrder.mockRejectedValueOnce(new Error("response lost"));
    renderList();
    fireEvent.click(screen.getByRole("button", { name: "moveDown Task A" }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    const operationId = mocks.setDailyPriorityOrder.mock.calls[0][0].operationId;
    mocks.toast.mock.calls[0][1].action.onClick();
    await waitFor(() => expect(screen.getByRole("status")).toBeVisible());

    fireEvent.click(screen.getByRole("button", { name: "common.retry" }));
    await waitFor(() => expect(mocks.undoDailyPriorityOrder).toHaveBeenCalledTimes(2));
    expect(mocks.undoDailyPriorityOrder.mock.calls).toEqual([[{ operationId }], [{ operationId }]]);
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("restores the previous order and explains a stale priority conflict", async () => {
    mocks.setDailyPriorityOrder.mockResolvedValueOnce({
      ok: false,
      error: "priorityConflict",
    });
    renderList();

    fireEvent.click(screen.getByRole("button", { name: "moveDown Task A" }));

    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith("priorityChangePending"));
    expect(screen.getAllByText("Task A")).toHaveLength(3);
    expect(mocks.refresh).toHaveBeenCalled();
  });
});
