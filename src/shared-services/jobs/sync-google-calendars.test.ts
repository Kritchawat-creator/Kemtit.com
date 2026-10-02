import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listActiveExternalCalendarConnections: vi.fn(),
  syncExternalCalendar: vi.fn(),
}));

vi.mock("@/core/calendar-integrations/admin", () => ({
  listActiveExternalCalendarConnections: mocks.listActiveExternalCalendarConnections,
}));

vi.mock("@/core/calendar-integrations/service", () => ({
  ExternalCalendarServiceError: class ExternalCalendarServiceError extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  },
  syncExternalCalendar: mocks.syncExternalCalendar,
}));

import { syncGoogleCalendars } from "./sync-google-calendars";

describe("provider-neutral scheduled calendar sync", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("uses the fair single-connection batch and dispatches Outlook through the shared service", async () => {
    mocks.listActiveExternalCalendarConnections.mockResolvedValue([
      { id: "connection-1", user_id: "user-1", provider: "outlook" },
    ]);
    mocks.syncExternalCalendar.mockResolvedValue(2);

    const summary = await syncGoogleCalendars();

    expect(mocks.listActiveExternalCalendarConnections).toHaveBeenCalledWith(1);
    expect(mocks.syncExternalCalendar).toHaveBeenCalledWith("user-1", "connection-1");
    expect(summary).toEqual({ connections: 1, succeeded: 1, failed: 0, changes: 2 });
  });

  it("logs only the safe error code for a failed provider sync", async () => {
    const syncError = Object.assign(new Error("provider response body with secret"), {
      code: "timeout",
    });
    mocks.listActiveExternalCalendarConnections.mockResolvedValue([
      { id: "connection-2", user_id: "user-2", provider: "google" },
    ]);
    mocks.syncExternalCalendar.mockRejectedValue(syncError);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const summary = await syncGoogleCalendars();

    expect(summary).toEqual({ connections: 1, succeeded: 0, failed: 1, changes: 0 });
    expect(consoleError).toHaveBeenCalledWith("[calendar-integrations] scheduled sync failed", {
      provider: "google",
      connectionId: "connection-2",
      code: "unexpected",
    });
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("secret");
    consoleError.mockRestore();
  });
});
