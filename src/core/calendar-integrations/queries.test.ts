import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
} from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseMock, createAdminSupabaseMock, loadEventDetailsMock } = vi.hoisted(
  () => ({
    createServerSupabaseMock: vi.fn(),
    createAdminSupabaseMock: vi.fn(),
    loadEventDetailsMock: vi.fn(),
  }),
);

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: createServerSupabaseMock }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabase: createAdminSupabaseMock }));
vi.mock("./service", () => ({ listExternalCalendarEventDetails: loadEventDetailsMock }));

import {
  listExternalCalendarConnections,
  listExternalCalendarEventDetails,
  listExternalCalendarOperations,
} from "./queries";

function makeQuery(data: unknown = [], error: { code: string } | null = null) {
  const promise = Promise.resolve({ data, error });
  const query = Object.assign(promise, {
    select: () => query,
    eq: () => query,
    in: () => query,
    order: () => query,
    limit: () => query,
  });
  return query;
}

function configureAuth(result: { data: { user: { id: string } | null }; error: unknown | null }) {
  const getUser = vi.fn().mockResolvedValue(result);
  createServerSupabaseMock.mockResolvedValue({ auth: { getUser }, from: () => makeQuery() });
  createAdminSupabaseMock.mockReturnValue({ from: () => makeQuery() });
  return getUser;
}

const queryCases = [
  ["connections", listExternalCalendarConnections],
  ["operations", listExternalCalendarOperations],
  ["event details", () => listExternalCalendarEventDetails(["source-id"])],
] as const;

describe("calendar integration queries and auth failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    loadEventDetailsMock.mockResolvedValue([]);
  });

  it.each(queryCases)(
    "returns an empty %s list for a confirmed missing session",
    async (_name, query) => {
      const getUser = configureAuth({
        data: { user: null },
        error: new AuthSessionMissingError(),
      });

      await expect(query()).resolves.toEqual([]);
      expect(getUser).toHaveBeenCalledOnce();
      expect(createAdminSupabaseMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["retryable transport failure", () => new AuthRetryableFetchError("private detail", 503)],
    [
      "temporary auth server failure",
      () => new AuthApiError("private detail", 503, "server_error"),
    ],
  ])("surfaces a %s as a query failure instead of an empty result", async (_name, makeError) => {
    const getUser = configureAuth({ data: { user: null }, error: makeError() });
    const query = listExternalCalendarConnections();

    await expect(query).rejects.toMatchObject({
      name: "QueryError",
      source: "calendar-integrations.connections-auth",
      message: "queryFailed",
    });
    expect(getUser).toHaveBeenCalledOnce();
    expect(createAdminSupabaseMock).not.toHaveBeenCalled();
  });

  it("keeps successful empty results distinct from auth and database failures", async () => {
    configureAuth({ data: { user: { id: "user-1" } }, error: null });

    await expect(listExternalCalendarConnections()).resolves.toEqual([]);
    await expect(listExternalCalendarOperations()).resolves.toEqual([]);
    await expect(listExternalCalendarEventDetails(["source-id"])).resolves.toEqual([]);
    expect(loadEventDetailsMock).toHaveBeenCalledWith("user-1", ["source-id"]);
  });
});
