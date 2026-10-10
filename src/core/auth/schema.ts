import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "invalidEmail" }).max(254, { error: "invalidEmail" }));

const password = z.string().min(1, { error: "required" }).max(128, { error: "passwordTooLong" });
export const newPasswordSchema = z
  .string()
  .min(8, { error: "passwordTooShort" })
  .max(72, { error: "passwordTooLong" })
  .refine((value) => new TextEncoder().encode(value).length <= 72, {
    error: "passwordTooLong",
  });

/** Existing accounts may have a short valid password; the new-password rule applies only on setup. */
export const passwordSignInSchema = z.object({ email, password, next: z.string().optional() });
export type PasswordSignInInput = z.infer<typeof passwordSignInSchema>;

export const emailSchema = z.object({ email });
export type EmailInput = z.infer<typeof emailSchema>;

export const otpSchema = z.object({
  email,
  token: z.string().regex(/^\d{6}$/, { error: "otpFormat" }),
  next: z.string().optional(),
});
export type OtpInput = z.infer<typeof otpSchema>;

export const passwordSetupSchema = z
  .object({
    email,
    token: z.string().regex(/^\d{6}$/, { error: "otpFormat" }),
    password: newPasswordSchema,
    confirmPassword: z.string(),
    next: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    error: "passwordMismatch",
  });
export type PasswordSetupInput = z.infer<typeof passwordSetupSchema>;

export const resendChallengeSchema = z.object({
  email,
  purpose: z.enum(["login", "signup", "recovery"]),
});
export type ResendChallengeInput = z.infer<typeof resendChallengeSchema>;

export const googleSignInSchema = z.object({ next: z.string().optional() });
