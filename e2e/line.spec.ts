import { createHmac } from "node:crypto";

import { expect, test } from "@playwright/test";

import { onboardNewUser } from "./helpers";

// ค่าเดียวกับ .env.local ของ Supabase local (dry-run: ไม่มี LINE token)
const LINE_SECRET = process.env.LINE_CHANNEL_SECRET ?? "local-dev-line-secret";
const CRON_SECRET = process.env.CRON_SECRET ?? "local-dev-cron-secret-change-me-0123456789";

function sign(body: string) {
  return createHmac("sha256", LINE_SECRET).update(body).digest("base64");
}

function yesterdayISO() {
  const d = new Date(Date.now() - 86_400_000 + 7 * 3_600_000); // Asia/Bangkok
  return d.toISOString().slice(0, 10);
}

test("เชื่อม LINE ด้วยรหัส 6 ตัวผ่าน webhook แล้ว cron สแกนงานค้าง → ส่ง push (dry-run)", async ({
  page,
}) => {
  await onboardNewUser(page, "line");

  await page.goto("/settings");
  await expect(page.getByText("ยังไม่ได้เชื่อม")).toBeVisible();
  await page.getByRole("button", { name: "เชื่อม LINE" }).click();
  const code = (await page.getByTestId("line-link-code").textContent())?.trim() ?? "";
  expect(code).toMatch(/^[A-Z0-9]{6}$/);

  // จำลอง LINE ส่ง webhook: signature ผิด → 401, ถูก → ผูกสำเร็จ
  const lineUserId = `Ue2e${Date.now()}`;
  const body = JSON.stringify({
    destination: "Uoa",
    events: [
      {
        type: "message",
        replyToken: "r1",
        source: { type: "user", userId: lineUserId },
        message: { type: "text", text: code.toLowerCase() },
      },
    ],
  });
  const bad = await page.request.post("/api/line/webhook", {
    headers: { "x-line-signature": "nope", "content-type": "application/json" },
    data: body,
  });
  expect(bad.status()).toBe(401);
  const ok = await page.request.post("/api/line/webhook", {
    headers: { "x-line-signature": sign(body), "content-type": "application/json" },
    data: body,
  });
  expect(ok.status()).toBe(200);
  expect(await ok.json()).toEqual({ handled: 1 });

  await expect(page.getByText("เชื่อมแล้ว")).toBeVisible({ timeout: 15_000 });

  // งานค้าง: สร้าง task ครบกำหนดเมื่อวาน
  await page.goto(`/dashboard?new=task&date=${yesterdayISO()}`);
  await page.getByLabel("ชื่องาน").fill("ส่งของค้างเมื่อวาน");
  await page.getByRole("button", { name: "บันทึกงาน" }).click();
  await expect(page.getByText("เพิ่มงานแล้ว")).toBeVisible();

  // cron: ไม่มี bearer → 401; มี → สแกนแล้วประมวลผล event → ส่ง (dry-run)
  const unauthorized = await page.request.post("/api/cron/scan-overdue");
  expect(unauthorized.status()).toBe(401);
  const scan = await page.request.post("/api/cron/scan-overdue", {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
  expect(scan.status()).toBe(200);
  const scanSummary = (await scan.json()) as { eventsCreated: number };
  expect(scanSummary.eventsCreated).toBeGreaterThanOrEqual(1);

  // processor ทำงานเป็น batch ≤ 20 (R4) — DB local มี event ค้างจาก test อื่น จึงวนเรียกจนคิวหมดเหมือน cron ที่วนทุก 5 นาที
  let sent = 0;
  for (let i = 0; i < 40; i++) {
    const processed = await page.request.post("/api/cron/process-events", {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(processed.status()).toBe(200);
    const summary = (await processed.json()) as {
      fetched: number;
      processed: number;
      sent: number;
      failed: number;
    };
    sent += summary.sent;
    if (summary.fetched === 0 || sent >= 1) break;
  }
  expect(sent).toBeGreaterThanOrEqual(1);

  // ยกเลิกการเชื่อม
  await page.goto("/settings");
  await page.getByRole("button", { name: "ยกเลิกการเชื่อม" }).click();
  await expect(page.getByText("ยังไม่ได้เชื่อม")).toBeVisible({ timeout: 10_000 });
});
