import { expect, type Page } from "@playwright/test";

/** Mailpit ของ Supabase local (pnpm exec supabase start) — อ่านรหัส OTP จากอีเมลล่าสุดของ address นั้น */
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

export function uniqueEmail(prefix = "e2e") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@kemtit.test`;
}

export async function latestOtpFor(email: string, attempts = 30): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const search = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    if (search.ok) {
      const data = (await search.json()) as { messages?: { ID: string }[] };
      const first = data.messages?.[0];
      if (first) {
        const detail = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${first.ID}`)).json()) as {
          Text?: string;
          HTML?: string;
        };
        const match = `${detail.Text ?? ""}\n${detail.HTML ?? ""}`.match(/\b(\d{6})\b/);
        if (match) return match[1];
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`ไม่พบรหัส OTP สำหรับ ${email} ใน Mailpit (${MAILPIT_URL})`);
}

/** ขั้น 1 ของ onboarding: อีเมล → OTP → ออกจากหน้า login */
export async function signInWithOtp(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByRole("button", { name: "ส่งรหัสยืนยัน" }).click();
  await expect(page.getByRole("heading", { name: /ใส่รหัสที่ส่งไปที่/ })).toBeVisible();
  const code = await latestOtpFor(email);
  await page.getByLabel("รหัสยืนยัน 6 หลัก").fill(code);
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}
