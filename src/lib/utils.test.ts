import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("รวม class และตัดค่า falsy", () => {
    expect(cn("a", false && "b", undefined, "c")).toBe("a c");
  });

  it("class Tailwind ที่ชนกันให้ตัวหลังชนะ", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });
});
