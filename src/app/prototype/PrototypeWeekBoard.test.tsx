// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PrototypeWeekBoard } from "./PrototypeWeekBoard";
import type { PrototypeRecord } from "./prototype-model";

const date = "2026-09-24" as const;
const records: PrototypeRecord[] = Array.from({ length: 12 }, (_, index) => ({
  id: `density-${index}`, title: `Density test item ${index}`, date,
  type: index === 11 ? "task" : "event", scope: "work", tone: "work",
  startTime: index === 11 ? undefined : `${String(8 + index).padStart(2, "0")}:00`, durationMinutes: 30,
}));
const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTo");

beforeAll(() => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function(this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function(this: HTMLDialogElement) { this.removeAttribute("open"); } });
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
});
afterEach(cleanup);
afterAll(() => {
  for (const [prototype, key, descriptor] of [
    [HTMLDialogElement.prototype, "showModal", originalShow],
    [HTMLDialogElement.prototype, "close", originalClose],
    [HTMLElement.prototype, "scrollTo", originalScroll],
  ] as const) {
    if (descriptor) Object.defineProperty(prototype, key, descriptor);
    else Reflect.deleteProperty(prototype, key);
  }
  vi.unstubAllGlobals();
});

function props() {
  return { days: [{ date, records }], selectedDate: date, completedIds: new Set<string>(), onSelectDate: vi.fn(), onToggleComplete: vi.fn(), onOpenRecord: vi.fn(), onOpenCalendar: vi.fn() };
}

describe("Week board overflow", () => {
  it("caps preview rows and exposes all twelve canonical items in the dialog", () => {
    const handlers = props();
    render(<PrototypeWeekBoard {...handlers} />);
    expect(screen.getAllByTestId("week-preview-row").length).toBe(5);
    fireEvent.click(screen.getByTestId("week-day-more"));
    const dialog = screen.getByTestId("week-day-dialog");
    expect(within(dialog).getAllByTestId("week-detail-row").length).toBe(12);
    expect(handlers.onSelectDate).not.toHaveBeenCalled();
  });
  it("searches the full day, including items excluded from the preview", () => {
    render(<PrototypeWeekBoard {...props()} />);
    fireEvent.click(screen.getByTestId("week-day-more"));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "item 11" } });
    expect(screen.getAllByTestId("week-detail-row").length).toBe(1);
    expect(screen.getByTestId("week-detail-row").getAttribute("data-record-id")).toBe("density-11");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "no-such-item" } });
    expect(screen.queryAllByTestId("week-detail-row").length).toBe(0);
  });
  it("keeps completion under parent control and preserves the open day while state updates", () => {
    const handlers = props();
    const view = render(<PrototypeWeekBoard {...handlers} />);
    fireEvent.click(screen.getByTestId("week-day-more"));
    fireEvent.click(screen.getByRole("button", { name: /Complete: Density test item 11/ }));
    expect(handlers.onToggleComplete).toHaveBeenCalledWith("density-11");
    view.rerender(<PrototypeWeekBoard {...handlers} completedIds={new Set(["density-11"])} />);
    expect(screen.getByRole("button", { name: /Reopen: Density test item 11/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByTestId("week-detail-row").length).toBe(12);
  });
  it("opens the original record, without manufacturing another business record", () => {
    const handlers = props();
    render(<PrototypeWeekBoard {...handlers} />);
    fireEvent.click(screen.getByTestId("week-day-more"));
    fireEvent.click(within(screen.getByTestId("week-day-dialog")).getByRole("button", { name: /Open: Density test item 9\./ }));
    expect(handlers.onOpenRecord).toHaveBeenCalledWith(records[9]);
    expect(screen.queryByTestId("week-day-dialog")).toBeNull();
  });
  it("opens Calendar on the inspected date only from the explicit action", () => {
    const handlers = props();
    render(<PrototypeWeekBoard {...handlers} />);
    fireEvent.click(screen.getByTestId("week-day-more"));
    fireEvent.click(screen.getByRole("button", { name: "View in Calendar" }));
    expect(handlers.onOpenCalendar).toHaveBeenCalledWith(date);
    expect(screen.queryByTestId("week-day-dialog")).toBeNull();
  });
  it("returns focus to More after a normal dismissal", () => {
    render(<PrototypeWeekBoard {...props()} />);
    const trigger = screen.getByTestId("week-day-more");
    trigger.focus();
    fireEvent.click(trigger);
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(screen.getByRole("button", { name: "Close day details" }));
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe("");
  });
  it("keeps the week scroll region out of the Tab order", async () => {
    const user = userEvent.setup();
    const handlers = props();
    render(
      <PrototypeWeekBoard
        {...handlers}
        days={[...handlers.days, { date: "2026-09-25", records: [] }]}
      />,
    );

    await user.tab();
    expect(screen.getByRole("button", { name: "Show next day" })).toHaveFocus();
    await user.tab();
    const firstDayHeading = within(screen.getAllByTestId("week-day-card")[0]).getAllByRole("button")[0];
    expect(firstDayHeading).toHaveFocus();
  });
  it("lets Tab move from the search field directly into day items", async () => {
    const user = userEvent.setup();
    render(<PrototypeWeekBoard {...props()} />);
    await user.click(screen.getByTestId("week-day-more"));

    await user.tab();
    expect(screen.getByRole("button", { name: "Close day details" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("searchbox")).toHaveFocus();
    await user.tab();
    expect(
      within(screen.getByTestId("week-day-dialog")).getByRole("button", {
        name: /Open: Density test item 0/,
      }),
    ).toHaveFocus();
  });
  it("keeps content clicks inside the dialog and dismisses on a backdrop click", () => {
    render(<PrototypeWeekBoard {...props()} />);
    fireEvent.click(screen.getByTestId("week-day-more"));
    const dialog = screen.getByTestId("week-day-dialog");

    fireEvent.pointerDown(dialog, { clientX: -1, clientY: 0 });
    fireEvent.click(screen.getByRole("searchbox"), { clientX: 20, clientY: 20 });
    expect(screen.getByTestId("week-day-dialog")).toBeInTheDocument();

    fireEvent.pointerDown(dialog, { clientX: -1, clientY: 0 });
    fireEvent.click(dialog, { clientX: -1, clientY: 0 });
    expect(screen.queryByTestId("week-day-dialog")).not.toBeInTheDocument();
  });
});
