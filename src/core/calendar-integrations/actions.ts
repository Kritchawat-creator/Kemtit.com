"use server";

import { revalidatePath } from "next/cache";

import { authFailureContext, isUnauthenticatedAuthError } from "@/core/auth/session-errors";
import { fail, ok, zodFail, type ActionResult } from "@/core/shared/result";
import { createServerSupabase } from "@/lib/supabase/server";

import {
  createExternalCalendarEvent as createProviderEvent,
  deleteExternalCalendarEvent as deleteProviderEvent,
  disconnectExternalCalendar as disconnectProviderCalendar,
  ExternalCalendarServiceError,
  loadExternalCalendarEvent as loadProviderEvent,
  reconcileExternalCalendarOperation as reconcileProviderOperation,
  syncExternalCalendar,
  updateExternalCalendarEvent as updateProviderEvent,
  type ExternalCalendarEventDetail,
  type ExternalCalendarOperationResult,
} from "./service";
import {
  createExternalCalendarEventSchema,
  deleteExternalCalendarEventSchema,
  externalCalendarEventReferenceSchema,
  externalCalendarOperationSchema,
  updateExternalCalendarEventSchema,
} from "./schema";

function revalidateCalendarIntegration() {
  revalidatePath("/settings");
  revalidatePath("/calendar");
  revalidatePath("/calendar/events");
  revalidatePath("/today");
  revalidatePath("/plan");
  revalidatePath("/insights");
}

type AuthenticatedUser = { userId: string } | { error: "unauthorized" | "generic" };

async function authenticatedUser(): Promise<AuthenticatedUser> {
  const supabase = await createServerSupabase();
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
    console.error(
      "[calendar-integrations] auth verification failed",
      authFailureContext(authError),
    );
    return { error: "generic" };
  }

  return user ? { userId: user.id } : { error: "unauthorized" };
}

function actionError(error: unknown, fallback: string): string {
  if (!(error instanceof ExternalCalendarServiceError)) return fallback;
  switch (error.code) {
    case "unauthorized":
      return "unauthorized";
    case "notFound":
      return "notFound";
    case "validation":
      return "validation";
    case "externalCalendarUnavailable":
      return "externalCalendarUnavailable";
    case "externalCalendarConflict":
      return "externalCalendarConflict";
    case "externalCalendarOutcomeUnknown":
      return "externalCalendarOutcomeUnknown";
    case "calendarSyncFailed":
      return "calendarSyncFailed";
    case "generic":
      return fallback;
  }
}

function reportActionFailure(action: string, error: unknown) {
  const code = error instanceof ExternalCalendarServiceError ? error.code : "unexpected";
  console.error(`[calendar-integrations] ${action} failed`, { code });
}

export async function syncExternalCalendarConnection(
  input: unknown,
): Promise<ActionResult<{ imported: number }>> {
  const parsed = externalCalendarOperationSchema.pick({ connectionId: true }).safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const authentication = await authenticatedUser();
  if ("error" in authentication) return fail(authentication.error);
  const { userId } = authentication;

  try {
    const imported = await syncExternalCalendar(userId, parsed.data.connectionId);
    revalidateCalendarIntegration();
    return ok({ imported });
  } catch (error) {
    reportActionFailure("manual sync", error);
    revalidateCalendarIntegration();
    return fail(actionError(error, "calendarSyncFailed"));
  }
}

export async function disconnectExternalCalendarConnection(input: unknown): Promise<ActionResult> {
  const parsed = externalCalendarOperationSchema.pick({ connectionId: true }).safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const authentication = await authenticatedUser();
  if ("error" in authentication) return fail(authentication.error);
  const { userId } = authentication;

  try {
    await disconnectProviderCalendar(userId, parsed.data.connectionId);
    revalidateCalendarIntegration();
    return ok(null);
  } catch (error) {
    reportActionFailure("disconnect", error);
    return fail(actionError(error, "generic"));
  }
}

export async function createExternalCalendarEvent(
  input: unknown,
): Promise<ActionResult<ExternalCalendarOperationResult>> {
  const parsed = createExternalCalendarEventSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const authentication = await authenticatedUser();
  if ("error" in authentication) return fail(authentication.error);
  const { userId } = authentication;

  try {
    const result = await createProviderEvent({ userId, ...parsed.data });
    revalidateCalendarIntegration();
    return ok(result);
  } catch (error) {
    reportActionFailure("create provider event", error);
    revalidateCalendarIntegration();
    return fail(actionError(error, "generic"));
  }
}

export async function updateExternalCalendarEvent(
  input: unknown,
): Promise<ActionResult<ExternalCalendarOperationResult>> {
  const parsed = updateExternalCalendarEventSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const authentication = await authenticatedUser();
  if ("error" in authentication) return fail(authentication.error);
  const { userId } = authentication;

  try {
    const result = await updateProviderEvent({ userId, ...parsed.data });
    revalidateCalendarIntegration();
    return ok(result);
  } catch (error) {
    reportActionFailure("update provider event", error);
    revalidateCalendarIntegration();
    return fail(actionError(error, "generic"));
  }
}

export async function deleteExternalCalendarEvent(
  input: unknown,
): Promise<ActionResult<ExternalCalendarOperationResult>> {
  const parsed = deleteExternalCalendarEventSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const authentication = await authenticatedUser();
  if ("error" in authentication) return fail(authentication.error);
  const { userId } = authentication;

  try {
    const result = await deleteProviderEvent({ userId, ...parsed.data });
    revalidateCalendarIntegration();
    return ok(result);
  } catch (error) {
    reportActionFailure("delete provider event", error);
    revalidateCalendarIntegration();
    return fail(actionError(error, "generic"));
  }
}

export async function reconcileExternalCalendarOperation(
  input: unknown,
): Promise<ActionResult<ExternalCalendarOperationResult>> {
  const parsed = externalCalendarOperationSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const authentication = await authenticatedUser();
  if ("error" in authentication) return fail(authentication.error);
  const { userId } = authentication;

  try {
    const result = await reconcileProviderOperation({ userId, ...parsed.data });
    revalidateCalendarIntegration();
    return ok(result);
  } catch (error) {
    reportActionFailure("reconcile provider operation", error);
    revalidateCalendarIntegration();
    return fail(actionError(error, "generic"));
  }
}

export async function loadExternalCalendarEvent(
  input: unknown,
): Promise<ActionResult<ExternalCalendarEventDetail>> {
  const parsed = externalCalendarEventReferenceSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const authentication = await authenticatedUser();
  if ("error" in authentication) return fail(authentication.error);
  const { userId } = authentication;

  try {
    return ok(await loadProviderEvent({ userId, ...parsed.data }));
  } catch (error) {
    reportActionFailure("load provider event", error);
    return fail(actionError(error, "generic"));
  }
}
