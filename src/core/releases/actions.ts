"use server";

import { revalidatePath } from "next/cache";

import { authFailureContext, isUnauthenticatedAuthError } from "@/core/auth/session-errors";
import { fail, ok, zodFail, type ActionResult } from "@/core/shared/result";
import { createServerSupabase } from "@/lib/supabase/server";

import { acknowledgeReleaseNoteSchema } from "./schema";

export type ReleaseNoteAcknowledgement = {
  releaseNoteId: string;
  readAt: string;
};

type AuthenticatedClient =
  | { supabase: Awaited<ReturnType<typeof createServerSupabase>>; userId: string }
  | { error: "unauthorized" | "generic" };

async function getAuthenticatedClient(): Promise<AuthenticatedClient> {
  let supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  try {
    supabase = await createServerSupabase();
  } catch {
    console.error("[releases] Supabase client initialization failed", { code: "unknown" });
    return { error: "generic" };
  }

  let user: { id: string } | null = null;
  let authError: unknown = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
    authError = result.error;
  } catch (error) {
    authError = error;
  }

  if (authError) {
    if (isUnauthenticatedAuthError(authError)) return { error: "unauthorized" };
    console.error("[releases] auth verification failed", authFailureContext(authError));
    return { error: "generic" };
  }

  return user ? { supabase, userId: user.id } : { error: "unauthorized" };
}

export async function acknowledgeReleaseNote(
  input: unknown,
): Promise<ActionResult<ReleaseNoteAcknowledgement>> {
  const parsed = acknowledgeReleaseNoteSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const authentication = await getAuthenticatedClient();
  if ("error" in authentication) return fail(authentication.error);

  try {
    const { data, error } = await authentication.supabase.rpc("acknowledge_release_note", {
      p_release_note_id: parsed.data.releaseNoteId,
    });

    if (error) {
      if (error.message === "release_note_unauthorized" || error.code === "42501") {
        return fail("unauthorized");
      }
      if (error.message === "release_note_unavailable") return fail("notFound");
      console.error("[releases] acknowledge failed", { code: error.code });
      return fail("generic");
    }
    if (typeof data !== "string" || data.length === 0) {
      console.error("[releases] acknowledge returned an invalid result");
      return fail("generic");
    }

    revalidatePath("/updates");
    revalidatePath(`/updates/${parsed.data.releaseNoteId}`);
    return ok({ releaseNoteId: parsed.data.releaseNoteId, readAt: data });
  } catch {
    console.error("[releases] acknowledge transport failed", { code: "unknown" });
    return fail("generic");
  }
}
