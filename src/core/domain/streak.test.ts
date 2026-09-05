import { describe, expect, it } from "vitest";

import { currentStreak } from "./streak";

describe("currentStreak", () => {
  it("นับวันติดกันถอยหลังจากวันนี้", () => {
    expect(currentStreak(["2026-09-03", "2026-09-04", "2026-09-05"], "2026-09-05")).toBe(3);
  });
  it("วันนี้ยังไม่ทำ → นับจากเมื่อวาน", () => {
    expect(currentStreak(["2026-09-03", "2026-09-04"], "2026-09-05")).toBe(2);
  });
  it("มีช่องว่าง → เริ่มใหม่", () => {
    expect(currentStreak(["2026-09-01", "2026-09-04", "2026-09-05"], "2026-09-05")).toBe(2);
    expect(currentStreak([], "2026-09-05")).toBe(0);
  });
});
