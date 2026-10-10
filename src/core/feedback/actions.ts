"use server";

import { fail, ok, zodFail, type ActionResult } from "@/core/shared/result";
import { createServerSupabase } from "@/lib/supabase/server";
import { authFailureContext, isUnauthenticatedAuthError } from "@/core/auth/session-errors";

import { feedbackSubmissionSchema } from "./schema";

export type FeedbackSubmission = {
  id: string;
  createdAt: string;
  duplicate: boolean;
};

type AuthenticatedClient =
  | { supabase: Awaited<ReturnType<typeof createServerSupabase>>; userId: string }
  | { error: "unauthorized" | "generic" };

async function getAuthenticatedClient(): Promise<AuthenticatedClient> {
  let supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  try {
    supabase = await createServerSupabase();
  } catch {
    console.error("[feedback] Supabase client initialization failed", { code: "unknown" });
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
    console.error("[feedback] auth verification failed", authFailureContext(authError));
    return { error: "generic" };
  }

  return user ? { supabase, userId: user.id } : { error: "unauthorized" };
}

export async function submitFeedback(input: unknown): Promise<ActionResult<FeedbackSubmission>> {
  const parsed = feedbackSubmissionSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const authentication = await getAuthenticatedClient();
  if ("error" in authentication) return fail(authentication.error);

  try {
    const { data, error } = await authentication.supabase.rpc("submit_user_feedback", {
      p_request_id: parsed.data.requestId,
      p_topic_code: parsed.data.topicCode,
    });

    if (error) {
      if (error.message === "feedback_unauthorized" || error.code === "42501") {
        return fail("unauthorized");
      }
      if (error.message === "feedback_validation") return fail("validation");
      if (error.message === "feedback_request_conflict") return fail("feedbackRequestConflict");
      if (error.message === "feedback_rate_limited") return fail("feedbackRateLimited");
      console.error("[feedback] submit failed", { code: error.code });
      return fail("generic");
    }

    const row = data?.[0];
    if (
      !row ||
      typeof row.feedback_id !== "string" ||
      typeof row.feedback_created_at !== "string" ||
      typeof row.was_duplicate !== "boolean"
    ) {
      console.error("[feedback] submit returned an invalid result");
      return fail("generic");
    }

    return ok({
      id: row.feedback_id,
      createdAt: row.feedback_created_at,
      duplicate: row.was_duplicate,
    });
  } catch {
    console.error("[feedback] submit transport failed", { code: "unknown" });
    return fail("generic");
  }
}
