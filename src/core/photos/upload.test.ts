import { beforeEach, describe, expect, it, vi } from "vitest";

import { attachPhoto } from "@/core/photos/actions";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { PHOTO_MAX_BYTES } from "@/lib/supabase/storage";

import { uploadPhotoFile } from "./upload";

vi.mock("@/lib/flags", () => ({ UPLOADS_ENABLED: true }));
vi.mock("@/lib/supabase/client", () => ({ createBrowserSupabase: vi.fn() }));
vi.mock("@/core/photos/actions", () => ({ attachPhoto: vi.fn() }));

const USER_ID = "1b124945-a6ad-4553-8478-c994b3840260";
const TASK_ID = "8f7d09e1-9c21-4143-9015-0f2deeb43823";
const PHOTO_ID = "75e2bd47-2c20-49da-9c83-c28af8d16103";
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBP_SIGNATURE = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];

const uploadObject = vi.fn();
const removeObject = vi.fn();
const getUser = vi.fn();

function supportedPngFile(bytes = PNG_SIGNATURE, type = "image/png") {
  return new File([Uint8Array.from(bytes)], "photo.png", { type });
}

function mockBitmap(width: number, height: number) {
  const bitmap = { width, height, close: vi.fn() } as unknown as ImageBitmap;
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
  return bitmap;
}

describe("uploadPhotoFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    uploadObject.mockResolvedValue({ data: { path: "uploaded" }, error: null });
    removeObject.mockResolvedValue({ data: [], error: null });
    vi.mocked(createBrowserSupabase).mockReturnValue({
      auth: { getUser },
      storage: {
        from: () => ({ upload: uploadObject, remove: removeObject }),
      },
    } as never);
    vi.mocked(attachPhoto).mockImplementation(async (input) => ({
      ok: true,
      data: { id: PHOTO_ID, path: (input as { path: string }).path },
    }));
  });

  it("rejects empty and MIME-spoofed files before upload", async () => {
    const empty = new File([], "empty.png", { type: "image/png" });
    const spoofed = supportedPngFile(PNG_SIGNATURE, "image/jpeg");

    expect(await uploadPhotoFile(empty, { kind: "avatar" })).toMatchObject({
      ok: false,
      error: "photoInvalid",
    });
    expect(await uploadPhotoFile(spoofed, { kind: "avatar" })).toMatchObject({
      ok: false,
      error: "photoInvalid",
    });
    expect(uploadObject).not.toHaveBeenCalled();
    expect(attachPhoto).not.toHaveBeenCalled();
  });

  it("rejects files beyond the upload byte limit", async () => {
    const oversized = new File([new Uint8Array(PHOTO_MAX_BYTES + 1)], "large.png", {
      type: "image/png",
    });

    expect(await uploadPhotoFile(oversized, { kind: "avatar" })).toMatchObject({
      ok: false,
      error: "photoTooLarge",
    });
    expect(uploadObject).not.toHaveBeenCalled();
  });

  it("rejects decoded images above the pixel bound", async () => {
    mockBitmap(5000, 5001);

    expect(await uploadPhotoFile(supportedPngFile(), { kind: "avatar" })).toMatchObject({
      ok: false,
      error: "photoDimensions",
    });
    expect(uploadObject).not.toHaveBeenCalled();
  });

  it("resizes large PNGs without converting them to an opaque JPEG", async () => {
    const bitmap = mockBitmap(3200, 1600);
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback, type) => {
      callback(new Blob([Uint8Array.from(PNG_SIGNATURE)], { type }));
    });

    const result = await uploadPhotoFile(supportedPngFile(), {
      kind: "taskPhoto",
      targetId: TASK_ID,
    });

    expect(result.ok).toBe(true);
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1600, 800);
    expect(uploadObject).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^${USER_ID}/${TASK_ID}/[0-9a-f-]+\\.png$`)),
      expect.any(Blob),
      { contentType: "image/png", upsert: false },
    );
    expect(attachPhoto).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "taskPhoto", targetId: TASK_ID }),
    );
    expect(bitmap.close).toHaveBeenCalledOnce();
  });

  it("removes an object after a definite attachment rejection", async () => {
    mockBitmap(1200, 800);
    vi.mocked(attachPhoto).mockResolvedValue({ ok: false, error: "photoLimit" });

    const result = await uploadPhotoFile(supportedPngFile(), { kind: "avatar" });
    const uploadedPath = uploadObject.mock.calls[0][0] as string;

    expect(result).toMatchObject({ ok: false, error: "photoLimit" });
    expect(removeObject).toHaveBeenCalledWith([uploadedPath]);
  });

  it("retains the object when the attachment response is ambiguous", async () => {
    mockBitmap(1200, 800);
    vi.mocked(attachPhoto).mockRejectedValue(new Error("transport unavailable"));

    expect(await uploadPhotoFile(supportedPngFile(), { kind: "avatar" })).toMatchObject({
      ok: false,
      error: "uploadUncertain",
    });
    expect(removeObject).not.toHaveBeenCalled();
  });

  it("retains the object after a resolved transport error from the attachment action", async () => {
    mockBitmap(1200, 800);
    vi.mocked(attachPhoto).mockResolvedValue({ ok: false, error: "uploadUncertain" });

    expect(await uploadPhotoFile(supportedPngFile(), { kind: "avatar" })).toMatchObject({
      ok: false,
      error: "uploadUncertain",
    });
    expect(removeObject).not.toHaveBeenCalled();
  });

  it("retains the object when an apparent success has malformed attachment data", async () => {
    mockBitmap(1200, 800);
    vi.mocked(attachPhoto).mockResolvedValue({
      ok: true,
      data: { id: "not-a-row-id", path: "different-object.png" },
    });

    expect(await uploadPhotoFile(supportedPngFile(), { kind: "avatar" })).toMatchObject({
      ok: false,
      error: "uploadUncertain",
    });
    expect(removeObject).not.toHaveBeenCalled();
  });

  it("uses WebP for a resized JPEG and keeps the output MIME and extension aligned", async () => {
    const jpegSignature = [0xff, 0xd8, 0xff, 0x00];
    const bitmap = mockBitmap(2000, 1000);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback, type) => {
      const signature = type === "image/webp" ? WEBP_SIGNATURE : PNG_SIGNATURE;
      callback(new Blob([Uint8Array.from(signature)], { type }));
    });

    const result = await uploadPhotoFile(supportedPngFile(jpegSignature, "image/jpeg"), {
      kind: "avatar",
    });

    expect(result.ok).toBe(true);
    expect(uploadObject).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^${USER_ID}/avatar/[0-9a-f-]+\\.webp$`)),
      expect.any(Blob),
      { contentType: "image/webp", upsert: false },
    );
    expect(bitmap.close).toHaveBeenCalledOnce();
  });
});
