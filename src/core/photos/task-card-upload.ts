"use client";

import { fail, ok, type ActionResult } from "@/core/shared/result";
import { UPLOADS_ENABLED } from "@/lib/flags";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { PHOTO_BUCKET } from "@/lib/supabase/storage";

import {
  attachTaskCardPhotoReservation,
  markTaskCardPhotoFailure,
  reserveTaskCardPhoto,
  type TaskCardPhotoReservation,
} from "./task-card-actions";
import { preparePhoto } from "./upload";

export type PreparedTaskCardPhotoUpload = {
  taskId: string;
  operationId: string;
  path: string;
  sortOrder: number;
  blob: Blob;
  reservationStatus: TaskCardPhotoReservation["status"];
};

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(file: File) {
  return toHex(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()));
}

/** Validate and reserve the permanent photo slot before any Storage upload starts. */
export async function prepareAndReserveTaskCardPhoto(
  file: File,
  taskId: string,
  operationId: string = crypto.randomUUID(),
): Promise<ActionResult<PreparedTaskCardPhotoUpload>> {
  if (!UPLOADS_ENABLED) return fail("featureDisabled");
  if (!(file instanceof File) || !taskId || !operationId) return fail("validation");

  const prepared = await preparePhoto(file);
  if (!prepared.ok) return fail(prepared.error);

  let contentSha256: string;
  try {
    contentSha256 = await sha256(file);
  } catch {
    return fail("photoInvalid");
  }

  let reservationResult: Awaited<ReturnType<typeof reserveTaskCardPhoto>>;
  try {
    reservationResult = await reserveTaskCardPhoto({
      taskId,
      operationId,
      mimeType: prepared.blob.type,
      contentSha256,
    });
  } catch {
    return fail("uploadUncertain");
  }
  if (!reservationResult?.ok) return reservationResult ?? fail("uploadUncertain");

  return ok({
    taskId,
    operationId,
    path: reservationResult.data.path,
    sortOrder: reservationResult.data.sort_order,
    blob: prepared.blob,
    reservationStatus: reservationResult.data.status,
  });
}

/** Upload and attach against the durable reservation; retries reuse its path and order. */
export async function uploadReservedTaskCardPhoto(
  prepared: PreparedTaskCardPhotoUpload,
): Promise<ActionResult<{ id: string; path: string; sortOrder: number }>> {
  if (!UPLOADS_ENABLED) return fail("featureDisabled");
  if (!prepared?.taskId || !prepared.operationId || !prepared.path || !prepared.blob) {
    return fail("validation");
  }

  let uploadFailed = false;
  try {
    const supabase = createBrowserSupabase();
    if (prepared.reservationStatus !== "attached") {
      const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(prepared.path, prepared.blob, {
        contentType: prepared.blob.type,
        upsert: false,
      });
      uploadFailed = Boolean(error);
      if (error) {
        console.error("[task-cards] reserved photo upload failed", {
          status: error.status,
          statusCode: error.statusCode,
        });
      }
    }
  } catch {
    uploadFailed = true;
  }

  let attached: Awaited<ReturnType<typeof attachTaskCardPhotoReservation>>;
  try {
    attached = await attachTaskCardPhotoReservation({
      taskId: prepared.taskId,
      operationId: prepared.operationId,
      path: prepared.path,
    });
  } catch {
    attached = fail("uploadUncertain");
  }
  if (attached?.ok) {
    return ok({ id: attached.data.id, path: prepared.path, sortOrder: attached.data.sortOrder });
  }

  if (attached?.error === "photoReservationCancelled") {
    try {
      const supabase = createBrowserSupabase();
      const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([prepared.path]);
      if (error) {
        console.error("[task-cards] cancelled photo cleanup failed", {
          status: error.status,
          statusCode: error.statusCode,
        });
      }
    } catch {
      // A late upload may remain as an unreferenced private object if Storage cleanup fails.
    }
    return fail("photoReservationCancelled");
  }

  const failureCode = uploadFailed && attached?.error === "uploadUncertain" ? "upload_unknown" : "upload_failed";
  try {
    await markTaskCardPhotoFailure({
      taskId: prepared.taskId,
      operationId: prepared.operationId,
      failureCode,
    });
  } catch {
    // The reservation remains durable and can be inspected or retried on the next visit.
  }
  return attached ?? fail("uploadUncertain");
}
