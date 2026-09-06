import { afterEach, describe, expect, it, vi } from "vitest";

import { getClientEnv, shouldSkipEnvValidation } from "./env";

const validClientEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
};

function stubEnv(values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
}

describe("env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("คืนค่าที่ parse แล้วเมื่อครบและถูกต้อง", () => {
    stubEnv({ CI: "", SKIP_ENV_VALIDATION: "", ...validClientEnv });
    expect(getClientEnv().NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
  });

  it("throw พร้อมชื่อตัวแปรที่ขาด ไม่ใช่ค่า", () => {
    stubEnv({ CI: "", SKIP_ENV_VALIDATION: "", ...validClientEnv, NEXT_PUBLIC_SUPABASE_URL: "" });
    expect(() => getClientEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(() => getClientEnv()).not.toThrow(/anon-key/);
  });

  it("CI=true อย่างเดียวไม่ข้าม validation (Netlify ตั้ง CI=true และค่าอาจหลุดไป runtime)", () => {
    stubEnv({ CI: "true", SKIP_ENV_VALIDATION: "", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "" });
    expect(shouldSkipEnvValidation()).toBe(false);
    expect(() => getClientEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("ข้าม validation เฉพาะเมื่อ SKIP_ENV_VALIDATION=1 (POC Decisions M0 ข้อ 3)", () => {
    stubEnv({ CI: "", SKIP_ENV_VALIDATION: "1", NEXT_PUBLIC_SUPABASE_URL: "" });
    expect(() => getClientEnv()).not.toThrow();
  });
});
