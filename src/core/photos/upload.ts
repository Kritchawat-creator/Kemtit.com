"use client";

import { attachPhoto } from "@/core/photos/actions";
import type { Photo } from "@/core/photos/schema";
import { fail, ok, type ActionResult } from "@/core/shared/result";
import { UPLOADS_ENABLED } from "@/lib/flags";
import { createBrowserSupabase } from "@/lib/supabase/client";
import {
  isAllowedPhotoType,
  isOwnPhotoPath,
  PHOTO_BUCKET,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_EDGE,
  PHOTO_MAX_PIXELS,
  photoMimeFromSignature,
  photoPathFor,
} from "@/lib/supabase/storage";

/** A task attachment always names its task; avatars never accept a task identifier. */
export type PhotoTarget = { kind: "avatar" } | { kind: "taskPhoto"; targetId: string };
const DEFINITE_ATTACH_FAILURES = new Set([
  "featureDisabled",
  "validation",
  "unauthorized",
  "notFound",
  "photoLimit",
  "photoInvalid",
  "uploadFailed",
]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PreparedPhoto = { ok: true; blob: Blob } | { ok: false; error: string };

function extensionOf(type: string): "jpg" | "png" | "webp" {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, 0.9));
}

async function encodeResizedPhoto(canvas: HTMLCanvasElement, sourceType: string) {
  const preferredType = sourceType === "image/png" ? "image/png" : "image/webp";
  const preferred = await toBlob(canvas, preferredType);
  if (preferred && preferred.type === preferredType) return preferred;

  if (preferredType !== "image/png") {
    const png = await toBlob(canvas, "image/png");
    if (png?.type === "image/png") return png;
  }
  return null;
}

async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (!isAllowedPhotoType(file.type)) return { ok: false, error: "photoType" };
  if (file.size <= 0) return { ok: false, error: "photoInvalid" };
  if (file.size > PHOTO_MAX_BYTES) return { ok: false, error: "photoTooLarge" };

  let signature: Uint8Array;
  try {
    signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  } catch {
    return { ok: false, error: "photoInvalid" };
  }
  if (photoMimeFromSignature(signature) !== file.type) {
    return { ok: false, error: "photoInvalid" };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { ok: false, error: "photoInvalid" };
  }

  try {
    if (
      !Number.isSafeInteger(bitmap.width) ||
      !Number.isSafeInteger(bitmap.height) ||
      bitmap.width <= 0 ||
      bitmap.height <= 0
    ) {
      return { ok: false, error: "photoInvalid" };
    }
    if (bitmap.width * bitmap.height > PHOTO_MAX_PIXELS) {
      return { ok: false, error: "photoDimensions" };
    }

    const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1) return { ok: true, blob: file };

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return { ok: false, error: "photoInvalid" };
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    let resized: Blob | null;
    try {
      resized = await encodeResizedPhoto(canvas, file.type);
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
    if (!resized || !isAllowedPhotoType(resized.type) || resized.size <= 0) {
      return { ok: false, error: "photoInvalid" };
    }
    if (resized.size > PHOTO_MAX_BYTES) return { ok: false, error: "photoTooLarge" };

    const resizedSignature = new Uint8Array(await resized.slice(0, 12).arrayBuffer());
    if (photoMimeFromSignature(resizedSignature) !== resized.type) {
      return { ok: false, error: "photoInvalid" };
    }
    return { ok: true, blob: resized };
  } catch {
    return { ok: false, error: "photoInvalid" };
  } finally {
    bitmap.close();
  }
}

async function removeUnattachedObject(
  supabase: ReturnType<typeof createBrowserSupabase>,
  path: string,
  userId: string,
) {
  if (!isOwnPhotoPath(path, userId)) return;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([path]);
  if (error) {
    console.error("[photos] cleanup failed", {
      status: error.status,
      statusCode: error.statusCode,
    });
  }
}

/** Validate, resize, upload, and attach an image for task-photo and avatar consumers. */
export async function uploadPhotoFile(
  file: File,
  target: PhotoTarget,
): Promise<ActionResult<Photo>> {
  if (!UPLOADS_ENABLED) return fail("featureDisabled");
  if (
    !file ||
    !target ||
    typeof target !== "object" ||
    (target.kind === "taskPhoto" && !target.targetId) ||
    (target.kind !== "taskPhoto" && target.kind !== "avatar")
  ) {
    return fail("validation");
  }

  const prepared = await preparePhoto(file);
  if (!prepared.ok) return fail(prepared.error);

  let supabase: ReturnType<typeof createBrowserSupabase>;
  try {
    supabase = createBrowserSupabase();
  } catch {
    return fail("generic");
  }

  let user: { id: string } | null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) return fail("generic");
    user = data.user;
  } catch {
    return fail("generic");
  }
  if (!user) return fail("unauthorized");

  let path: string;
  try {
    path = photoPathFor(
      target.kind,
      user.id,
      `${crypto.randomUUID()}.${extensionOf(prepared.blob.type)}`,
      target.kind === "taskPhoto" ? target.targetId : undefined,
    );
  } catch {
    return fail("validation");
  }

  try {
    const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, prepared.blob, {
      contentType: prepared.blob.type,
      upsert: false,
    });
    if (error) {
      console.error("[photos] upload failed", {
        status: error.status,
        statusCode: error.statusCode,
      });
      return fail("uploadFailed");
    }
  } catch {
    // Storage may have accepted the bytes before the response was lost. Leave it in the user's
    // folder; never guess and delete a path after a transport-level failure.
    console.error("[photos] upload response unknown");
    return fail("uploadUncertain");
  }

  let result: ActionResult<Photo>;
  try {
    result = await attachPhoto({
      kind: target.kind,
      targetId: target.kind === "taskPhoto" ? target.targetId : undefined,
      path,
    });
  } catch {
    // The database may have committed even though the Server Action response did not arrive.
    console.error("[photos] attach response unknown");
    return fail("uploadUncertain");
  }

  if (!result || typeof result !== "object" || typeof result.ok !== "boolean") {
    console.error("[photos] attach response invalid");
    return fail("uploadUncertain");
  }
  if (!result.ok) {
    if (DEFINITE_ATTACH_FAILURES.has(result.error)) {
      await removeUnattachedObject(supabase, path, user.id);
      return result;
    }
    console.error("[photos] attach outcome unknown", { reason: result.error });
    return fail("uploadUncertain");
  }
  if (
    !result.data ||
    typeof result.data.id !== "string" ||
    !UUID_RE.test(result.data.id) ||
    result.data.path !== path
  ) {
    console.error("[photos] attach response invalid");
    return fail("uploadUncertain");
  }
  return ok(result.data);
}
