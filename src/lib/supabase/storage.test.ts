import { describe, expect, it } from "vitest";

import {
  isAvatarPath,
  isOwnPhotoPath,
  isTaskPhotoPath,
  photoPathFor,
  signedUrlWindow,
} from "./storage";

const USER = "1b124945-a6ad-4553-8478-c994b3840260";
const TASK = "8f7d09e1-9c21-4143-9015-0f2deeb43823";

describe("photo paths", () => {
  it("รูปแนบงานอยู่ที่ <user>/<task>/<file> และรูปโปรไฟล์ที่ <user>/avatar/<file>", () => {
    expect(photoPathFor("taskPhoto", USER, "a.jpg", TASK)).toBe(`${USER}/${TASK}/a.jpg`);
    expect(photoPathFor("avatar", USER, "a.jpg")).toBe(`${USER}/avatar/a.jpg`);
    expect(() => photoPathFor("taskPhoto", USER, "a.jpg")).toThrow();
  });

  it("ตรวจ path ตามโฟลเดอร์ user/task", () => {
    expect(isOwnPhotoPath(`${USER}/${TASK}/a.jpg`, USER)).toBe(true);
    expect(isOwnPhotoPath(`${USER}/../x/a.jpg`, USER)).toBe(false);
    expect(isOwnPhotoPath(`other/${TASK}/a.jpg`, USER)).toBe(false);
    expect(isTaskPhotoPath(`${USER}/${TASK}/a.jpg`, USER, TASK)).toBe(true);
    expect(isTaskPhotoPath(`${USER}/taskPhoto/a.jpg`, USER, TASK)).toBe(false);
    expect(isTaskPhotoPath(`${USER}/${TASK}/a.jpg`, USER, "other")).toBe(false);
    expect(isAvatarPath(`${USER}/avatar/a.jpg`, USER)).toBe(true);
    expect(isAvatarPath(`${USER}/${TASK}/a.jpg`, USER)).toBe(false);
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
