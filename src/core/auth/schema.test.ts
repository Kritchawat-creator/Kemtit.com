import { describe, expect, it } from "vitest";

import { newPasswordSchema, passwordSetupSchema, passwordSignInSchema } from "./schema";

describe("password login schemas", () => {
  it("normalizes email before validation and preserves the exact password", () => {
    expect(
      passwordSignInSchema.parse({ email: "  MAY@EXAMPLE.COM  ", password: " x " }),
    ).toMatchObject({ email: "may@example.com", password: " x " });
  });

  it("allows short existing passwords but requires longer passwords for setup", () => {
    expect(
      passwordSignInSchema.safeParse({ email: "member@example.com", password: "old" }).success,
    ).toBe(true);
    expect(
      passwordSetupSchema.safeParse({
        email: "member@example.com",
        token: "123456",
        password: "short",
        confirmPassword: "short",
      }),
    ).toMatchObject({ success: false, error: { issues: [{ message: "passwordTooShort" }] } });
  });

  it("rejects mismatched new passwords and malformed OTPs", () => {
    const mismatch = passwordSetupSchema.safeParse({
      email: "member@example.com",
      token: "123456",
      password: "a-strong-password",
      confirmPassword: "a-different-password",
    });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) {
      expect(mismatch.error.issues.at(-1)).toMatchObject({
        path: ["confirmPassword"],
        message: "passwordMismatch",
      });
    }

    expect(
      passwordSetupSchema.safeParse({
        email: "member@example.com",
        token: "12345",
        password: "a-strong-password",
        confirmPassword: "a-strong-password",
      }).success,
    ).toBe(false);
  });

  it("matches the Auth provider's 72-byte setup limit for ASCII and Thai passwords", () => {
    expect(newPasswordSchema.safeParse("a".repeat(72)).success).toBe(true);
    expect(newPasswordSchema.safeParse("a".repeat(73)).success).toBe(false);
    expect(newPasswordSchema.safeParse("ก".repeat(24)).success).toBe(true);
    expect(newPasswordSchema.safeParse("ก".repeat(25)).success).toBe(false);
  });
});
