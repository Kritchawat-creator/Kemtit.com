import { describe, expect, it } from "vitest";

import {
  generateLinkCode,
  isLinkCodeExpired,
  linkCodeExpiry,
  maskLineUserId,
  normalizeLinkCode,
} from "./line";

describe("line link code", () => {
  it("สร้างรหัส 6 ตัวจากชุดตัวอักษรที่ไม่สับสน", () => {
    const code = generateLinkCode();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(generateLinkCode(() => new Uint8Array([0, 1, 2, 3, 4, 5]))).toBe("ABCDEF");
  });
  it("normalize ข้อความจากแชท", () => {
    expect(normalizeLinkCode(" ab-cd ef ")).toBe("ABCDEF");
    expect(normalizeLinkCode("สวัสดี")).toBeNull();
    expect(normalizeLinkCode("ABC")).toBeNull();
  });
  it("หมดอายุ 10 นาที", () => {
    const now = new Date("2026-09-05T00:00:00Z");
    const exp = linkCodeExpiry(now);
    expect(isLinkCodeExpired(exp, new Date("2026-09-05T00:09:59Z"))).toBe(false);
    expect(isLinkCodeExpired(exp, new Date("2026-09-05T00:10:00Z"))).toBe(true);
    expect(isLinkCodeExpired(null)).toBe(true);
  });
  it("mask userId", () => {
    expect(maskLineUserId("U1234567890abcdef")).toBe("U1234…cdef");
  });
});
