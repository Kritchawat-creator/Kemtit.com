import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseMock } = vi.hoisted(() => ({
  createServerSupabaseMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: createServerSupabaseMock,
}));

import { submitFeedback } from "./actions";

const requestId = "550e8400-e29b-41d4-a716-446655440000";
const feedbackId = "550e8400-e29b-41d4-a716-446655440001";

function configureSupabase({
  user = { id: "550e8400-e29b-41d4-a716-446655440002" },
  data = [{
    feedback_id: feedbackId,
    feedback_created_at: "2026-10-04T10:00:00.000Z",
    was_duplicate: false,
  }],
  error = null,
  authError = null,
  authThrows = false,
  rpcThrows = false,
}: {
  user?: { id: string } | null;
  data?: unknown[] | null;
  error?: { code?: string; message: string } | null;
  authError?: unknown;
  authThrows?: boolean;
  rpcThrows?: boolean;
} = {}) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  const getUser = vi.fn().mockResolvedValue({ data: { user }, error: authError });
  if (authThrows) getUser.mockRejectedValue(new Error("private auth service detail"));
  if (rpcThrows) rpc.mockRejectedValue(new Error("private database transport detail"));
  const supabase = {
    auth: { getUser },
    rpc,
  };
  createServerSupabaseMock.mockResolvedValue(supabase);
  return { rpc, supabase };
}

describe("submitFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits only the allowlisted topic and preserves the idempotency key", async () => {
    const { rpc } = configureSupabase();

    await expect(submitFeedback({ requestId, topicCode: "easy_to_use" })).resolves.toEqual({
      ok: true,
      data: {
        id: feedbackId,
        createdAt: "2026-10-04T10:00:00.000Z",
        duplicate: false,
      },
    });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("submit_user_feedback", {
      p_request_id: requestId,
      p_topic_code: "easy_to_use",
    });
  });

  it("returns the prior result for a committed retry", async () => {
    configureSupabase({ data: [{
      feedback_id: feedbackId,
      feedback_created_at: "2026-10-04T10:00:00.000Z",
      was_duplicate: true,
    }] });

    await expect(submitFeedback({ requestId, topicCode: "easy_to_use" })).resolves.toMatchObject({
      ok: true,
      data: { id: feedbackId, duplicate: true },
    });
  });

  it.each([
    ["feedback_rate_limited", "feedbackRateLimited"],
    ["feedback_request_conflict", "feedbackRequestConflict"],
    ["feedback_unauthorized", "unauthorized"],
    ["unexpected database detail", "generic"],
  ])("maps RPC error %s to safe key %s", async (message, expectedKey) => {
    configureSupabase({ error: { code: "P0001", message } });

    await expect(submitFeedback({ requestId, topicCode: "easy_to_use" })).resolves.toMatchObject({
      ok: false,
      error: expectedKey,
    });
  });

  it.each([
    ["an unsupported topic", { requestId, topicCode: "other" }],
    ["a malformed request id", { requestId: "bad-id", topicCode: "easy_to_use" }],
    ["a forged user id", { requestId, topicCode: "easy_to_use", userId: "forged" }],
    ["an extra status field", { requestId, topicCode: "easy_to_use", status: "published" }],
  ])("rejects %s before initializing Supabase", async (_description, input) => {
    await expect(submitFeedback(input)).resolves.toMatchObject({ ok: false, error: "validation" });
    expect(createServerSupabaseMock).not.toHaveBeenCalled();
  });

  it("does not call the database for an unauthenticated user", async () => {
    const { rpc } = configureSupabase({ user: null });

    await expect(submitFeedback({ requestId, topicCode: "easy_to_use" })).resolves.toMatchObject({
      ok: false,
      error: "unauthorized",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("fails closed when auth returns an unexpected error alongside a user", async () => {
    const { rpc } = configureSupabase({ authError: new Error("private auth service detail") });

    await expect(submitFeedback({ requestId, topicCode: "easy_to_use" })).resolves.toMatchObject({
      ok: false,
      error: "generic",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("fails closed when auth verification throws", async () => {
    const { rpc } = configureSupabase({ authThrows: true });

    await expect(submitFeedback({ requestId, topicCode: "easy_to_use" })).resolves.toMatchObject({
      ok: false,
      error: "generic",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("keeps transport and malformed RPC results as generic uncertain failures", async () => {
    configureSupabase({ rpcThrows: true });
    await expect(submitFeedback({ requestId, topicCode: "easy_to_use" })).resolves.toMatchObject({
      ok: false,
      error: "generic",
    });

    configureSupabase({ data: [] });
    await expect(submitFeedback({ requestId, topicCode: "easy_to_use" })).resolves.toMatchObject({
      ok: false,
      error: "generic",
    });
  });
});
