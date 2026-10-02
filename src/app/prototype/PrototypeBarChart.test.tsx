// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PrototypeBarChart } from "./PrototypeBarChart";
import { getPrototypeEstimatedWeek } from "./prototype-chart-model";
import { INITIAL_PROTOTYPE_RECORDS } from "./prototype-model";

const days = getPrototypeEstimatedWeek(INITIAL_PROTOTYPE_RECORDS, "2026-09-24", "all");
afterEach(cleanup);

describe("PrototypeBarChart interaction", () => {
  it("selects locally and navigates only from the explicit day action", () => {
    const onOpenDay = vi.fn();
    render(<PrototypeBarChart title="Weekly rhythm" days={days} initialDate="2026-09-24" onOpenDay={onOpenDay} />);
    fireEvent.click(screen.getByRole("button", { name: /Friday, Sep 25, 2026/ }));
    expect(onOpenDay).not.toHaveBeenCalled();
    expect(screen.getByTestId("chart-selected-value").textContent).toContain("Fri, Sep 25");
    fireEvent.click(screen.getByRole("button", { name: /Open day’s plan/ }));
    expect(onOpenDay).toHaveBeenCalledWith("2026-09-25");
  });

  it("provides exact dates and values in a native table", () => {
    render(<PrototypeBarChart title="Weekly rhythm" days={days} initialDate="2026-09-24" />);
    const details = screen.getByTestId("chart-data-table");
    fireEvent.click(screen.getByText("View data table"));
    expect(details.hasAttribute("open")).toBe(true);
    expect(details.textContent).toContain("7h 30m estimated");
    expect(details.querySelectorAll("tbody tr")).toHaveLength(7);
  });

  it("keeps the zero and missing-estimate states distinct", () => {
    const points = days.map((point, index) => index === 0 ? { ...point, minutes: null, knownMinutes: 0, missingEstimateCount: 1, itemCount: 1 } : point);
    render(<PrototypeBarChart title="Test" days={points} initialDate="2026-09-21" />);
    expect(screen.getByRole("button", { name: /Monday.*missing estimate/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Tuesday.*0m estimated/ })).toBeTruthy();
    const monday = screen.getByRole("button", { name: /Monday/ });
    expect(monday.querySelector<HTMLElement>('[data-testid="planned-time-bar-fill"]')?.style.height).toBe("0%");
  });

  it("keeps a tiny bar proportional instead of drawing a minimum 5% bar", () => {
    const points = days.map((point, index) => ({ ...point, minutes: index === 0 ? 600 : index === 1 ? 5 : 0 }));
    render(<PrototypeBarChart title="Test" days={points} initialDate="2026-09-21" />);
    const bars = screen.getAllByTestId("planned-time-bar-fill");
    const first = parseFloat(bars[0].style.height);
    const second = parseFloat(bars[1].style.height);
    expect(second / first).toBeCloseTo(5 / 600, 10);
  });
});
