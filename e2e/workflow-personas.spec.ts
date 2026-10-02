import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { signInWithOtp, uniqueEmail } from "./helpers";

type Persona = {
  key: string;
  role: string;
  focus: string;
  goalDomain: "work" | "finance" | "growth";
};

const personas = {
  employee: {
    key: "employee",
    role: "พนักงาน",
    focus: "งาน",
    goalDomain: "work",
  },
  seller: {
    key: "seller",
    role: "ผู้ขาย / ร้านค้า",
    focus: "การเงิน",
    goalDomain: "finance",
  },
  student: {
    key: "student",
    role: "นักเรียน / นักศึกษา",
    focus: "การเรียน",
    goalDomain: "growth",
  },
  freelancer: {
    key: "freelancer",
    role: "ฟรีแลนซ์",
    focus: "งาน",
    goalDomain: "work",
  },
} satisfies Record<string, Persona>;

function currentDateBkk() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function currentMonthStart() {
  return `${currentDateBkk().slice(0, 7)}-01`;
}

function nextDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function onboardPersona(page: Page, persona: Persona) {
  await signInWithOtp(page, uniqueEmail(`workflow-${persona.key}`));

  await expect(page).toHaveURL(/\/onboarding\/persona/);
  await page.getByText(persona.role, { exact: true }).click();
  await page.getByRole("button", { name: "เลือกบทบาทนี้" }).click();

  await expect(page).toHaveURL(/\/onboarding\/focus/, { timeout: 15_000 });
  await page.getByText(persona.focus, { exact: true }).first().click();
  await page.getByRole("button", { name: "เตรียมพื้นที่เริ่มต้น" }).click();

  await expect(page).toHaveURL(/\/onboarding\/starter/, { timeout: 15_000 });
  await page.getByRole("button", { name: "ไปหน้าวันนี้" }).click();
  await expect(page).toHaveURL(/\/today/, { timeout: 20_000 });
}

async function createMonthlyGoal(page: Page, title: string, domain: Persona["goalDomain"]) {
  await page.goto(
    `/goals?new=goal&domain=${domain}&periodType=month&periodStart=${currentMonthStart()}`,
  );
  const dialog = page.getByRole("dialog", { name: "เพิ่มเป้าหมาย" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("ชื่อเป้าหมาย").fill(title);
  await dialog.getByRole("button", { name: "บันทึกเป้าหมาย" }).click();
  await expect(page.getByText("บันทึกเป้าหมายแล้ว")).toBeVisible();
  await expect(dialog).toHaveCount(0);

  await page.goto("/goals");
  const monthlyGoals = page.getByRole("region", { name: "เป้ารายเดือน" });
  const domainLabels = {
    work: "งาน",
    finance: "การเงิน",
    growth: "พัฒนาตัวเอง",
  } as const;
  const goalLink = monthlyGoals.getByRole("link", {
    name: new RegExp(escapeRegExp(title)),
  });
  await expect(goalLink).toBeVisible();
  await expect(goalLink.getByText(domainLabels[domain], { exact: true })).toBeVisible();
}

async function openQuickCapture(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole("navigation", { name: "เมนูหลัก" }).getByLabel("เปิดเมนูเพิ่ม").click();
  } else {
    await page.getByRole("banner").getByRole("button", { name: "เปิดเมนูเพิ่ม" }).click();
  }
  await expect(page.getByRole("dialog", { name: "บันทึกด่วน" })).toBeVisible();
}

async function capture(page: Page, isMobile: boolean, input: string, kind: string) {
  await openQuickCapture(page, isMobile);
  const dialog = page.getByRole("dialog", { name: "บันทึกด่วน" });
  await dialog.getByLabel("คุณอยากเพิ่มอะไร").fill(input);
  const preview = dialog.getByRole("region", {
    name: "ตัวอย่างจะอัปเดตตามข้อความที่พิมพ์",
  });
  await expect(
    preview
      .locator("span.rounded-full")
      .filter({ hasText: new RegExp(`^${escapeRegExp(kind)}$`) })
      .first(),
  ).toBeVisible();

  if (kind === "รายจ่าย") {
    await expect(dialog.getByLabel("จำนวนเงินที่จ่าย")).toHaveValue(/\d/);
  }

  await dialog.getByRole("button", { name: "ยืนยันและบันทึก" }).click();
  await expect(dialog).toHaveCount(0);
}

async function createTimedMeeting(page: Page, title: string) {
  const meetingDate = nextDate(currentDateBkk());
  await page.goto(`/calendar/events?date=${meetingDate}`);
  await page.getByRole("button", { name: "เพิ่มนัดหมาย" }).click();
  await page.getByLabel("บันทึกไว้ที่").selectOption("local");
  await page.getByLabel("ชื่อกิจกรรม").fill(title);
  await page.getByLabel("ทั้งวัน").uncheck();
  await page.getByLabel("เวลาเริ่ม").fill(`${meetingDate}T10:00`);
  await page.getByLabel("เวลาสิ้นสุด").fill(`${meetingDate}T10:30`);
  await page.getByRole("button", { name: "บันทึกนัดหมาย" }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  return meetingDate;
}

async function saveTodayPriorityAndSchedule(page: Page, title: string) {
  await page.goto("/today");
  const plan = page.getByRole("region", { name: "ตั้งค่าแผนวันนี้" });
  const priority = plan.getByRole("checkbox", { name: new RegExp(escapeRegExp(title)) });
  await expect(priority).toBeVisible();
  if (!(await priority.isChecked())) await priority.check();
  await plan.getByRole("button", { name: "บันทึกแผน" }).click();
  await expect(page.getByText("บันทึกแผนวันนี้แล้ว")).toBeVisible();

  await page.reload();
  const reloadedPlan = page.getByRole("region", { name: "ตั้งค่าแผนวันนี้" });
  await expect(
    reloadedPlan.getByRole("checkbox", { name: new RegExp(escapeRegExp(title)) }),
  ).toBeChecked();

  const schedule = page.getByRole("region", { name: "ตารางเวลาของวันนี้" }).first();
  await schedule.getByRole("button", { name: "จัดช่วงเวลา" }).click();
  await expect(page.getByText("จัดช่วงเวลาแล้ว")).toBeVisible();
  await expect(schedule.locator("ul").getByText(title, { exact: true })).toBeVisible();

  await page.goto("/calendar?view=day");
  await expect(page.getByText(title, { exact: true })).toBeVisible();
}

async function saveEvidence(page: Page, personaKey: string) {
  const projectName = test.info().project.name;
  const directory = join(process.cwd(), "test-results/workflow-personas", projectName);
  mkdirSync(directory, { recursive: true });
  await page.screenshot({
    path: join(directory, `${personaKey}.png`),
    fullPage: true,
    scale: "css",
  });
}

test("employee creates a monthly goal, meeting, note, and prioritized task", async ({
  page,
  isMobile,
}) => {
  await onboardPersona(page, personas.employee);
  const goal = "Close the monthly team report";
  await createMonthlyGoal(page, goal, personas.employee.goalDomain);

  const task = "ส่งรายงานทีมวันนี้";
  await capture(page, isMobile, task, "งาน");
  const meetingDate = await createTimedMeeting(page, "ประชุมทีมพรุ่งนี้");
  await capture(page, isMobile, "จดไว้โทรกลับฝ่ายบัญชี", "โน้ต");

  await page.goto("/inbox");
  await expect(page.getByRole("region", { name: "โน้ต" }).getByText("จดไว้โทรกลับฝ่ายบัญชี")).toBeVisible();
  await expect(page.locator("[data-task-id]").filter({ hasText: "จดไว้โทรกลับฝ่ายบัญชี" })).toHaveCount(0);

  await saveTodayPriorityAndSchedule(page, task);
  await saveEvidence(page, personas.employee.key);
  await page.reload();
  await expect(page.getByText(task, { exact: true })).toBeVisible();
  await page.goto(`/calendar?view=day&date=${meetingDate}`);
  await expect(page.getByText("ประชุมทีมพรุ่งนี้", { exact: true })).toBeVisible();
});

test("seller keeps task, bill, and decimal expense in their canonical views", async ({
  page,
  isMobile,
}) => {
  await onboardPersona(page, personas.seller);
  const goal = "Keep shop expenses organized this month";
  await createMonthlyGoal(page, goal, personas.seller.goalDomain);

  const task = "เตรียมสินค้าใหม่วันนี้";
  const bill = "ค่าอินเทอร์เน็ตวันนี้ 699.50 บาท";
  const expense = "ค่าอาหารวันนี้ 245.75 บาท";
  await capture(page, isMobile, task, "งาน");
  await capture(page, isMobile, bill, "บิล");
  await capture(page, isMobile, expense, "รายจ่าย");

  await page.goto("/finance");
  await expect(page.getByText(bill, { exact: true })).toBeVisible();
  await expect(page.getByText(expense, { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "สรุปการเงินเดือนนี้" })
      .getByText("฿245.75", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText(bill, { exact: true })).toBeVisible();
  await expect(page.getByText(expense, { exact: true })).toBeVisible();

  await saveTodayPriorityAndSchedule(page, task);
  await saveEvidence(page, personas.seller.key);
  await page.goto("/inbox");
  await expect(page.getByText(bill, { exact: true })).toHaveCount(0);
  await expect(page.locator("[data-task-id]").filter({ hasText: expense })).toHaveCount(0);
});

test("student keeps a daily study habit separate from the due task", async ({
  page,
  isMobile,
}) => {
  await onboardPersona(page, personas.student);
  const goal = "Build a steady study routine this month";
  await createMonthlyGoal(page, goal, personas.student.goalDomain);

  const habit = "อ่านหนังสือทุกวัน";
  const task = "ส่งรายงานวิชาชีวะวันนี้";
  await capture(page, isMobile, habit, "กิจวัตร");
  await capture(page, isMobile, task, "งาน");

  await page.goto("/life");
  await expect(page.getByText(habit, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(habit, { exact: true })).toBeVisible();
  await expect(page.locator("[data-task-id]").filter({ hasText: habit })).toHaveCount(0);

  await saveTodayPriorityAndSchedule(page, task);
  await saveEvidence(page, personas.student.key);
  await page.goto("/calendar?view=day");
  await expect(page.getByText(task, { exact: true })).toBeVisible();
  await expect(page.getByText(habit, { exact: true })).toHaveCount(0);
});

test("freelancer links a client task to a project and keeps travel expense separate", async ({
  page,
  isMobile,
}) => {
  await onboardPersona(page, personas.freelancer);
  const goal = "Deliver the client portfolio this month";
  await createMonthlyGoal(page, goal, personas.freelancer.goalDomain);

  const projectTitle = "Acme brand refresh";
  await page.goto("/work/projects");
  await page.getByLabel("ชื่อโปรเจกต์").fill(projectTitle);
  await page.getByLabel("รายละเอียด").fill("Brand direction and final handoff for the client.");
  await page.getByRole("button", { name: "สร้างโปรเจกต์" }).click();
  await expect(page.getByText("สร้างโปรเจกต์แล้ว")).toBeVisible();
  const projectLink = page.getByRole("link", { name: projectTitle, exact: true });
  await expect(projectLink).toBeVisible();
  const projectPath = await projectLink.getAttribute("href");
  expect(projectPath).toMatch(/^\/work\/projects\/[0-9a-f-]+$/i);

  const task = "ส่งแบบร่างให้ลูกค้าวันนี้";
  await page.goto(projectPath!);
  await page.getByRole("link", { name: "เพิ่มงาน", exact: true }).first().click();
  await expect(page).toHaveURL(/[?&]new=task(?:&|$)/);
  const taskDialog = page.getByRole("dialog", { name: "เพิ่มงาน" });
  await expect(taskDialog).toBeVisible();
  const projectSelector = taskDialog.getByRole("combobox", { name: "ผูกกับโปรเจกต์" });
  await expect(projectSelector).toBeVisible();
  await expect(projectSelector).toContainText(projectTitle);
  await taskDialog.getByLabel("ชื่องาน").fill(task);
  await taskDialog.getByRole("button", { name: "บันทึกงาน" }).click();
  await expect(page.getByText("เพิ่มงานแล้ว")).toBeVisible();
  await expect(taskDialog).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: `เปิดรายละเอียด ${task}` })).toBeVisible();

  const expense = "ค่าเดินทางวันนี้ 125.75 บาท";
  await capture(page, isMobile, expense, "รายจ่าย");
  await page.goto("/finance");
  await expect(page.getByText(expense, { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "สรุปการเงินเดือนนี้" })
      .getByText("฿125.75", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText(expense, { exact: true })).toBeVisible();

  await saveTodayPriorityAndSchedule(page, task);
  await saveEvidence(page, personas.freelancer.key);
  await page.goto("/work/projects");
  await expect(page.getByRole("link", { name: projectTitle, exact: true })).toBeVisible();
  await page.goto(projectPath!);
  await expect(page.getByRole("button", { name: `เปิดรายละเอียด ${task}` })).toBeVisible();
});
