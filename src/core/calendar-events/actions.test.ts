import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseMock, revalidatePathMock } = vi.hoisted(() => ({
  createServerSupabaseMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: createServerSupabaseMock,
}));

import { createCalendarEvent, deleteCalendarEvent, updateCalendarEvent } from "./actions";

const eventId = "550e8400-e29b-41d4-a716-446655440001";
const userId = "550e8400-e29b-41d4-a716-446655440000";

function configureSupabase({
  data = { id: eventId },
  user = { id: userId },
}: {
  data?: { id: string } | null;
  user?: { id: string } | null;
} = {}) {
  const filters: Array<[string, unknown]> = [];
  const writes: {
    insertValues: Record<string, unknown> | null;
    updateValues: Record<string, unknown> | null;
  } = { insertValues: null, updateValues: null };
  const query = {
    delete: vi.fn(() => query),
    insert: vi.fn((values: Record<string, unknown>) => {
      writes.insertValues = values;
      return query;
    }),
    update: vi.fn((values: Record<string, unknown>) => {
      writes.updateValues = values;
      return query;
    }),
    eq: vi.fn((column: string, value: unknown) => {
      filters.push([column, value]);
      return query;
    }),
    select: vi.fn(() => query),
    single: vi.fn().mockResolvedValue({ data: { id: eventId }, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => query),
  };
  createServerSupabaseMock.mockResolvedValue(supabase);
  return { filters, query, supabase, writes };
}

describe("createCalendarEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("defaults new local events to blocking availability for existing callers", async () => {
    const { writes } = configureSupabase();

    await expect(
      createCalendarEvent({ title: "Team review", eventDate: "2026-09-28" }),
    ).resolves.toEqual({ ok: true, data: { id: eventId } });

    expect(writes.insertValues).toMatchObject({ user_id: userId, blocks_time: true });
  });
});

describe("deleteCalendarEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("only permanently deletes the authenticated user's USER-owned event", async () => {
    const { filters, query } = configureSupabase();

    await expect(deleteCalendarEvent({ id: eventId })).resolves.toEqual({ ok: true, data: null });
    expect(query.delete).toHaveBeenCalledOnce();
    expect(filters).toEqual([
      ["id", eventId],
      ["user_id", userId],
      ["data_origin", "USER"],
    ]);
    expect(revalidatePathMock).toHaveBeenCalledWith("/calendar");
  });

  it("returns not-found for provider-owned events and avoids unauthenticated writes", async () => {
    const providerEvent = configureSupabase({ data: null });
    await expect(deleteCalendarEvent({ id: eventId })).resolves.toMatchObject({
      ok: false,
      error: "notFound",
    });
    expect(providerEvent.filters).toContainEqual(["data_origin", "USER"]);

    const unauthenticated = configureSupabase({ user: null });
    await expect(deleteCalendarEvent({ id: eventId })).resolves.toMatchObject({
      ok: false,
      error: "unauthorized",
    });
    expect(unauthenticated.supabase.from).not.toHaveBeenCalled();
  });
});

describe("updateCalendarEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates only the authenticated user's USER event and clears times for all-day values", async () => {
    const { filters, query, writes } = configureSupabase();

    await expect(
      updateCalendarEvent({
        id: eventId,
        title: "Team review",
        eventDate: "2026-09-28",
        allDay: true,
        blocksTime: false,
        startTime: "09:00",
        endTime: "09:30",
      }),
    ).resolves.toEqual({ ok: true, data: { id: eventId } });

    expect(query.update).toHaveBeenCalledOnce();
    expect(writes.updateValues).toEqual({
      title: "Team review",
      event_date: "2026-09-28",
      all_day: true,
      blocks_time: false,
      start_time: null,
      end_time: null,
    });
    expect(filters).toEqual([
      ["id", eventId],
      ["user_id", userId],
      ["data_origin", "USER"],
    ]);
    expect(revalidatePathMock).toHaveBeenCalledWith("/calendar");
  });

  it("preserves notes when the edit does not include them", async () => {
    const { writes } = configureSupabase();

    await updateCalendarEvent({
      id: eventId,
      title: "Team review",
      eventDate: "2026-09-28",
      allDay: false,
      startTime: "09:00",
      endTime: "09:30",
    });

    expect(writes.updateValues).not.toHaveProperty("notes");
  });

  it("rejects invalid event values and never writes for an unauthenticated user", async () => {
    await expect(
      updateCalendarEvent({
        id: eventId,
        title: "Team review",
        eventDate: "2026-09-28",
        allDay: false,
        startTime: "10:00",
        endTime: "09:00",
      }),
    ).resolves.toMatchObject({ ok: false, error: "validation" });
    expect(createServerSupabaseMock).not.toHaveBeenCalled();

    const unauthenticated = configureSupabase({ user: null });
    await expect(
      updateCalendarEvent({
        id: eventId,
        title: "Team review",
        eventDate: "2026-09-28",
        allDay: true,
      }),
    ).resolves.toMatchObject({ ok: false, error: "unauthorized" });
    expect(unauthenticated.supabase.from).not.toHaveBeenCalled();
  });

  it("does not update provider IMPORT events", async () => {
    const providerEvent = configureSupabase({ data: null });

    await expect(
      updateCalendarEvent({
        id: eventId,
        title: "Imported event",
        eventDate: "2026-09-28",
        allDay: true,
      }),
    ).resolves.toMatchObject({ ok: false, error: "notFound" });
    expect(providerEvent.filters).toContainEqual(["data_origin", "USER"]);
  });
});
