import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret } from "./secret-box.server";

describe("secret box", () => {
  it("round-trips server secrets", () => {
    const key = "test-key-that-is-at-least-thirty-two-characters";
    const encrypted = encryptSecret("refresh-token", key);
    expect(encrypted).not.toContain("refresh-token");
    expect(decryptSecret(encrypted, key)).toBe("refresh-token");
  });

  it("rejects a different key", () => {
    const encrypted = encryptSecret("refresh-token", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(() =>
      decryptSecret(encrypted, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"),
    ).toThrow();
  });
});
