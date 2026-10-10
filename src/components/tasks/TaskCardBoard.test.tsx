// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mutateTaskCardGroup: vi.fn(),
  undoTaskCardGroup: vi.fn(),
  refresh: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

vi.mock("@/core/tasks/card-actions", () => ({
  mutateTaskCardGroup: mocks.mutateTaskCardGroup,
  undoTaskCardGroup: mocks.undoTaskCardGroup,
}));
vi.mock("@/core/photos/actions", () => ({ removePhoto: vi.fn() }));
vi.mock("@/core/photos/task-card-actions", () => ({
  cancelTaskCardPhotoReservation: vi.fn(),
  setTaskCardPhotoOrder: vi.fn(),
}));
vi.mock("@/core/photos/task-card-upload", () => ({
  prepareAndReserveTaskCardPhoto: vi.fn(),
  uploadReservedTaskCardPhoto: vi.fn(),
}));
vi.mock("@/components/domain/DomainTag", () => ({ DomainTag: () => null }));
vi.mock("@/components/domain/TaskForm", () => ({ TaskForm: () => null }));
vi.mock("@/hooks/use-is-mobile", () => ({ useIsMobile: () => false }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, values?: Record<string, string | number>) =>
    values ? `${key} ${Object.values(values).join("/")}` : key,
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));

import { TaskCardBoard } from "./TaskCardBoard";
import type { TaskCardLinkedBlock, TaskCardTask } from "@/core/tasks/card-queries";

const userId = "00000000-0000-4000-8000-000000000010";
const firstTaskId = "00000000-0000-4000-8000-000000000001";
const secondTaskId = "00000000-0000-4000-8000-000000000002";

function task(id: string, title: string): TaskCardTask {
  return {
    id,
    user_id: userId,
    title,
    domain: "work",
    priority: "normal",
    status: "planned",
    due_date: "2026-10-09",
    planned_date: "2026-10-09",
    deadline: null,
    recurrence_rule: null,
    estimated_minutes: 30,
    notes: null,
    completed_at: null,
    archived_at: null,
    deleted_at: null,
    data_origin: "USER",
    goal_id: null,
    goal: null,
    project_id: null,
    created_at: "2026-10-09T00:00:00.000Z",
    updated_at: "2026-10-09T00:00:00.000Z",
    task_group_id: null,
    task_group_position: 0,
    photos: [],
    linkedBlocks: [],
  } as unknown as TaskCardTask;
}

function linkedBlock({
  id,
  taskId = firstTaskId,
  occurrenceDate = null,
  startAt,
  endAt,
}: {
  id: string;
  taskId?: string;
  occurrenceDate?: string | null;
  startAt: string;
  endAt: string;
}): TaskCardLinkedBlock {
  return {
    id,
    task_id: taskId,
    task_occurrence_id: occurrenceDate ? `occurrence-${id}` : null,
    occurrence_date: occurrenceDate,
    start_at: startAt,
    end_at: endAt,
    version: 1,
    is_locked: false,
  };
}

function renderBoard({
  tasks = [task(firstTaskId, "Task A"), task(secondTaskId, "Task B")],
  groups = [],
  groupMembers = [],
}: {
  tasks?: TaskCardTask[];
  groups?: Parameters<typeof TaskCardBoard>[0]["groups"];
  groupMembers?: Parameters<typeof TaskCardBoard>[0]["groupMembers"];
} = {}) {
  return render(
    <TaskCardBoard
      userId={userId}
      tasks={tasks}
      groups={groups}
      groupMembers={groupMembers}
      pendingPhotos={[]}
      today="2026-10-09"
      goalOptions={[]}
      projectOptions={[]}
    />,
  );
}

describe("TaskCardBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("labels task selection checkboxes distinctly", () => {
    renderBoard();

    expect(
      screen.getByRole("checkbox", { name: "taskCards.selectTask Task A" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "taskCards.selectTask Task B" }),
    ).toBeInTheDocument();
  });

  it("renders the linked block's date and start/end while keeping deadline separate", () => {
    const scheduledTask = {
      ...task(firstTaskId, "Scheduled task"),
      deadline: "2026-10-20",
      linkedBlocks: [
        linkedBlock({
          id: "00000000-0000-4000-8000-000000000051",
          startAt: "2026-10-09T02:30:00.000Z",
          endAt: "2026-10-09T03:15:00.000Z",
        }),
      ],
    };
    renderBoard({ tasks: [scheduledTask] });

    const card = screen.getByRole("heading", { name: "Scheduled task" }).closest("article");
    expect(card).not.toBeNull();
    expect(
      within(card!).getByText("taskCards.scheduledTime: 9 Oct 2026 · 09:30–10:15"),
    ).toBeInTheDocument();
    expect(within(card!).getByText("taskCards.deadline: 20 Oct 2026")).toBeInTheDocument();
  });

  it("keeps a date-only task free of an invented time", () => {
    renderBoard({ tasks: [task(firstTaskId, "Date-only task")] });

    const card = screen.getByRole("heading", { name: "Date-only task" }).closest("article");
    expect(card).not.toBeNull();
    expect(within(card!).getByText("taskCards.plannedDate: 9 Oct 2026")).toBeInTheDocument();
    expect(card).not.toHaveTextContent(/\b\d{2}:\d{2}\b/);
  });

  it("shows the exact date and time for each linked recurring occurrence", async () => {
    const scheduledTask = {
      ...task(firstTaskId, "Recurring task"),
      linkedBlocks: [
        linkedBlock({
          id: "00000000-0000-4000-8000-000000000052",
          occurrenceDate: "2026-10-16",
          startAt: "2026-10-16T02:30:00.000Z",
          endAt: "2026-10-16T03:15:00.000Z",
        }),
        linkedBlock({
          id: "00000000-0000-4000-8000-000000000053",
          occurrenceDate: "2026-10-23",
          startAt: "2026-10-23T03:00:00.000Z",
          endAt: "2026-10-23T03:30:00.000Z",
        }),
      ],
    };
    renderBoard({ tasks: [scheduledTask] });

    const card = screen.getByRole("heading", { name: "Recurring task" }).closest("article");
    expect(card).not.toBeNull();
    await userEvent.click(within(card!).getByText("taskCards.multipleScheduledBlocks 2"));

    expect(
      within(card!).getByText("taskCards.occurrenceSchedule 16 Oct 2026/16 Oct 2026 · 09:30–10:15"),
    ).toBeInTheDocument();
    expect(
      within(card!).getByText("taskCards.occurrenceSchedule 23 Oct 2026/23 Oct 2026 · 10:00–10:30"),
    ).toBeInTheDocument();
  });

  it("creates a group from only the selected tasks", async () => {
    const thirdTaskId = "00000000-0000-4000-8000-000000000003";
    mocks.mutateTaskCardGroup.mockResolvedValue({
      ok: true,
      data: {
        operationId: "00000000-0000-4000-8000-000000000020",
        action: "create",
        groupId: "00000000-0000-4000-8000-000000000030",
        canUndo: true,
      },
    });
    renderBoard({
      tasks: [
        task(firstTaskId, "Task A"),
        task(secondTaskId, "Task B"),
        task(thirdTaskId, "Task C"),
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: "taskCards.groupTasks" }));
    const createButton = screen.getByRole("button", { name: "taskCards.createGroup" });
    expect(createButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText("taskCards.groupName"), {
      target: { value: "Selected pair" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "taskCards.selectTask Task A" }));
    expect(createButton).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "taskCards.selectTask Task C" }));
    await waitFor(() => expect(createButton).toBeEnabled());
    fireEvent.click(createButton);

    await waitFor(() => expect(mocks.mutateTaskCardGroup).toHaveBeenCalledTimes(1));
    expect(mocks.mutateTaskCardGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "create",
        groupId: null,
        taskIds: [firstTaskId, thirdTaskId],
        title: "Selected pair",
        expectedGroupVersions: [],
        expectedTaskStates: [
          {
            id: firstTaskId,
            updatedAt: "2026-10-09T00:00:00.000Z",
            groupId: null,
          },
          {
            id: thirdTaskId,
            updatedAt: "2026-10-09T00:00:00.000Z",
            groupId: null,
          },
        ],
      }),
    );
  });

  it("renames a group with its version snapshot but no task snapshots", async () => {
    const groupId = "00000000-0000-4000-8000-000000000040";
    const group = {
      id: groupId,
      user_id: userId,
      title: "Existing",
      position: 0,
      version: 3,
      created_at: "2026-10-09T00:00:00.000Z",
      updated_at: "2026-10-09T00:00:00.000Z",
    };
    mocks.mutateTaskCardGroup.mockResolvedValue({
      ok: true,
      data: {
        operationId: "00000000-0000-4000-8000-000000000020",
        action: "rename",
        groupId,
        canUndo: true,
      },
    });
    renderBoard({
      tasks: [
        { ...task(firstTaskId, "Task A"), task_group_id: groupId },
        { ...task(secondTaskId, "Task B"), task_group_id: groupId },
        task("00000000-0000-4000-8000-000000000003", "Task C"),
      ],
      groups: [group],
      groupMembers: [
        {
          id: firstTaskId,
          task_group_id: groupId,
          task_group_position: 0,
          updated_at: "2026-10-09T00:00:00.000Z",
        },
        {
          id: secondTaskId,
          task_group_id: groupId,
          task_group_position: 1,
          updated_at: "2026-10-09T00:00:00.000Z",
        },
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: "taskCards.renameGroup" }));
    fireEvent.change(screen.getByLabelText("taskCards.groupName"), {
      target: { value: "Renamed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(mocks.mutateTaskCardGroup).toHaveBeenCalledTimes(1));
    expect(mocks.mutateTaskCardGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "rename",
        groupId,
        taskIds: [],
        title: "Renamed",
        expectedGroupVersions: [{ groupId, version: 3 }],
        expectedTaskStates: [],
      }),
    );
  });

  it("closes the rename form with Cancel without writing a group change", () => {
    const groupId = "00000000-0000-4000-8000-000000000040";
    renderBoard({
      tasks: [{ ...task(firstTaskId, "Task A"), task_group_id: groupId }],
      groups: [
        {
          id: groupId,
          user_id: userId,
          title: "Existing",
          position: 0,
          version: 1,
          created_at: "2026-10-09T00:00:00.000Z",
          updated_at: "2026-10-09T00:00:00.000Z",
        },
      ],
      groupMembers: [
        {
          id: firstTaskId,
          task_group_id: groupId,
          task_group_position: 0,
          updated_at: "2026-10-09T00:00:00.000Z",
        },
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: "taskCards.renameGroup" }));
    fireEvent.change(screen.getByLabelText("taskCards.groupName"), {
      target: { value: "Discard this title" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));

    expect(screen.queryByLabelText("taskCards.groupName")).not.toBeInTheDocument();
    expect(mocks.mutateTaskCardGroup).not.toHaveBeenCalled();
  });

  it("closes the rename dialog with Escape without writing a group change", async () => {
    const groupId = "00000000-0000-4000-8000-000000000040";
    const user = userEvent.setup();
    renderBoard({
      tasks: [{ ...task(firstTaskId, "Task A"), task_group_id: groupId }],
      groups: [
        {
          id: groupId,
          user_id: userId,
          title: "Existing",
          position: 0,
          version: 1,
          created_at: "2026-10-09T00:00:00.000Z",
          updated_at: "2026-10-09T00:00:00.000Z",
        },
      ],
      groupMembers: [
        {
          id: firstTaskId,
          task_group_id: groupId,
          task_group_position: 0,
          updated_at: "2026-10-09T00:00:00.000Z",
        },
      ],
    });

    await user.click(screen.getByRole("button", { name: "taskCards.renameGroup" }));
    const input = screen.getByLabelText("taskCards.groupName");
    await user.clear(input);
    await user.type(input, "Discard this title");
    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByLabelText("taskCards.groupName")).not.toBeInTheDocument(),
    );
    expect(mocks.mutateTaskCardGroup).not.toHaveBeenCalled();
  });

  it("handles a drop on a grouped card once instead of bubbling into the group drop", async () => {
    const groupId = "00000000-0000-4000-8000-000000000040";
    mocks.mutateTaskCardGroup.mockResolvedValue({
      ok: true,
      data: {
        operationId: "00000000-0000-4000-8000-000000000020",
        action: "add",
        groupId,
        canUndo: true,
      },
    });
    render(
      <TaskCardBoard
        userId={userId}
        tasks={[
          { ...task(firstTaskId, "Task A"), task_group_id: groupId },
          task(secondTaskId, "Task B"),
        ]}
        groups={[
          {
            id: groupId,
            user_id: userId,
            title: "Existing",
            position: 0,
            version: 1,
            created_at: "2026-10-09T00:00:00.000Z",
            updated_at: "2026-10-09T00:00:00.000Z",
          },
        ]}
        groupMembers={[
          {
            id: firstTaskId,
            task_group_id: groupId,
            task_group_position: 0,
            updated_at: "2026-10-09T00:00:00.000Z",
          },
        ]}
        pendingPhotos={[]}
        today="2026-10-09"
        goalOptions={[]}
        projectOptions={[]}
      />,
    );
    const memberCard = screen
      .getAllByRole("article")
      .find((article) => article.textContent?.includes("Task A"));
    expect(memberCard).toBeDefined();

    fireEvent.drop(memberCard!, { dataTransfer: { getData: () => secondTaskId } });

    await waitFor(() => expect(mocks.mutateTaskCardGroup).toHaveBeenCalledTimes(1));
    expect(mocks.mutateTaskCardGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "add",
        groupId,
        taskIds: [secondTaskId],
      }),
    );
  });

  it("recovers an ambiguous group mutation after remount with the same operation id", async () => {
    mocks.mutateTaskCardGroup
      .mockRejectedValueOnce(new Error("connection closed after submit"))
      .mockResolvedValueOnce({
        ok: true,
        data: {
          operationId: "00000000-0000-4000-8000-000000000020",
          action: "create",
          groupId: "00000000-0000-4000-8000-000000000030",
          canUndo: true,
        },
      });

    const firstRender = renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "taskCards.groupTasks" }));
    fireEvent.change(screen.getByLabelText("taskCards.groupName"), { target: { value: "Shared" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "taskCards.selectTask Task A" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "taskCards.selectTask Task B" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "taskCards.createGroup" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "taskCards.createGroup" }));

    await waitFor(() => expect(mocks.mutateTaskCardGroup).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        JSON.parse(window.localStorage.getItem(`kemtit:task-card-group:${userId}`) ?? "{}"),
      ).toMatchObject({
        kind: "mutation",
        request: { action: "create", title: "Shared", operationId: expect.any(String) },
      }),
    );
    const originalRequest = mocks.mutateTaskCardGroup.mock.calls[0][0];
    expect(
      screen.getByRole("checkbox", { name: "taskCards.selectTask Task A" }),
    ).toHaveAccessibleName("taskCards.selectTask Task A");

    firstRender.unmount();
    renderBoard();

    const retryButton = await screen.findByRole("button", { name: "taskCards.retryGroupChange" });
    fireEvent.click(retryButton);
    await waitFor(() => expect(mocks.mutateTaskCardGroup).toHaveBeenCalledTimes(2));
    expect(mocks.mutateTaskCardGroup.mock.calls[1][0]).toEqual(originalRequest);
    await waitFor(() =>
      expect(window.localStorage.getItem(`kemtit:task-card-group:${userId}`)).toBeNull(),
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });
});
