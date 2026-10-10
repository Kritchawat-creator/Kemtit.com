"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, zodFail, type ActionResult } from "@/core/shared/result";
import { UPLOADS_ENABLED } from "@/lib/flags";
import { createServerSupabase } from "@/lib/supabase/server";

const uuid = z.uuid();
const reserveSchema = z.object({
  taskId: uuid,
  operationId: uuid,
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  contentSha256: z.string().regex(/^[0-9a-f]{64}$/),
});
const attachSchema = z.object({ taskId: uuid, operationId: uuid, path: z.string().min(1).max(300) });
const failSchema = z.object({
  taskId: uuid,
  operationId: uuid,
  failureCode: z.enum(["upload_failed", "upload_unknown"]),
});
const cancelSchema = z.object({ taskId: uuid, operationId: uuid });
const orderSchema = z.object({ taskId: uuid, photoIds: z.array(uuid).max(5) }).superRefine((value, ctx) => {
  if (new Set(value.photoIds).size !== value.photoIds.length) {
    ctx.addIssue({ code: "custom", path: ["photoIds"], message: "duplicateTask" });
  }
});

const reservationSchema = z.object({
  user_id: uuid,
  task_id: uuid,
  operation_id: uuid,
  path: z.string().min(1).max(300),
  mime_type: z.enum(["image/jpeg", "image/png", "image/webp"]),
  content_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  sort_order: z.number().int().nonnegative(),
  status: z.enum(["reserved", "failed", "attached", "cancelled"]),
  failure_code: z.enum(["upload_failed", "upload_unknown"]).nullable(),
  photo_id: uuid.nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type TaskCardPhotoReservation = z.infer<typeof reservationSchema>;

function photoError(message: string | undefined) {
  const value = message?.toLowerCase() ?? "";
  if (value.includes("photo_limit")) return "photoLimit";
  if (value.includes("task_not_found")) return "notFound";
  if (value.includes("idempotency_conflict")) return "idempotencyConflict";
  if (value.includes("photo_reservation_not_found")) return "notFound";
  if (value.includes("photo_reservation_cancelled")) return "photoReservationCancelled";
  if (value.includes("photo_upload_pending")) return "conflict";
  if (value.includes("photo_order_conflict")) return "conflict";
  if (value.includes("photo_object_missing")) return "uploadFailed";
  if (value.includes("photo_invalid")) return "photoInvalid";
  return "generic";
}

async function requireUser() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

function revalidateTaskViews() {
  revalidatePath("/", "layout");
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/plan");
}

export async function reserveTaskCardPhoto(input: unknown): Promise<ActionResult<TaskCardPhotoReservation>> {
  if (!UPLOADS_ENABLED) return fail("featureDisabled");
  const parsed = reserveSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const { supabase, user } = await requireUser();
  if (!user) return fail("unauthorized");
  const { data, error } = await supabase.rpc("reserve_task_card_photo_atomic", {
    p_task_id: parsed.data.taskId,
    p_operation_id: parsed.data.operationId,
    p_mime_type: parsed.data.mimeType,
    p_content_sha256: parsed.data.contentSha256,
  });
  if (error) {
    console.error("[task-cards] photo reservation failed", { code: error.code });
    return fail(photoError(error.message));
  }
  const reservation = reservationSchema.safeParse(data);
  if (!reservation.success || reservation.data.user_id !== user.id || reservation.data.task_id !== parsed.data.taskId) {
    return fail("generic");
  }
  return ok(reservation.data);
}

export async function attachTaskCardPhotoReservation(input: unknown): Promise<ActionResult<{ id: string; sortOrder: number }>> {
  if (!UPLOADS_ENABLED) return fail("featureDisabled");
  const parsed = attachSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const { supabase, user } = await requireUser();
  if (!user) return fail("unauthorized");
  const { data: id, error } = await supabase.rpc("attach_task_card_photo_reservation_atomic", {
    p_task_id: parsed.data.taskId,
    p_operation_id: parsed.data.operationId,
    p_path: parsed.data.path,
  });
  if (error) {
    console.error("[task-cards] photo attach failed", { code: error.code });
    return fail(photoError(error.message));
  }
  if (typeof id !== "string" || !uuid.safeParse(id).success) return fail("generic");

  const { data: reservation, error: readError } = await supabase
    .from("task_photo_reservations")
    .select("sort_order, status, photo_id")
    .eq("task_id", parsed.data.taskId)
    .eq("operation_id", parsed.data.operationId)
    .maybeSingle();
  if (readError || reservation?.status !== "attached" || reservation.photo_id !== id) return fail("uploadUncertain");
  revalidateTaskViews();
  return ok({ id, sortOrder: reservation.sort_order });
}

export async function markTaskCardPhotoFailure(input: unknown): Promise<ActionResult> {
  const parsed = failSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const { supabase, user } = await requireUser();
  if (!user) return fail("unauthorized");
  const { data, error } = await supabase.rpc("mark_task_card_photo_failure_atomic", {
    p_task_id: parsed.data.taskId,
    p_operation_id: parsed.data.operationId,
    p_failure_code: parsed.data.failureCode,
  });
  if (error) {
    console.error("[task-cards] photo failure state update failed", { code: error.code });
    return fail(photoError(error.message));
  }
  if (data !== true) return fail("conflict");
  return ok(null);
}

export async function cancelTaskCardPhotoReservation(
  input: unknown,
): Promise<ActionResult<{ status: "attached" | "cancelled"; photoId: string | null }>> {
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const { supabase, user } = await requireUser();
  if (!user) return fail("unauthorized");
  const { data, error } = await supabase.rpc("cancel_task_card_photo_reservation_atomic", {
    p_task_id: parsed.data.taskId,
    p_operation_id: parsed.data.operationId,
  });
  if (error) {
    console.error("[task-cards] photo reservation cancel failed", { code: error.code });
    return fail(photoError(error.message));
  }
  const response = z.object({
    operationId: uuid,
    status: z.enum(["attached", "cancelled"]),
    photoId: uuid.nullable(),
  }).safeParse(data);
  if (!response.success || response.data.operationId !== parsed.data.operationId) return fail("generic");
  if (response.data.status === "attached") revalidateTaskViews();
  return ok({ status: response.data.status, photoId: response.data.photoId });
}

export async function setTaskCardPhotoOrder(input: unknown): Promise<ActionResult> {
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const { supabase, user } = await requireUser();
  if (!user) return fail("unauthorized");
  const { data, error } = await supabase.rpc("set_task_photo_order_atomic", {
    p_task_id: parsed.data.taskId,
    p_photo_ids: parsed.data.photoIds,
  });
  if (error) {
    console.error("[task-cards] photo order update failed", { code: error.code });
    return fail(photoError(error.message));
  }
  if (data !== true) return fail("conflict");
  revalidateTaskViews();
  return ok(null);
}
