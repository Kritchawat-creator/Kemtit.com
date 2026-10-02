import { describe, expect, it } from "vitest";

import {
  isAvatarPath,
  isOwnPhotoPath,
  isTaskPhotoPath,
  photoMimeFromSignature,
  photoPathFor,
  signedUrlWindow,
} from "./storage";

const USER = "1b124945-a6ad-4553-8478-c994b3840260";
const TASK = "8f7d09e1-9c21-4143-9015-0f2deeb43823";
const FILE = "75e2bd47-2c20-49da-9c83-c28af8d16103";

describe("photo paths", () => {
  it("รูปแนบงานอยู่ที่ <user>/<task>/<file> และรูปโปรไฟล์ที่ <user>/avatar/<file>", () => {
    expect(photoPathFor("taskPhoto", USER, `${FILE}.jpg`, TASK)).toBe(
      `${USER}/${TASK}/${FILE}.jpg`,
    );
    expect(photoPathFor("avatar", USER, `${FILE}.jpg`)).toBe(`${USER}/avatar/${FILE}.jpg`);
    expect(() => photoPathFor("taskPhoto", USER, `${FILE}.jpg`)).toThrow();
    expect(() => photoPathFor("avatar", USER, "../unsafe.png")).toThrow();
  });

  it("ตรวจ path ตามโฟลเดอร์ user/task", () => {
    expect(isOwnPhotoPath(`${USER}/${TASK}/${FILE}.jpg`, USER)).toBe(true);
    expect(isOwnPhotoPath(`${USER}/../x/${FILE}.jpg`, USER)).toBe(false);
    expect(isOwnPhotoPath(`other/${TASK}/${FILE}.jpg`, USER)).toBe(false);
    expect(isTaskPhotoPath(`${USER}/${TASK}/${FILE}.jpg`, USER, TASK)).toBe(true);
    expect(isTaskPhotoPath(`${USER}/taskPhoto/${FILE}.jpg`, USER, TASK)).toBe(false);
    expect(isTaskPhotoPath(`${USER}/${TASK}/legacy.jpg`, USER, TASK)).toBe(false);
    expect(isTaskPhotoPath(`${USER}/${TASK}/${FILE}.jpg`, USER, "other")).toBe(false);
    expect(isAvatarPath(`${USER}/avatar/${FILE}.jpg`, USER)).toBe(true);
    expect(isAvatarPath(`${USER}/${TASK}/${FILE}.jpg`, USER)).toBe(false);
  });
});

describe("photoMimeFromSignature", () => {
  it("accepts JPEG, PNG, and WebP signatures and rejects unsupported bytes", () => {
    expect(photoMimeFromSignature(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]))).toBe("image/jpeg");
    expect(
      photoMimeFromSignature(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe("image/png");
    expect(
      photoMimeFromSignature(
        Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]),
      ),
    ).toBe("image/webp");
    expect(photoMimeFromSignature(new TextEncoder().encode("not an image"))).toBeNull();
  });
});

describe("signedUrlWindow", () => {
  it("exp เป็นชั่วโมงเต็ม และอายุอยู่ระหว่าง 1–2 ชม.", () => {
    const at = (h: number, m: number, s: number) => Date.UTC(2026, 8, 6, h, m, s);
    const a = signedUrlWindow(at(14, 37, 0));
    expect(a.expiresAt % 3600).toBe(0);
    expect(new Date(a.expiresAt * 1000).toISOString()).toBe("2026-09-06T16:00:00.000Z");
    expect(a.expiresIn).toBe(83 * 60);

    const late = signedUrlWindow(at(14, 59, 59));
    expect(late.expiresIn).toBe(3601);
    const top = signedUrlWindow(at(14, 0, 0));
    expect(top.expiresIn).toBe(7200);
  });

  it("ภายในชั่วโมงเดียวกันได้ key เดียวกัน ข้ามชั่วโมงได้ key ใหม่", () => {
    const at = (h: number, m: number) => Date.UTC(2026, 8, 6, h, m, 0);
    expect(signedUrlWindow(at(14, 1)).hour).toBe(signedUrlWindow(at(14, 58)).hour);
    expect(signedUrlWindow(at(14, 58)).hour + 1).toBe(signedUrlWindow(at(15, 0)).hour);
  });
});
