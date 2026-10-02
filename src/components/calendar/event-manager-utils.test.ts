import { describe, expect, it } from "vitest";

import type { CalendarEventValue } from "@/core/calendar-integrations/provider";

import {
  eventDraftFromProvider,
  providerPatchFromDraft,
  providerValueFromDraft,
  validateEventDraft,
} from "./event-manager-utils";

describe("calendar event editor value mapping", () => {
  it("shows inclusive last days while preserving the provider's exclusive all-day end", () => {
    const providerValue: CalendarEventValue = {
      title: "Planning retreat",
      start: "2026-09-27",
      end: "2026-09-30",
      allDay: true,
      blocksTime: true,
    };

    const draft = eventDraftFromProvider(providerValue);
    expect(draft.startDate).toBe("2026-09-27");
    expect(draft.lastDay).toBe("2026-09-29");
    expect(providerValueFromDraft(draft)).toEqual(providerValue);
  });

  it("omits the unchanged full provider title from a time-only patch", () => {
    const originalTitle = `A provider title ${"that is longer than the daily display projection limit ".repeat(5)}`;
    const draft = eventDraftFromProvider({
      title: originalTitle,
      start: "2026-09-27T09:00:00+07:00",
      end: "2026-09-27T09:30:00+07:00",
      allDay: false,
      blocksTime: true,
    });
    draft.endLocal = "2026-09-27T10:00";

    const patch = providerPatchFromDraft(draft, new Set(["endLocal"]));
    expect(patch).toEqual({ end: "2026-09-27T03:00:00.000Z" });
    expect(patch).not.toHaveProperty("title");
    expect(validateEventDraft(draft, {
      localDestination: false,
      titleChanged: false,
      scheduleChanged: true,
    })).toBeNull();
  });

  it("allows an unchanged blank provider title during a timing edit", () => {
    const draft = eventDraftFromProvider({
      title: "",
      start: "2026-09-27T09:00:00+07:00",
      end: "2026-09-27T09:30:00+07:00",
      allDay: false,
      blocksTime: true,
    });
    draft.endLocal = "2026-09-27T10:00";

    expect(validateEventDraft(draft, {
      localDestination: false,
      titleChanged: false,
    })).toBeNull();
    expect(providerPatchFromDraft(draft, new Set(["endLocal"]))).not.toHaveProperty("title");
  });

  it("rejects impossible calendar days before timezone conversion", () => {
    const draft = {
      title: "Meeting",
      allDay: false,
      blocksTime: true,
      startDate: "2026-02-30",
      lastDay: "2026-02-30",
      startLocal: "2026-02-30T09:00",
      endLocal: "2026-02-30T10:00",
    };

    expect(validateEventDraft(draft, { localDestination: false, titleChanged: false })).toBe(
      "invalidDate",
    );
    expect(providerValueFromDraft(draft)).toBeNull();
  });

  it("allows title-only edits when provider seconds disappear from minute inputs", () => {
    const draft = eventDraftFromProvider({
      title: "Quick check-in",
      start: "2026-09-27T09:00:10+07:00",
      end: "2026-09-27T09:00:40+07:00",
      allDay: false,
      blocksTime: true,
    });
    draft.title = "Updated title";

    expect(validateEventDraft(draft, {
      localDestination: false,
      titleChanged: true,
      scheduleChanged: false,
    })).toBeNull();
    expect(providerPatchFromDraft(draft, new Set(["title"]))).toEqual({ title: "Updated title" });
  });

  it("rejects multi-day local events rather than dropping dates", () => {
    const draft = eventDraftFromProvider({
      title: "Two-day meeting",
      start: "2026-09-27",
      end: "2026-09-29",
      allDay: true,
      blocksTime: true,
    });

    expect(validateEventDraft(draft, { localDestination: true, titleChanged: false })).toBe(
      "localSingleDay",
    );
  });

  it("updates all schedule fields when switching between all-day and timed values", () => {
    const draft = eventDraftFromProvider({
      title: "Planning retreat",
      start: "2026-09-27",
      end: "2026-09-29",
      allDay: true,
      blocksTime: false,
    });
    draft.allDay = false;
    draft.startLocal = "2026-09-27T09:00";
    draft.endLocal = "2026-09-28T10:00";

    expect(
      providerPatchFromDraft(draft, new Set(["allDay"])),
    ).toEqual({
      allDay: false,
      start: "2026-09-27T02:00:00.000Z",
      end: "2026-09-28T03:00:00.000Z",
    });
  });
});
