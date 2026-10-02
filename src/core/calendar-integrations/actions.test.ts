import { AuthRetryableFetchError, AuthSessionMissingError } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseMock, createProviderEventMock } = vi.hoisted(() => ({
  createServerSupabaseMock: vi.fn(),
  createProviderEventMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: createServerSupabaseMock }));
vi.mock("./service", () => ({
  createExternalCalendarEvent: createProviderEventMock,
  deleteExternalCalendarEvent: vi.fn(),
  disconnectExternalCalendar: vi.fn(),
  loadExternalCalendarEvent: vi.fn(),
  reconcileExternalCalendarOperation: vi.fn(),
  syncExternalCalendar: vi.fn(),
  updateExternalCalendarEvent: vi.fn(),
  ExternalCalendarServiceError: class ExternalCalendarServiceError extends Error {
    code = "generic";
  },
}));

import { createExternalCalendarEvent } from "./actions";

const validInput = {
  connectionId: "90e33f2e-72c2-4d56-9fe3-2c08d90c5001",
  operationId: "6b1b027e-cc3d-4f7e-bd7a-71fe61c63122",
  value: {
    title: "Planning session",
    start: "2026-09-27T09:00:00+07:00",
    end: "2026-09-27T10:00:00+07:00",
    allDay: false,
    blocksTime: true,
  },
};

describe("calendar integration action auth handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it("returns generic when auth verification returns a temporary 503", async () => {
    createServerSupabaseMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new AuthRetryableFetchError("private auth transport detail", 503),
        }),
      },
    });

    await expect(createExternalCalendarEvent(validInput)).resolves.toEqual({
      ok: false,
      error: "generic",
    });
    expect(createProviderEventMock).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      "[calendar-integrations] auth verification failed",
      expect.objectContaining({ code: expect.any(String) }),
    );
    expect(vi.mocked(console.error).mock.calls.flat().join(" ")).not.toContain("private auth");
  });

  it("returns unauthorized only when Supabase confirms the session is missing", async () => {
    createServerSupabaseMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new AuthSessionMissingError(),
        }),
      },
    });

    await expect(createExternalCalendarEvent(validInput)).resolves.toEqual({
      ok: false,
      error: "unauthorized",
    });
    expect(createProviderEventMock).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });
});
