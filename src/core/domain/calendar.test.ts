import { describe, expect, it } from "vitest";

import {
  calendarRange,
  itemsByDay,
  monthGrid,
  parseCalendarView,
  shiftCalendarDate,
} from "./calendar";

describe("calendar", () => {
  it("ช่วงของแต่ละมุมมอง (สัปดาห์เริ่มอาทิตย์, เดือน = grid)", () => {
    expect(calendarRange("day", "2026-09-05")).toEqual({ from: "2026-09-05", to: "2026-09-05" });
    expect(calendarRange("week", "2026-09-05")).toEqual({ from: "2026-08-30", to: "2026-09-05" });
    expect(calendarRange("month", "2026-09-15")).toEqual({ from: "2026-08-30", to: "2026-10-03" });
  });

  it("เลื่อนวัน/สัปดาห์/เดือน", () => {
    expect(shiftCalendarDate("day", "2026-09-05", 1)).toBe("2026-09-06");
    expect(shiftCalendarDate("week", "2026-09-05", -1)).toBe("2026-08-29");
    expect(shiftCalendarDate("month", "2026-09-15", 1)).toBe("2026-10-01");
  });

  it("grid เดือน ก.ย. 2569 มี 5 แถว × 7", () => {
    const grid = monthGrid("2026-09-01");
    expect(grid).toHaveLength(5);
    expect(grid.every((row) => row.length === 7)).toBe(true);
    expect(grid[0]?.[0]).toBe("2026-08-30");
  });

  it("parseCalendarView default = week", () => {
    expect(parseCalendarView("month")).toBe("month");
    expect(parseCalendarView("year")).toBe("week");
  });

  it("itemsByDay กระจาย task ซ้ำทุกวันลงทุกวันในช่วง", () => {
    const byDay = itemsByDay(
      [
        {
          id: "d",
          title: "d",
          domain: "work",
          due_date: "2026-09-01",
          recurrence_rule: "FREQ=DAILY",
          completed_at: null,
          goal_id: null,
        },
        {
          id: "o",
          title: "o",
          domain: "work",
          due_date: "2026-09-03",
          recurrence_rule: null,
          completed_at: null,
          goal_id: null,
        },
      ],
      [{ task_id: "d", completed_on: "2026-09-02" }],
      "2026-09-01",
      "2026-09-03",
    );
    expect(Object.keys(byDay)).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
    expect(byDay["2026-09-02"]?.[0]?.done).toBe(true);
    expect(byDay["2026-09-03"]?.map((i) => i.task.id)).toEqual(["d", "o"]);
  });
});
