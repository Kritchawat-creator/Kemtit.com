import { beforeEach, describe, expect, it, vi } from "vitest";

import { createServerSupabase } from "@/lib/supabase/server";

import { attachPhoto, removePhoto } from "./actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/flags", () => ({ UPLOADS_ENABLED: true }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: vi.fn() }));

const USER_ID = "1b124945-a6ad-4553-8478-c994b3840260";
const TASK_ID = "8f7d09e1-9c21-4143-9015-0f2deeb43823";
const PHOTO_ID = "75e2bd47-2c20-49da-9c83-c28af8d16103";
const rpc = vi.fn();

describe("attachPhoto task RPC error classification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockResolvedValue({ data: PHOTO_ID, error: null });
    vi.mocked(createServerSupabase).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      rpc,
    } as never);
  });

  async function attach() {
    return attachPhoto({
      kind: "taskPhoto",
      targetId: TASK_ID,
      path: `${USER_ID}/${TASK_ID}/${PHOTO_ID}.png`,
    });
  }

  it.each(["40003", "08007"])(
    "treats SQLSTATE %s as ambiguous even if its message contains a known rejection marker",
    async (code) => {
      rpc.mockResolvedValue({ data: null, error: { code, message: "photo_limit" } });

      expect(await attach()).toMatchObject({ ok: false, error: "uploadUncertain" });
    },
  );

  it("trusts a known business marker only when returned as a P0001 rejection", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "P0001", message: "photo_limit" } });

    expect(await attach()).toMatchObject({ ok: false, error: "photoLimit" });
  });

  it("treats a malformed successful RPC response as ambiguous", async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    expect(await attach()).toMatchObject({ ok: false, error: "uploadUncertain" });
  });
});

describe("removePhoto reference cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockSupabase(options: {
    avatarPath?: string | null;
    readError?: { code: string } | null;
    clearedProfile?: { id: string } | null;
    clearError?: { code: string } | null;
  }) {
    const readQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: options.avatarPath === undefined ? null : { avatar_path: options.avatarPath },
        error: options.readError ?? null,
      }),
    };
    const updateQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: options.clearedProfile ?? null,
        error: options.clearError ?? null,
      }),
    };
    const profileFrom = vi
      .fn()
      .mockReturnValueOnce(readQuery)
      .mockReturnValueOnce(updateQuery);
    const storageFrom = vi.fn().mockReturnValue({ remove: vi.fn() });
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: profileFrom,
      storage: { from: storageFrom },
    };
    vi.mocked(createServerSupabase).mockResolvedValue(supabase as never);
    return { supabase, updateQuery, storageFrom };
  }

  it("does not clear an avatar when the read fails", async () => {
    const { supabase } = mockSupabase({
      avatarPath: `${USER_ID}/avatar/old.png`,
      readError: { code: "08006" },
    });

    expect(await removePhoto({ kind: "avatar" })).toMatchObject({ ok: false, error: "generic" });
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it("uses compare-and-clear and reports a concurrent avatar replacement", async () => {
    const previousPath = `${USER_ID}/avatar/old.png`;
    const { updateQuery, storageFrom } = mockSupabase({
      avatarPath: previousPath,
      clearedProfile: null,
    });

    expect(await removePhoto({ kind: "avatar" })).toMatchObject({ ok: false, error: "generic" });
    expect(updateQuery.eq).toHaveBeenNthCalledWith(1, "id", USER_ID);
    expect(updateQuery.eq).toHaveBeenNthCalledWith(2, "avatar_path", previousPath);
    expect(storageFrom).not.toHaveBeenCalled();
  });

  it("unlinks a task photo without deleting its private object", async () => {
    const photoId = "75e2bd47-2c20-49da-9c83-c28af8d16103";
    const taskDeleteQuery = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { path: `${USER_ID}/${TASK_ID}/${photoId}.png` },
        error: null,
      }),
    };
    const storageFrom = vi.fn();
    vi.mocked(createServerSupabase).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn().mockReturnValue(taskDeleteQuery),
      storage: { from: storageFrom },
    } as never);

    expect(await removePhoto({ kind: "taskPhoto", id: photoId })).toMatchObject({ ok: true });
    expect(storageFrom).not.toHaveBeenCalled();
  });
});
