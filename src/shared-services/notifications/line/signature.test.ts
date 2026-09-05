import { describe, expect, it } from "vitest";

import { signLineBody, verifyLineSignature } from "./signature";

describe("LINE signature", () => {
  const body = JSON.stringify({ events: [] });
  it("ยอมรับ signature ที่ถูกต้องเท่านั้น", () => {
    const sig = signLineBody(body, "secret");
    expect(verifyLineSignature(body, sig, "secret")).toBe(true);
    expect(verifyLineSignature(body, sig, "other")).toBe(false);
    expect(verifyLineSignature(body + " ", sig, "secret")).toBe(false);
    expect(verifyLineSignature(body, null, "secret")).toBe(false);
    expect(verifyLineSignature(body, "short", "secret")).toBe(false);
  });
});
