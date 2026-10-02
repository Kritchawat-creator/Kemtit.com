// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  restoreTask: vi.fn(),
  restoreProject: vi.fn(),
  restoreNote: vi.fn(),
  restoreGoal: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));
vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));
vi.mock("@/core/tasks/actions", () => ({ restoreTask: mocks.restoreTask }));
vi.mock("@/core/projects/actions", () => ({ restoreProject: mocks.restoreProject }));
vi.mock("@/core/notes/actions", () => ({ restoreNote: mocks.restoreNote }));
vi.mock("@/core/goals/actions", () => ({ restoreGoal: mocks.restoreGoal }));

import { ArchiveList } from "./ArchiveList";

function renderTaskArchive() {
  return render(
    <ArchiveList
      tasks={[
        {
          id: "task-1",
          title: "Archived task",
          due_date: null,
          planned_date: null,
          completed_at: null,
          recurrence_rule: null,
          archived_at: "2026-09-27T00:00:00.000Z",
          archived_from_status: "planned",
        },
      ]}
      projects={[]}
      notes={[]}
      goals={[]}
      pageIndex={0}
      tasksHaveMore={false}
      projectsHaveMore={false}
      notesHaveMore={false}
      goalsHaveMore={false}
    />,
  );
}

describe("ArchiveList restore feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => cleanup());

  it("refreshes and reports an uncertain outcome when a restore action rejects", async () => {
    mocks.restoreTask.mockRejectedValueOnce(new Error("connection lost"));
    renderTaskArchive();

    fireEvent.click(screen.getByRole("button", { name: "restore Archived task" }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("restoreUncertain"));
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("links archived goals to their detail page and restores through the goal action", async () => {
    mocks.restoreGoal.mockResolvedValueOnce({ ok: true, data: null });
    render(
      <ArchiveList
        tasks={[]}
        projects={[]}
        notes={[]}
        goals={[
          {
            id: "goal-1",
            title: "Archived goal",
            status: "archived",
            archived_at: "2026-09-27T00:00:00.000Z",
            archived_from_status: "completed",
          },
        ]}
        pageIndex={0}
        tasksHaveMore={false}
        projectsHaveMore={false}
        notesHaveMore={false}
        goalsHaveMore={false}
      />,
    );

    expect(screen.getByRole("link", { name: "Archived goal" })).toHaveAttribute(
      "href",
      "/goals/goal-1",
    );
    fireEvent.click(screen.getByRole("button", { name: "restore Archived goal" }));

    await waitFor(() => expect(mocks.restoreGoal).toHaveBeenCalledExactlyOnceWith({ id: "goal-1" }));
    expect(mocks.toastSuccess).toHaveBeenCalledWith("restored");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
});
