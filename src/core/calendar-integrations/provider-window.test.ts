import { describe, expect, it } from "vitest";

import { providerReadbackWindow } from "./provider-window";

describe("providerReadbackWindow", () => {
  it("keeps early Asia/Bangkok events inside the readback window after UTC conversion", () => {
    expect(
      providerReadbackWindow({
        title: "Early event",
        start: "2026-09-27T00:30:00+07:00",
        end: "2026-09-27T01:00:00+07:00",
        allDay: false,
        blocksTime: true,
      }),
    ).toEqual({
      start: "2026-09-26T17:30:00.000Z",
      end: "2026-09-26T18:00:00.000Z",
    });
  });

  it("uses the exclusive end date for all-day event readback", () => {
    expect(
      providerReadbackWindow({
        title: "All-day event",
        start: "2026-09-27",
        end: "2026-09-28",
        allDay: true,
        blocksTime: false,
      }),
    ).toEqual({
      start: "2026-09-27T00:00:00.000Z",
      end: "2026-09-28T00:00:00.000Z",
    });
  });
});
