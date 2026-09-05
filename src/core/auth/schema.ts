import { z } from "zod";

/** ข้อความ error เป็น key ใน th.json (errors.*) */
export const requestOtpSchema = z.object({
  email: z.email({ error: "invalidEmail" }).trim().toLowerCase().max(254, { error: "invalidEmail" }),
});
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;

export const verifyOtpSchema = z.object({
  email: z.email({ error: "invalidEmail" }).trim().toLowerCase(),
  token: z.string().regex(/^\d{6}$/, { error: "otpFormat" }),
  next: z.string().optional(),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
