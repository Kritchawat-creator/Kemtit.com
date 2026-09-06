import { createHmac } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import { latestOtpFor, uniqueEmail } from "../helpers";

/**
 * QA แบบสคริปต์บน localhost (ไม่ใช่ regression suite — ไม่รันใน CI): ไล่ทุก flow ถ่าย screenshot ทุกขั้น
 * รัน: pnpm e2e e2e/qa/localhost-qa.spec.ts --project=mobile-chrome --project=desktop-chrome
 * ผล: qa-screenshots/<project>/NN-step.png + qa-screenshots/report-<project>.md
 */
const LINE_SECRET = process.env.LINE_CHANNEL_SECRET ?? "local-dev-line-secret";
const CRON_SECRET = process.env.CRON_SECRET ?? "local-dev-cron-secret-change-me-0123456789";

type Finding = { step: string; status: "pass" | "fail" | "note"; detail?: string; shot?: string };

class QA {
  findings: Finding[] = [];
  consoleErrors: string[] = [];
  private n = 0;
  constructor(
    private page: Page,
    private dir: string,
  ) {
    mkdirSync(dir, { recursive: true });
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning")
        this.consoleErrors.push(`[${msg.type()}] ${msg.text().slice(0, 300)}`);
    });
    page.on("pageerror", (err) =>
      this.consoleErrors.push(`[pageerror] ${err.message.slice(0, 300)}`),
    );
  }
  async shot(name: string) {
    this.n += 1;
    const file = `${String(this.n).padStart(2, "0")}-${name}.png`;
    await this.page.screenshot({ path: `${this.dir}/${file}`, fullPage: true, caret: "initial" });
    return file;
  }
  async step(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      this.findings.push({ step: name, status: "pass", shot: await this.shot(name) });
    } catch (error) {
      const shot = await this.shot(`${name}-FAIL`).catch(() => undefined);
      this.findings.push({
        step: name,
        status: "fail",
        detail: String(error).split("\n").slice(0, 4).join(" "),
        shot,
      });
    }
  }
  note(step: string, detail: string) {
    this.findings.push({ step, status: "note", detail });
  }
  report(file: string) {
    const lines = this.findings.map(
      (f) =>
        `- [${f.status.toUpperCase()}] ${f.step}${f.detail ? ` — ${f.detail}` : ""}${f.shot ? ` (${f.shot})` : ""}`,
    );
    const consoleLines = this.consoleErrors.length
      ? `\n## Browser console (error/warning)\n\n${[...new Set(this.consoleErrors)].map((l) => `- ${l}`).join("\n")}\n`
      : "\n## Browser console: no errors/warnings\n";
    writeFileSync(file, `# QA report\n\n${lines.join("\n")}\n${consoleLines}`);
    console.log(
      `QA_SUMMARY pass=${this.findings.filter((f) => f.status === "pass").length} fail=${this.findings.filter((f) => f.status === "fail").length} notes=${this.findings.filter((f) => f.status === "note").length}`,
    );
  }
}

async function postAction(page: Page, fn: () => Promise<void>) {
  const done = page.waitForResponse((r) => r.request().method() === "POST");
  await fn();
  await done;
}

test.describe.configure({ mode: "serial", timeout: 300_000 });
test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

test("QA localhost (mobile)", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile only");
  const qa = new QA(page, "qa-screenshots/mobile");
  const email = uniqueEmail("qa");
  const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

  await qa.step("login-invalid-email", async () => {
    await page.goto("/login");
    await page.getByLabel("อีเมล").fill("not-an-email");
    await page.getByRole("button", { name: "ส่งรหัสยืนยัน" }).click();
    await expect(page.getByText("อีเมลไม่ถูกต้อง")).toBeVisible();
  });

  await qa.step("login-otp-sent", async () => {
    await page.getByLabel("อีเมล").fill(email);
    await page.getByRole("button", { name: "ส่งรหัสยืนยัน" }).click();
    await expect(page.getByRole("heading", { name: /ใส่รหัสที่ส่งไปที่/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /ส่งรหัสใหม่ได้ในอีก/ })).toBeDisabled();
  });

  await qa.step("login-wrong-otp", async () => {
    await page.getByLabel("รหัสยืนยัน 6 หลัก").fill("000000");
    await expect(page.getByText(/รหัสไม่ถูกต้อง/)).toBeVisible({ timeout: 15_000 });
  });

  let activeEmail = email;
  await qa.step("login-change-email-and-back", async () => {
    await page.getByRole("button", { name: "เปลี่ยนอีเมล" }).click();
    await expect(page.getByLabel("อีเมล")).toHaveValue(email);
    // ส่งซ้ำไปอีเมลเดิมภายใน 60 วิจะติด rate limit ของ Supabase (ตาม cooldown ในแอป) → ใช้อีเมลใหม่แทน
    activeEmail = uniqueEmail("qa2");
    await page.getByLabel("อีเมล").fill(activeEmail);
    await page.getByRole("button", { name: "ส่งรหัสยืนยัน" }).click();
    await expect(page.getByRole("heading", { name: /ใส่รหัสที่ส่งไปที่/ })).toBeVisible();
  });

  await qa.step("login-correct-otp", async () => {
    const code = await latestOtpFor(activeEmail);
    await page.getByLabel("รหัสยืนยัน 6 หลัก").fill(code);
    await expect(page).toHaveURL(/\/onboarding\/persona/, { timeout: 15_000 });
  });

  await qa.step("persona-page", async () => {
    await expect(page.getByText("เร็ว ๆ นี้", { exact: true })).toHaveCount(3);
    await expect(page.getByRole("radio", { name: /พ่อค้าแม่ค้า/ })).toBeChecked();
    await page.getByRole("button", { name: "ใช้แบบนี้" }).click();
    await expect(page).toHaveURL(/first-goal/);
  });

  await qa.step("first-goal-validation", async () => {
    if (!/first-goal/.test(page.url())) {
      await page.goto("/onboarding/persona");
      await page
        .getByRole("button", { name: "ใช้แบบนี้" })
        .click()
        .catch(() => {});
      await page.goto("/onboarding/first-goal");
    }
    await page.getByRole("button", { name: "เริ่มเลย" }).click();
    await expect(page.getByText(/มากกว่า 0/)).toBeVisible();
  });

  await qa.step("first-goal-create", async () => {
    await page.getByLabel("ยอดขายที่อยากได้").fill("40000");
    await page.getByRole("button", { name: "เริ่มเลย" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  });

  await qa.step("dashboard-initial", async () => {
    if (!/dashboard/.test(page.url())) await page.goto("/dashboard");
    const w = page.getByRole("region", { name: "เป้าหลักเดือนนี้" });
    await expect(w.getByText("0%")).toBeVisible();
    await expect(w.getByText(/40,000/)).toBeVisible();
    await expect(page.getByRole("region", { name: "งานวันนี้" })).toBeVisible();
  });

  await qa.step("dashboard-update-value-to-100", async () => {
    const w = page.getByRole("region", { name: "เป้าหลักเดือนนี้" });
    await w.getByRole("button", { name: "อัปเดตยอด" }).click();
    await page.getByLabel("ยอดตอนนี้").fill("40000");
    await postAction(page, () => page.getByRole("button", { name: "บันทึก", exact: true }).click());
    await expect(page.getByText(/ทำได้แล้ว/).first()).toBeVisible({ timeout: 15_000 });
    await expect(w.getByText("100%")).toBeVisible({ timeout: 15_000 });
    await expect(w.getByText("ครบเป้าแล้ว")).toBeVisible();
  });

  await qa.step("dashboard-quick-add-task-today", async () => {
    await page.goto(`/dashboard?new=task`);
    await page.getByRole("button", { name: "บันทึกงาน" }).click();
    await expect(page.getByText("ต้องกรอกช่องนี้")).toBeVisible();
    await page.getByLabel("ชื่องาน").fill("งาน QA วันนี้");
    await page.getByRole("button", { name: "บันทึกงาน" }).click();
    await expect(page.getByText("เพิ่มงานแล้ว")).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "งานวันนี้" })
        .getByRole("checkbox", { name: /งาน QA วันนี้/ }),
    ).toBeVisible();
  });

  await qa.step("goals-list-and-filters", async () => {
    await page.goto("/goals");
    await expect(page.getByRole("heading", { name: "เป้ารายเดือน" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "เป้ารายสัปดาห์" })).toBeVisible();
    await page.getByRole("link", { name: "ชีวิตส่วนตัว" }).click();
    await expect(page.getByText("ไม่มีเป้าหมายในกลุ่มนี้")).toBeVisible();
    await page.getByRole("link", { name: "ทั้งหมด" }).click();
  });

  await qa.step("goal-detail-completed-status", async () => {
    await page
      .getByRole("link", { name: /ยอดขาย/ })
      .first()
      .click();
    await expect(page.getByText("สำเร็จแล้ว")).toBeVisible();
    await expect(page.getByRole("heading", { name: "เป้าหมายย่อย" })).toBeVisible();
  });

  await qa.step("goal-edit-title", async () => {
    await page.getByRole("button", { name: "แก้ไข", exact: true }).click();
    await page.getByLabel("ชื่อเป้าหมาย").fill("ยอดขายเดือนนี้ (แก้แล้ว)");
    await postAction(page, () => page.getByRole("button", { name: "บันทึกการแก้ไข" }).click());
    await expect(page.getByText("แก้ไขเป้าหมายแล้ว")).toBeVisible();
    await expect(page.getByRole("heading", { name: /แก้แล้ว/ })).toBeVisible({ timeout: 15_000 });
  });

  await qa.step("goal-add-child-prefilled", async () => {
    await page.getByRole("link", { name: "เพิ่มเป้าย่อย" }).click();
    await expect(page.getByRole("heading", { name: "เพิ่มเป้าหมาย" })).toBeVisible();
    await expect(page.getByRole("combobox")).toContainText(/แก้แล้ว/);
    await page.getByLabel("ชื่อเป้าหมาย").fill("โปรโมชั่นสัปดาห์นี้");
    await postAction(page, () => page.getByRole("button", { name: "บันทึกเป้าหมาย" }).click());
    await expect(page.getByText("บันทึกเป้าหมายแล้ว")).toBeVisible();
    await expect(page.getByRole("link", { name: /โปรโมชั่นสัปดาห์นี้/ })).toBeVisible({
      timeout: 15_000,
    });
  });

  await qa.step("goal-archive-undo", async () => {
    const parentUrl = page.url();
    await page
      .getByRole("link", { name: /โปรโมชั่นสัปดาห์นี้/ })
      .first()
      .click();
    await expect(page).not.toHaveURL(parentUrl);
    await expect(page.getByRole("heading", { name: "โปรโมชั่นสัปดาห์นี้" })).toBeVisible();
    await page.getByRole("button", { name: "เก็บเข้ากรุ" }).click();
    await expect(page.getByText(/เก็บ “โปรโมชั่นสัปดาห์นี้” แล้ว/)).toBeVisible();
    await page.getByRole("button", { name: "เลิกทำ" }).click();
    await expect(page.getByText(/นำ “โปรโมชั่นสัปดาห์นี้” กลับมาแล้ว/)).toBeVisible();
    await expect(page.getByRole("button", { name: "เก็บเข้ากรุ" })).toBeVisible({
      timeout: 15_000,
    });
  });

  await qa.step("task-recurring-weekly-validation", async () => {
    await page.goto("/goals?new=task");
    await page.getByLabel("ชื่องาน").fill("โพสต์ขายของ");
    await page.locator('label[for="recurrence-weekly"]').click();
    await page.getByRole("button", { name: "บันทึกงาน" }).click();
    await expect(page.getByText("เลือกอย่างน้อย 1 วัน")).toBeVisible();
    await page.getByRole("button", { name: "จันทร์" }).click();
    await page.getByRole("button", { name: "พุธ" }).click();
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: /แก้แล้ว/ }).click();
    await page.getByRole("button", { name: "บันทึกงาน" }).click();
    await expect(page.getByText("เพิ่มงานแล้ว")).toBeVisible();
  });

  await qa.step("task-detail-reschedule-edit-delete-undo", async () => {
    await page.goto("/dashboard");
    const w = page.getByRole("region", { name: "งานวันนี้" });
    await w.getByRole("button", { name: /เปิดรายละเอียด งาน QA วันนี้/ }).click();
    await expect(page.getByRole("heading", { name: "งาน QA วันนี้" })).toBeVisible();
    await postAction(page, () => page.getByRole("button", { name: "พรุ่งนี้" }).click());
    await expect(page.getByText(/เลื่อนไป/)).toBeVisible();
    await expect(w.getByRole("checkbox", { name: /งาน QA วันนี้/ })).toHaveCount(0, {
      timeout: 15_000,
    });
    await page.goto(`/calendar?view=day&date=${today}`);
    // งานที่เลื่อนไปพรุ่งนี้ต้องไม่อยู่ในวันนี้
    await expect(page.getByRole("checkbox", { name: /งาน QA วันนี้/ })).toHaveCount(0);
    await page.getByRole("link", { name: "ถัดไป" }).click();
    const box = page.getByRole("checkbox", { name: /งาน QA วันนี้/ });
    await expect(box).toBeVisible();
    await page.getByRole("button", { name: /เปิดรายละเอียด งาน QA วันนี้/ }).click();
    await page.getByRole("button", { name: "แก้ไข", exact: true }).click();
    await page.getByLabel("ชื่องาน").fill("งาน QA (แก้ชื่อ)");
    await postAction(page, () => page.getByRole("button", { name: "บันทึกการแก้ไข" }).click());
    await expect(page.getByText("แก้ไขงานแล้ว")).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /งาน QA \(แก้ชื่อ\)/ })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: /เปิดรายละเอียด งาน QA \(แก้ชื่อ\)/ }).click();
    await page.getByRole("button", { name: "ลบงาน" }).click();
    await expect(page.getByText(/ลบ “งาน QA \(แก้ชื่อ\)” แล้ว/)).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /งาน QA \(แก้ชื่อ\)/ })).toHaveCount(0);
    await page.getByRole("button", { name: "เลิกทำ" }).click();
    await expect(page.getByRole("checkbox", { name: /งาน QA \(แก้ชื่อ\)/ })).toBeVisible();
  });

  await qa.step("calendar-week-month", async () => {
    await page.goto("/calendar");
    await expect(page.getByText("โพสต์ขายของ").first()).toBeVisible();
    await page.getByRole("link", { name: "เดือน" }).click();
    await expect(page.getByRole("link", { name: /งาน$/ }).first()).toBeVisible();
    await page.getByRole("link", { name: "ก่อนหน้า" }).click();
    await page.getByRole("link", { name: "วันนี้" }).click();
    await expect(page).toHaveURL(/view=month/);
  });

  await qa.step("settings-display-name-and-notify", async () => {
    await page.goto("/settings");
    await page.getByLabel("ชื่อที่แสดง").fill("ร้าน QA");
    await postAction(page, () => page.getByRole("button", { name: "บันทึกชื่อ" }).click());
    await expect(page.getByText("บันทึกชื่อแล้ว")).toBeVisible();
    await page.getByRole("switch", { name: "แจ้งงานเลยกำหนดทาง LINE" }).click();
    await expect(page.getByText("บันทึกการตั้งค่าแล้ว")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("switch", { name: "แจ้งงานเลยกำหนดทาง LINE" })).not.toBeChecked();
    await expect(page.getByLabel("ชื่อที่แสดง")).toHaveValue("ร้าน QA");
  });

  await qa.step("settings-line-link-via-webhook", async () => {
    await page.getByRole("button", { name: "เชื่อม LINE" }).click();
    const code = (await page.getByTestId("line-link-code").textContent())?.trim() ?? "";
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    const body = JSON.stringify({
      events: [
        {
          type: "message",
          replyToken: "r",
          source: { type: "user", userId: `Uqa${Date.now()}` },
          message: { type: "text", text: code },
        },
      ],
    });
    const res = await page.request.post("/api/line/webhook", {
      headers: {
        "x-line-signature": createHmac("sha256", LINE_SECRET).update(body).digest("base64"),
        "content-type": "application/json",
      },
      data: body,
    });
    expect(res.status()).toBe(200);
    await expect(page.getByText("เชื่อมแล้ว")).toBeVisible({ timeout: 15_000 });
  });

  await qa.step("cron-unauthorized-and-scan", async () => {
    expect((await page.request.post("/api/cron/scan-overdue")).status()).toBe(401);
    const scan = await page.request.post("/api/cron/scan-overdue", {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(scan.status()).toBe(200);
    qa.note("cron-scan-summary", await scan.text());
  });

  await qa.step("not-found-page", async () => {
    const res = await page.goto("/goals/00000000-0000-0000-0000-000000000000");
    await expect(page.getByRole("heading", { name: "ไม่พบหน้านี้" })).toBeVisible();
    qa.note("not-found-status", String(res?.status()));
  });

  await qa.step("manifest-and-icons", async () => {
    const m = await page.request.get("/manifest.webmanifest");
    expect(m.status()).toBe(200);
    const json = (await m.json()) as { name: string; icons: { src: string }[] };
    expect(json.name).toContain("เข็มทิศ");
    for (const icon of json.icons) expect((await page.request.get(icon.src)).status()).toBe(200);
  });

  await qa.step("sign-out-and-guard", async () => {
    await page.goto("/settings");
    await page.getByRole("button", { name: "ออกจากระบบ" }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  });

  qa.report("qa-screenshots/report-mobile.md");
});

test("QA localhost (desktop)", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop only");
  const qa = new QA(page, "qa-screenshots/desktop");
  const email = uniqueEmail("qa-desktop");

  await qa.step("desktop-login-and-onboarding", async () => {
    await page.goto("/login");
    await page.getByLabel("อีเมล").fill(email);
    await page.getByRole("button", { name: "ส่งรหัสยืนยัน" }).click();
    await page.getByLabel("รหัสยืนยัน 6 หลัก").fill(await latestOtpFor(email));
    await expect(page).toHaveURL(/persona/, { timeout: 15_000 });
    await page.getByRole("button", { name: "ใช้แบบนี้" }).click();
    await page.getByLabel("ยอดขายที่อยากได้").fill("60000");
    await page.getByRole("button", { name: "เริ่มเลย" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  });

  await qa.step("desktop-shell-sidebar-topbar", async () => {
    await expect(
      page.getByRole("navigation", { name: "เมนูหลัก" }).getByRole("link", { name: "เป้าหมาย" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "เพิ่ม", exact: true })).toBeVisible();
    await expect(page.getByText("พ่อค้าแม่ค้าออนไลน์")).toBeVisible();
  });

  await qa.step("desktop-goal-form-is-dialog", async () => {
    await page.getByRole("button", { name: "เพิ่ม", exact: true }).click();
    await page.getByRole("menuitem", { name: "เพิ่มเป้าหมาย" }).click();
    await expect(page.getByRole("dialog", { name: "เพิ่มเป้าหมาย" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  await qa.step("desktop-goals-grid-and-detail", async () => {
    await page.goto("/goals");
    await page
      .getByRole("link", { name: /ยอดขาย/ })
      .first()
      .click();
    await expect(page.getByRole("heading", { name: "เป้าหมายย่อย" })).toBeVisible();
    await expect(page.getByRole("button", { name: "อัปเดตยอด" })).toBeVisible();
  });

  await qa.step("desktop-calendar-week-7-columns", async () => {
    await page.goto("/calendar?view=week");
    await expect(page.locator("ol.grid > li")).toHaveCount(7);
  });

  await qa.step("desktop-user-menu-signout", async () => {
    await page.getByRole("button", { name: "เมนูผู้ใช้" }).click();
    await page.getByRole("menuitem", { name: "ออกจากระบบ" }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  qa.report("qa-screenshots/report-desktop.md");
});
