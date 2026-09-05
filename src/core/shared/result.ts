import type { z } from "zod";

/**
 * ผลลัพธ์มาตรฐานของ Server Action — UI แปล `error` เป็นข้อความผ่าน th.json (`errors.<key>`)
 * ห้ามส่งข้อความไทยกลับจาก action ตรง ๆ เพื่อให้ข้อความทั้งหมดอยู่ใน messages/th.json
 */
export type FieldErrors = Record<string, string[] | undefined>;

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string, fieldErrors?: FieldErrors): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/** แปล ZodError เป็น fieldErrors (key = ชื่อฟิลด์) */
export function zodFail(error: z.ZodError): ActionResult<never> {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fail("validation", fieldErrors);
}
