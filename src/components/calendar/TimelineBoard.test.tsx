// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  scheduleTaskCard: vi.fn(),
  undoTaskCardSchedule: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

vi.mock("@/core/tasks/card-actions", () => ({
  scheduleTaskCard: mocks.scheduleTaskCard,
  undoTaskCardSchedule: mocks.undoTaskCardSchedule,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }),
}));
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, values?: Record<string, string | number>) =>
    values ? `${key} ${Object.values(values).join("/")}` : key,
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@/hooks/use-is-mobile", () => ({ useIsMobile: () => false }));

import { TimelineBoard, type TimelineBoardItem } from "./TimelineBoard";

const taskId = "00000000-0000-4000-8000-000000000101";
const blockId = "00000000-0000-4000-8000-000000000102";
const operationId = "00000000-0000-4000-8000-000000000103";
const startAt = "2026-10-09T02:00:00.000Z";
const endAt = "2026-10-09T02:30:00.000Z";

function item(
  linkedBlocks: TimelineBoardItem["linkedBlocks"] = [],
  taskOverrides: Partial<TimelineBoardItem["task"]> = {},
): TimelineBoardItem {
  return {
    key: taskId,
    task: {
      id: taskId,
      title: "Review launch",
      domain: "work",
      priority: "normal",
      due_date: "2026-10-09",
      planned_date: null,
      updated_at: "2026-10-08T12:00:00.000Z",
      recurrence_rule: null,
      estimated_minutes: 30,
      photos: [],
      task_group_id: null,
      task_group_position: 0,
      ...taskOverrides,
    },
    occurrenceDate: null,
    occurrenceUpdatedAt: null,
    done: false,
    skipped: false,
    linkedBlocks,
  } as TimelineBoardItem;
}

function renderBoard(
  boardItem = item(),
  boardBlocks: Parameters<typeof TimelineBoard>[0]["blocks"] = [],
  extraProps: Partial<
    Pick<
      Parameters<typeof TimelineBoard>[0],
      "date" | "groups" | "hasMoreTasks" | "userId" | "items"
    >
  > = {},
) {
  return render(
    <TimelineBoard
      userId={extraProps.userId ?? "user-1"}
      date={extraProps.date ?? "2026-10-09"}
      items={extraProps.items ?? [boardItem]}
      groups={extraProps.groups ?? []}
      hasMoreTasks={extraProps.hasMoreTasks}
      blocks={boardBlocks}
    />,
  );
}

describe("TimelineBoard", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/calendar");
    vi.spyOn(window, "scrollBy").mockImplementation(() => undefined);
    vi.stubGlobal("crypto", { randomUUID: () => operationId });
    mocks.scheduleTaskCard.mockResolvedValue({
      ok: true,
      data: {
        operationId,
        taskId,
        targetDate: "2026-10-09",
        blockIds: [],
        canUndo: true,
      },
    });
    mocks.undoTaskCardSchedule.mockResolvedValue({
      ok: true,
      data: { operationId, undone: true, canUndo: false },
    });
  });

  it("schedules a task for a date only through the accessible form", async () => {
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "schedule: Review launch" }));

    expect(screen.getByLabelText("dayOnly")).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "confirmMove" }));

    await waitFor(() => expect(mocks.scheduleTaskCard).toHaveBeenCalledTimes(1));
    expect(mocks.scheduleTaskCard).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId,
        targetDate: "2026-10-09",
        startAt: null,
        endAt: null,
        blockId: null,
        blocks: [],
      }),
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("opens the schedule dialog, focuses its first field, and cancels on Escape without writing", async () => {
    const user = userEvent.setup();
    renderBoard();
    const trigger = screen.getByRole("button", { name: "schedule: Review launch" });

    await user.click(trigger);
    expect(await screen.findByRole("dialog", { name: "scheduleTask" })).toBeVisible();
    expect(screen.getByLabelText("scheduleDate")).toHaveFocus();

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "scheduleTask" })).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
    expect(mocks.scheduleTaskCard).not.toHaveBeenCalled();
  });

  it("does not report an in-flight schedule as uncertain", async () => {
    mocks.scheduleTaskCard.mockImplementationOnce(() => new Promise(() => {}));
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "schedule: Review launch" }));
    fireEvent.click(screen.getByRole("button", { name: "confirmMove" }));

    expect(screen.getByRole("button", { name: "saving" })).toBeDisabled();
    expect(screen.queryByText("scheduleChangeUncertain")).not.toBeInTheDocument();
  });

  it("previews a dropped time and schedules on release without opening a composer", async () => {
    const view = renderBoard();
    const dragHandle = screen.getByRole("button", { name: "dragHandle: Review launch" });
    const transfer = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "",
      setData: (key: string, value: string) => transfer.set(key, value),
      getData: (key: string) => transfer.get(key) ?? "",
    };
    fireEvent.dragStart(dragHandle, { dataTransfer });
    expect(transfer.get("text/plain")).toBe(
      JSON.stringify({ itemKey: taskId, blockId: null, mode: "move" }),
    );
    const timeline = view.container.querySelector("[data-timeline-grid]");
    expect(timeline).not.toBeNull();
    vi.spyOn(timeline as HTMLDivElement, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      right: 420,
      bottom: 1440,
      left: 0,
      width: 420,
      height: 1440,
      toJSON: () => ({}),
    });
    const dragOverEvent = new Event("dragover", { bubbles: true }) as DragEvent;
    Object.defineProperties(dragOverEvent, {
      dataTransfer: { value: dataTransfer },
      clientY: { value: 615 },
    });
    fireEvent(timeline as HTMLDivElement, dragOverEvent);
    expect(timeline).toHaveTextContent("dropPreview");
    const dropEvent = new Event("drop", { bubbles: true }) as DragEvent;
    Object.defineProperties(dropEvent, {
      dataTransfer: { value: dataTransfer },
      clientY: { value: 615 },
    });
    fireEvent(timeline as HTMLDivElement, dropEvent);

    await waitFor(() => expect(mocks.scheduleTaskCard).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("form", { name: "scheduleTask" })).not.toBeInTheDocument();
    expect(mocks.scheduleTaskCard).toHaveBeenCalledWith(
      expect.objectContaining({
        startAt: "2026-10-09T03:15:00.000Z",
        endAt: "2026-10-09T03:45:00.000Z",
        blocks: [],
      }),
    );
  });

  it("moves a card to a calendar day from the date strip", async () => {
    const view = renderBoard();
    const dragHandle = screen.getByRole("button", { name: "dragHandle: Review launch" });
    const dataTransfer = {
      effectAllowed: "",
      setData: vi.fn(),
      getData: vi.fn(() => JSON.stringify({ itemKey: taskId, blockId: null, mode: "move" })),
    };
    fireEvent.dragStart(dragHandle, { dataTransfer });
    const targetDay = view.container.querySelector(
      '[data-day-drop-date="2026-10-10"]',
    ) as HTMLButtonElement;
    fireEvent.dragOver(targetDay, { dataTransfer });
    expect(screen.getByText(/dropDayPreview/)).toBeVisible();
    fireEvent.drop(targetDay, { dataTransfer });

    await waitFor(() => expect(mocks.scheduleTaskCard).toHaveBeenCalledTimes(1));
    expect(mocks.scheduleTaskCard).toHaveBeenCalledWith(
      expect.objectContaining({ targetDate: "2026-10-10", startAt: null, endAt: null }),
    );
  });

  it("changes only the selected date while preserving week view and scope", () => {
    window.history.replaceState(null, "", "/calendar?view=week&date=2026-10-09&scope=life");
    const view = renderBoard();
    const targetDay = view.container.querySelector(
      '[data-day-drop-date="2026-10-10"]',
    ) as HTMLButtonElement;

    fireEvent.click(targetDay);

    expect(mocks.push).toHaveBeenCalledWith("/calendar?view=week&date=2026-10-10&scope=life");
  });

  it("shows active groups and lets the tray switch between unscheduled and all tasks", () => {
    const scheduledItem = item([{ id: blockId, version: 2, startAt, endAt, isLocked: false }]);
    const groupedItem = {
      ...item(),
      key: "00000000-0000-4000-8000-000000000104",
      task: {
        ...item().task,
        id: "00000000-0000-4000-8000-000000000104",
        title: "Prepare launch",
        task_group_id: "00000000-0000-4000-8000-000000000105",
      },
    } as TimelineBoardItem;
    renderBoard(scheduledItem, [], {
      items: [scheduledItem, groupedItem],
      groups: [{ id: "00000000-0000-4000-8000-000000000105", title: "Launch work", position: 1 }],
    });

    expect(screen.getByText("Launch work")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "schedule: Review launch" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Launch work"));
    expect(screen.getByRole("button", { name: "schedule: Prepare launch" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "allTasks" }));
    expect(screen.getByRole("button", { name: "schedule: Review launch" })).toBeVisible();
    expect(screen.getByRole("button", { name: "schedule: Prepare launch" })).toBeVisible();
  });

  it("shows the capped tray notice and keeps the timeline grid fluid", () => {
    const view = renderBoard(item(), [], { hasMoreTasks: true });
    expect(screen.getByText("calendarTaskLimit 200")).toBeVisible();
    expect(screen.getByRole("link", { name: "allTasks" })).toHaveAttribute(
      "href",
      "/tasks?mode=cards&view=all",
    );
    const grid = view.container.querySelector("[data-timeline-grid]");
    expect(grid).toHaveClass("w-full");
    expect(grid).not.toHaveClass("min-w-[420px]");
  });

  it("shows the Bangkok current-time marker only today, ticks, and scrolls the timeline once", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T03:10:00.000Z"));
    const todayView = renderBoard();
    const scrollRegion = todayView.container.querySelector(
      "[data-timeline-scroll-region]",
    ) as HTMLDivElement;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByRole("note", { name: "nowAt 10:10" })).toHaveStyle({ top: "610px" });
    const initialScrollTop = scrollRegion.scrollTop;
    expect(initialScrollTop).toBeGreaterThan(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(screen.getByRole("note", { name: "nowAt 10:11" })).toBeVisible();
    expect(scrollRegion.scrollTop).toBe(initialScrollTop);

    const otherDayView = renderBoard(item(), [], { date: "2026-10-10" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(otherDayView.container.querySelector("[data-current-time-marker]")).toBeNull();
    otherDayView.unmount();
    todayView.unmount();
  });

  it("shows every scheduled block time and its date when a task has multiple blocks", () => {
    const secondBlock = {
      id: "00000000-0000-4000-8000-000000000106",
      version: 5,
      startAt: "2026-10-09T04:00:00.000Z",
      endAt: "2026-10-09T04:45:00.000Z",
      isLocked: false,
    };
    const view = renderBoard(
      item([{ id: blockId, version: 4, startAt, endAt, isLocked: false }, secondBlock]),
    );
    fireEvent.click(screen.getByRole("button", { name: "allTasks" }));
    fireEvent.click(screen.getByText("multipleScheduledBlocks 2"));

    expect(screen.getByText("multipleScheduledBlocks 2")).toBeVisible();
    expect(view.container).toHaveTextContent("9 Oct 2026 · 09:00–09:30");
    expect(view.container).toHaveTextContent("9 Oct 2026 · 11:00–11:45");
  });

  it("resizes one linked block on drag release while preserving its start and selection", async () => {
    const linkedBlock = { id: blockId, version: 4, startAt, endAt, isLocked: false };
    const boardBlock = {
      id: blockId,
      title: "Review launch",
      startAt,
      endAt,
      version: 4,
      isLocked: false,
      taskId,
      occurrenceDate: null,
    };
    const view = renderBoard(item([linkedBlock]), [boardBlock]);
    const resizeHandle = screen.getByRole("button", { name: "resizeHandle: Review launch" });
    const transfer = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "",
      setData: (key: string, value: string) => transfer.set(key, value),
      getData: (key: string) => transfer.get(key) ?? "",
    };
    fireEvent.dragStart(resizeHandle, { dataTransfer });
    const timeline = view.container.querySelector("[data-timeline-grid]") as HTMLDivElement;
    vi.spyOn(timeline, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      right: 420,
      bottom: 1440,
      left: 0,
      width: 420,
      height: 1440,
      toJSON: () => ({}),
    });
    const dropEvent = new Event("drop", { bubbles: true }) as DragEvent;
    Object.defineProperties(dropEvent, {
      dataTransfer: { value: dataTransfer },
      clientY: { value: 600 },
    });
    fireEvent(timeline, dropEvent);

    await waitFor(() => expect(mocks.scheduleTaskCard).toHaveBeenCalledTimes(1));
    expect(mocks.scheduleTaskCard).toHaveBeenCalledWith(
      expect.objectContaining({
        blockId,
        startAt: "2026-10-09T02:00:00.000Z",
        endAt: "2026-10-09T03:00:00.000Z",
      }),
    );
  });

  it("blocks a 23:30 to midnight drag with a next-day warning rather than submitting it", async () => {
    const view = renderBoard();
    const dragHandle = screen.getByRole("button", { name: "dragHandle: Review launch" });
    const transfer = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "",
      setData: (key: string, value: string) => transfer.set(key, value),
      getData: (key: string) => transfer.get(key) ?? "",
    };
    fireEvent.dragStart(dragHandle, { dataTransfer });
    const timeline = view.container.querySelector("[data-timeline-grid]") as HTMLDivElement;
    vi.spyOn(timeline, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      right: 420,
      bottom: 1440,
      left: 0,
      width: 420,
      height: 1440,
      toJSON: () => ({}),
    });
    const dragOverEvent = new Event("dragover", { bubbles: true }) as DragEvent;
    Object.defineProperties(dragOverEvent, {
      dataTransfer: { value: dataTransfer },
      clientY: { value: 1410 },
    });
    fireEvent(timeline, dragOverEvent);
    expect(screen.getByRole("alert")).toHaveTextContent("sameDayTimeBlockOnly");
    const dropEvent = new Event("drop", { bubbles: true }) as DragEvent;
    Object.defineProperties(dropEvent, {
      dataTransfer: { value: dataTransfer },
      clientY: { value: 1410 },
    });
    fireEvent(timeline, dropEvent);
    expect(mocks.scheduleTaskCard).not.toHaveBeenCalled();
  });

  it("keeps the selected block and disables an invalid same-day time range", () => {
    const linkedBlock = { id: blockId, version: 4, startAt, endAt, isLocked: false };
    const boardBlock = {
      id: blockId,
      title: "Review launch",
      startAt,
      endAt,
      version: 4,
      isLocked: false,
      taskId,
      occurrenceDate: null,
    };
    renderBoard(item([linkedBlock]), [boardBlock]);

    fireEvent.click(screen.getByRole("button", { name: /moveTask.*Review launch/ }));
    fireEvent.change(screen.getByLabelText("endTime"), { target: { value: "00:30" } });

    expect(screen.getByRole("alert")).toHaveTextContent("sameDayTimeBlockOnly");
    expect(screen.getByRole("combobox", { name: "chooseBlock" })).toHaveValue(blockId);
    expect(screen.getByRole("button", { name: "confirmMove" })).toBeDisabled();
    expect(mocks.scheduleTaskCard).not.toHaveBeenCalled();
  });

  it("moves the selected linked block using its complete current snapshot", async () => {
    const linkedBlock = { id: blockId, version: 4, startAt, endAt, isLocked: false };
    const block = {
      id: blockId,
      title: "Review launch",
      startAt,
      endAt,
      version: 4,
      isLocked: false,
      taskId,
      occurrenceDate: null,
    };
    renderBoard(item([linkedBlock]), [block]);

    fireEvent.click(screen.getByRole("button", { name: /moveTask.*Review launch/ }));
    expect(screen.getByLabelText("startTime")).toHaveValue("09:00");
    expect(screen.getByRole("combobox", { name: "chooseBlock" })).toHaveValue(blockId);
    fireEvent.change(screen.getByLabelText("startTime"), { target: { value: "10:00" } });
    fireEvent.change(screen.getByLabelText("endTime"), { target: { value: "10:30" } });
    fireEvent.click(screen.getByRole("button", { name: "confirmMove" }));

    await waitFor(() => expect(mocks.scheduleTaskCard).toHaveBeenCalledTimes(1));
    expect(mocks.scheduleTaskCard).toHaveBeenCalledWith(
      expect.objectContaining({
        blockId,
        blocks: [{ id: blockId, version: 4, startAt, endAt }],
        startAt: "2026-10-09T03:00:00.000Z",
        endAt: "2026-10-09T03:30:00.000Z",
      }),
    );
  });

  it("keeps the full linked-block snapshot when moving only the scheduled date", async () => {
    const linkedBlock = { id: blockId, version: 4, startAt, endAt, isLocked: false };
    const block = {
      id: blockId,
      title: "Review launch",
      startAt,
      endAt,
      version: 4,
      isLocked: false,
      taskId,
      occurrenceDate: null,
    };
    renderBoard(item([linkedBlock]), [block]);

    fireEvent.click(screen.getByRole("button", { name: /moveTask.*Review launch/ }));
    fireEvent.click(screen.getByLabelText("dayOnly"));
    fireEvent.click(screen.getByRole("button", { name: "confirmMove" }));

    await waitFor(() => expect(mocks.scheduleTaskCard).toHaveBeenCalledTimes(1));
    expect(mocks.scheduleTaskCard).toHaveBeenCalledWith(
      expect.objectContaining({
        startAt: null,
        endAt: null,
        blockId: null,
        blocks: [{ id: blockId, version: 4, startAt, endAt }],
      }),
    );
  });

  it("recovers an unknown schedule result by retrying the stored operation", async () => {
    mocks.scheduleTaskCard.mockRejectedValueOnce(new Error("response lost"));
    const firstRender = renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "schedule: Review launch" }));
    fireEvent.click(screen.getByRole("button", { name: "confirmMove" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("scheduleChangeUncertain"),
    );

    const firstInput = mocks.scheduleTaskCard.mock.calls[0][0];
    expect(
      JSON.parse(
        window.sessionStorage.getItem("kemtit:calendar-schedule:user-1:2026-10-09") ?? "null",
      ),
    ).toMatchObject({ kind: "schedule", userId: "user-1", input: { operationId } });
    firstRender.unmount();
    renderBoard();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "retrySchedule" })).toBeVisible(),
    );
    fireEvent.click(screen.getByRole("button", { name: "retrySchedule" }));

    await waitFor(() => expect(mocks.scheduleTaskCard).toHaveBeenCalledTimes(2));
    expect(mocks.scheduleTaskCard.mock.calls[1][0]).toEqual(firstInput);
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(window.sessionStorage.getItem("kemtit:calendar-schedule:user-1:2026-10-09")).toBeNull();
  });

  it("offers an accessible Undo action and retries it with the same operation ID", async () => {
    mocks.undoTaskCardSchedule.mockRejectedValueOnce(new Error("response lost"));
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "schedule: Review launch" }));
    fireEvent.click(screen.getByRole("button", { name: "confirmMove" }));
    const undoButton = await screen.findByRole("button", { name: "common.undo" });
    expect(undoButton).toBeVisible();
    fireEvent.click(undoButton);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "retrySchedule" })).toBeVisible(),
    );
    fireEvent.click(screen.getByRole("button", { name: "retrySchedule" }));

    await waitFor(() => expect(mocks.undoTaskCardSchedule).toHaveBeenCalledTimes(2));
    expect(mocks.undoTaskCardSchedule.mock.calls).toEqual([[{ operationId }], [{ operationId }]]);
    expect(screen.queryByRole("button", { name: "common.undo" })).not.toBeInTheDocument();
  });

  it("does not expose Undo when the action response says the schedule is not undoable", async () => {
    mocks.scheduleTaskCard.mockResolvedValueOnce({
      ok: true,
      data: { operationId, taskId, targetDate: "2026-10-09", blockIds: [], canUndo: false },
    });
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "schedule: Review launch" }));
    fireEvent.click(screen.getByRole("button", { name: "confirmMove" }));

    await waitFor(() => expect(mocks.scheduleTaskCard).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: "common.undo" })).not.toBeInTheDocument();
  });
});
