import { createBrowserClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { signInAndApproveFixtureSession } from "@/integration/support/auth";
import { addDaysISO, startOfWeekISO } from "@/lib/date";
import type { Database } from "@/types/database";

type DbClient = SupabaseClient<Database>;
type Locale = "th" | "en";
type Viewport = { width: number; height: number };
type Fixture = {
  admin: DbClient;
  id: string;
  email: string;
  token: string;
  goalId: string;
  goalTitle: string;
  projectId: string;
  releaseId: string;
  rescueTaskId: string;
  planningTaskId: string;
  planningTaskTitle: string;
  habitId: string;
  habitTitle: string;
  rescueTaskTitle: string;
};
type InventoryControl = {
  tag: string;
  role: string | null;
  label: string;
  type: string | null;
  href: string | null;
  disabled: boolean;
  visible: boolean;
};
type InventoryRow = {
  route: string;
  expectedPath: string;
  locale: Locale;
  viewport: number;
  finalPath: string;
  status: number | null;
  scrollWidth: number;
  viewportWidth: number;
  controls: InventoryControl[];
  pageErrors: string[];
};
type ExercisedControl = {
  locale: Locale;
  viewport?: number;
  route: string;
  control: string;
  result: string;
};

type InteractionCopy = {
  common: { menu: string; undo: string; signOut: string };
  nav: {
    notifications: string;
    collapse: string;
    expand: string;
    expandItem: (item: string) => string;
    collapseItem: (item: string) => string;
    workspace: string;
    plan: string;
    calendar: string;
    routine: string;
    insights: string;
    tasks: string;
  };
  a11y: {
    mainNav: string;
    userMenu: string;
    openTask: (title: string) => string;
  };
  finance: {
    budgetLabel: string;
    saveBudget: string;
    budgetSaved: string;
  };
  tasks: {
    searchLabel: string;
    viewLabel: string;
    searchButton: string;
    active: string;
    all: string;
    done: string;
    archive: string;
    archived: (title: string) => string;
    restored: (title: string) => string;
  };
  goals: {
    editDialog: string;
    editButton: string;
    archive: string;
    titleLabel: string;
    saveChanges: string;
    archived: (title: string) => string;
    restored: (title: string) => string;
  };
  projects: {
    titleLabel: string;
    descriptionLabel: string;
    save: string;
    archive: string;
    archived: string;
    updated: string;
  };
  reviews: {
    carryoverTitle: string;
    carryoverAction: string;
    carryoverSaved: (count: number) => string;
  };
  settings: {
    profileName: string;
    saveName: string;
    nameSaved: string;
    languageGroup: string;
    thai: string;
    english: string;
    languageHeading: string;
    previewThai: string;
    previewEnglish: string;
    calendarNotice: string;
    googleCalendar: string;
    outlookCalendar: string;
    connectGoogle: string;
    connectOutlook: string;
    connectLine: string;
    providerUnavailable: (provider: string) => string;
    lineTitle: string;
    lineAccountUnavailable: string;
    lineDryRunHint: string;
    signOut: string;
  };
  notifications: { lineNotLinked: string };
  archive: {
    tasks: string;
    projects: string;
    goals: string;
    restore: string;
    restored: (title: string) => string;
  };
  habits: {
    toggle: (title: string) => string;
    completed: string;
    uncompleted: string;
  };
};

const interactionCopy: Record<Locale, InteractionCopy> = {
  en: {
    common: { menu: "Menu", undo: "Undo", signOut: "Sign out" },
    nav: {
      notifications: "Notifications",
      collapse: "Collapse menu",
      expand: "Expand menu",
      expandItem: (item) => `Expand ${item}`,
      collapseItem: (item) => `Collapse ${item}`,
      workspace: "Workspace",
      plan: "Plan",
      calendar: "Calendar",
      routine: "Routine",
      insights: "Insights",
      tasks: "Tasks",
    },
    a11y: {
      mainNav: "Main navigation",
      userMenu: "User menu",
      openTask: (title) => `Open details for ${title}`,
    },
    finance: {
      budgetLabel: "Monthly budget",
      saveBudget: "Save budget",
      budgetSaved: "Budget saved",
    },
    tasks: {
      searchLabel: "Search by task title",
      viewLabel: "Show tasks",
      searchButton: "Search",
      active: "Active",
      all: "All",
      done: "Done",
      archive: "Archive task",
      archived: (title) => `Archived “${title}”`,
      restored: (title) => `Restored “${title}”`,
    },
    goals: {
      editDialog: "Edit goal",
      editButton: "Edit",
      archive: "Archive",
      titleLabel: "Goal name",
      saveChanges: "Save changes",
      archived: (title) => `Archived “${title}”`,
      restored: (title) => `Restored “${title}”`,
    },
    projects: {
      titleLabel: "Project name",
      descriptionLabel: "Description",
      save: "Save project",
      archive: "Archive",
      archived: "Project archived",
      updated: "Project saved",
    },
    reviews: {
      carryoverTitle: "Carry unfinished tasks into next week",
      carryoverAction: "Carry selected tasks forward",
      carryoverSaved: (count) => `Carried ${count} tasks into next week`,
    },
    settings: {
      profileName: "Display name",
      saveName: "Save name",
      nameSaved: "Name saved",
      languageGroup: "Language",
      thai: "Thai",
      english: "English",
      languageHeading: "Language & Region",
      previewThai: "26 September 2569 B.E.",
      previewEnglish: "26 September 2026",
      calendarNotice: "This calendar provider is unavailable in this environment.",
      googleCalendar: "Google Calendar",
      outlookCalendar: "Outlook Calendar",
      connectGoogle: "Connect and sync Google Calendar",
      connectOutlook: "Connect and sync Outlook Calendar",
      connectLine: "Connect LINE",
      providerUnavailable: (provider) =>
        `${provider} can’t be connected because this environment isn’t configured for it.`,
      lineTitle: "LINE notifications",
      lineAccountUnavailable:
        "The LINE official account is not ready yet. Contact the administrator.",
      lineDryRunHint: "LINE messaging is not connected yet, so messages cannot be sent.",
      signOut: "Sign out",
    },
    notifications: { lineNotLinked: "Connect LINE and choose which reminders to receive." },
    archive: {
      tasks: "Tasks",
      projects: "Projects",
      goals: "Goals",
      restore: "Restore",
      restored: (title) => `Restored “${title}”`,
    },
    habits: {
      toggle: (title) => `Toggle ${title}`,
      completed: "Habit marked complete",
      uncompleted: "Habit marked incomplete",
    },
  },
  th: {
    common: { menu: "เมนู", undo: "เลิกทำ", signOut: "ออกจากระบบ" },
    nav: {
      notifications: "การแจ้งเตือน",
      collapse: "พับเมนู",
      expand: "ขยายเมนู",
      expandItem: (item) => `ขยายเมนู${item}`,
      collapseItem: (item) => `ยุบเมนู${item}`,
      workspace: "พื้นที่ทำงาน",
      plan: "แผน",
      calendar: "ปฏิทิน",
      routine: "กิจวัตร",
      insights: "วิเคราะห์",
      tasks: "งาน",
    },
    a11y: {
      mainNav: "เมนูหลัก",
      userMenu: "เมนูผู้ใช้",
      openTask: (title) => `เปิดรายละเอียด ${title}`,
    },
    finance: {
      budgetLabel: "งบประมาณเดือนนี้",
      saveBudget: "บันทึกงบประมาณ",
      budgetSaved: "บันทึกงบประมาณแล้ว",
    },
    tasks: {
      searchLabel: "ค้นหาจากชื่องาน",
      viewLabel: "แสดงงาน",
      searchButton: "ค้นหา",
      active: "กำลังทำ",
      all: "ทั้งหมด",
      done: "เสร็จแล้ว",
      archive: "เก็บงานในคลัง",
      archived: (title) => `เก็บ “${title}” ไว้ในคลังแล้ว`,
      restored: (title) => `นำ “${title}” กลับมาแล้ว`,
    },
    goals: {
      editDialog: "แก้ไขเป้าหมาย",
      editButton: "แก้ไข",
      archive: "เก็บในคลัง",
      titleLabel: "ชื่อเป้าหมาย",
      saveChanges: "บันทึกการแก้ไข",
      archived: (title) => `เก็บ “${title}” แล้ว`,
      restored: (title) => `นำ “${title}” กลับมาแล้ว`,
    },
    projects: {
      titleLabel: "ชื่อโปรเจกต์",
      descriptionLabel: "รายละเอียด",
      save: "บันทึกโปรเจกต์",
      archive: "เก็บในคลัง",
      archived: "เก็บโปรเจกต์ในคลังแล้ว",
      updated: "บันทึกโปรเจกต์แล้ว",
    },
    reviews: {
      carryoverTitle: "เลือกงานค้างไปสัปดาห์หน้า",
      carryoverAction: "นำงานที่เลือกไปสัปดาห์หน้า",
      carryoverSaved: (count) => `นำงาน ${count} รายการไปสัปดาห์หน้าแล้ว`,
    },
    settings: {
      profileName: "ชื่อที่แสดง",
      saveName: "บันทึกชื่อ",
      nameSaved: "บันทึกชื่อแล้ว",
      languageGroup: "ภาษา",
      thai: "ไทย",
      english: "อังกฤษ",
      languageHeading: "ภาษาและภูมิภาค",
      previewThai: "26 กันยายน 2569",
      previewEnglish: "26 September 2026",
      calendarNotice: "ผู้ให้บริการปฏิทินนี้ยังใช้ไม่ได้ในสภาพแวดล้อมนี้",
      googleCalendar: "Google Calendar",
      outlookCalendar: "Outlook Calendar",
      connectGoogle: "เชื่อมและซิงก์ Google Calendar",
      connectOutlook: "เชื่อมและซิงก์ Outlook Calendar",
      connectLine: "เชื่อม LINE",
      providerUnavailable: (provider) =>
        `ยังเชื่อม ${provider} ไม่ได้ เพราะสภาพแวดล้อมนี้ยังไม่ได้ตั้งค่าผู้ให้บริการปฏิทิน`,
      lineTitle: "แจ้งเตือนผ่าน LINE",
      lineAccountUnavailable: "บัญชีทางการ LINE ของเข็มทิศยังไม่พร้อมใช้งาน โปรดติดต่อผู้ดูแลระบบ",
      lineDryRunHint: "การเชื่อมต่อ LINE ยังไม่พร้อม จึงยังส่งข้อความไปยัง LINE ไม่ได้",
      signOut: "ออกจากระบบ",
    },
    notifications: { lineNotLinked: "เชื่อม LINE แล้วเลือกการแจ้งเตือนที่ต้องการรับ" },
    archive: {
      tasks: "งาน",
      projects: "โปรเจกต์",
      goals: "เป้าหมาย",
      restore: "กู้คืน",
      restored: (title) => `กู้คืน “${title}” แล้ว`,
    },
    habits: {
      toggle: (title) => `ทำเครื่องหมาย ${title}`,
      completed: "ทำกิจวัตรแล้ว",
      uncompleted: "เปลี่ยนกิจวัตรเป็นยังไม่ได้ทำแล้ว",
    },
  },
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const reportDirectory = resolve(process.cwd(), "docs/qa/full-system-2026-10-08");
const fixturePassword = "Kemtit-full-system-qa-Local-Only-1!";
const localHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const viewports: Viewport[] = [
  { width: 1440, height: 960 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
];

const appRoutes = [
  "/today",
  "/dashboard",
  "/calendar",
  "/calendar/events",
  "/inbox",
  "/entries",
  "/finance",
  "/goals",
  "/insights",
  "/life",
  "/more",
  "/plan",
  "/rescue",
  "/reviews",
  "/archive",
  "/settings",
  "/tasks",
  "/updates",
  "/work/projects",
  "/work/sales",
] as const;

const localized = {
  en: {
    common: { save: "Save", edit: "Edit", cancel: "Cancel", close: "Close" },
    settings: {
      contextSaved: "Context saved",
      workStart: "Work starts",
      workEnd: "Work ends",
      breakStart: "Break starts (optional)",
      breakEnd: "Break ends (optional)",
      saveWorkingHours: "Save working hours",
      workingHoursSaved: "Working hours saved",
    },
    inbox: {
      addNote: "Add note",
      notePlaceholder: "Type something to remember…",
      noteActions: (title: string) => `Actions for ${title}`,
      archiveNote: "Archive note",
    },
    archive: { restore: "Restore" },
    events: {
      new: "Add event",
      destination: "Save to",
      title: "Event name",
      edit: "Edit event",
      delete: "Delete event",
      deleteConfirmTitle: "Delete calendar event?",
      deleteConfirm: "Delete permanently",
      save: "Save event",
    },
    finance: {
      billTitle: "Bill name",
      billAmount: "Bill amount",
      addBill: "Add bill",
      markPaid: "Mark paid",
      paid: "Paid",
      billPaidToast: "Bill payment saved",
    },
    planner: { viewLabel: "Plan view", month: "Month", week: "Week" },
    planning: {
      timeBlockTitle: "Time block title",
      noLinkedTask: "No linked task",
      starts: "Starts",
      ends: "Ends",
      schedule: "Schedule",
      saved: "Time block scheduled",
      updated: "Time block updated",
      cancelled: "Time block cancelled",
      edit: "Edit time",
      cancel: "Cancel",
    },
    rescue: { confirm: "Confirm this plan", undo: "Undo replanning" },
  },
  th: {
    common: { save: "บันทึก", edit: "แก้ไข", cancel: "ยกเลิก", close: "ปิด" },
    settings: {
      contextSaved: "บันทึกบริบทแล้ว",
      workStart: "เริ่มเวลาทำงาน",
      workEnd: "จบเวลาทำงาน",
      breakStart: "เริ่มพัก (ถ้ามี)",
      breakEnd: "จบพัก (ถ้ามี)",
      saveWorkingHours: "บันทึกเวลาทำงาน",
      workingHoursSaved: "บันทึกเวลาทำงานแล้ว",
    },
    inbox: {
      addNote: "เพิ่มโน้ต",
      notePlaceholder: "พิมพ์สิ่งที่อยากจำ...",
      noteActions: (title: string) => `เมนูโน้ต ${title}`,
      archiveNote: "เก็บโน้ต",
    },
    archive: { restore: "กู้คืน" },
    events: {
      new: "เพิ่มนัดหมาย",
      destination: "บันทึกไว้ที่",
      title: "ชื่อกิจกรรม",
      edit: "แก้ไขนัดหมาย",
      delete: "ลบนัดหมาย",
      deleteConfirmTitle: "ลบนัดหมายนี้ไหม?",
      deleteConfirm: "ลบอย่างถาวร",
      save: "บันทึกนัดหมาย",
    },
    finance: {
      billTitle: "ชื่อบิล",
      billAmount: "จำนวนเงินบิล",
      addBill: "เพิ่มบิล",
      markPaid: "จ่ายแล้ว",
      paid: "จ่ายแล้ว",
      billPaidToast: "บันทึกการจ่ายบิลแล้ว",
    },
    planner: { viewLabel: "มุมมองแผน", month: "เดือน", week: "สัปดาห์" },
    planning: {
      timeBlockTitle: "ชื่อช่วงเวลา",
      noLinkedTask: "ไม่ผูกกับงาน",
      starts: "เริ่ม",
      ends: "จบ",
      schedule: "จัดช่วงเวลา",
      saved: "จัดช่วงเวลาแล้ว",
      edit: "แก้เวลา",
      cancel: "ยกเลิก",
    },
    rescue: { confirm: "ยืนยันแผนนี้", undo: "เลิกทำการจัดแผน" },
  },
} satisfies Record<Locale, Record<string, unknown>>;

function requireLocalSupabase() {
  let hostname = "";
  try {
    hostname = new URL(supabaseUrl).hostname;
  } catch {
    throw new Error("Full-system E2E requires a local Supabase URL");
  }
  if (!localHosts.has(hostname)) {
    throw new Error("Full-system E2E can only create fixture data in local Supabase");
  }
  if (!anonKey || !serviceRoleKey) {
    throw new Error("Full-system E2E requires local Supabase credentials");
  }
}

function createAdminClient(): DbClient {
  requireLocalSupabase();
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      storageKey: "kemtit-full-system-e2e-admin-" + randomUUID(),
    },
  });
}

function createAnonClient(): DbClient {
  return createClient<Database>(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      storageKey: "kemtit-full-system-e2e-user-" + randomUUID(),
    },
  });
}

function getBaseURL(): string {
  const baseURL = test.info().project.use.baseURL;
  if (typeof baseURL !== "string") throw new Error("Playwright baseURL is unavailable");
  const parsed = new URL(baseURL);
  if (!localHosts.has(parsed.hostname) || parsed.port !== "3200") {
    throw new Error("Full-system E2E can only use the local QA server on port 3200");
  }
  return baseURL;
}

function expectedFinalPath(requestedPath: string): string {
  const redirects: Record<string, string> = {
    "/": "/login",
    "/dashboard": "/today",
    "/entries": "/work/sales",
    "/onboarding/first-goal": "/onboarding/starter",
  };
  return redirects[requestedPath] ?? requestedPath;
}

async function waitForSettledRoute(page: Page, expectedPath: string) {
  await expect
    .poll(() => new URL(page.url()).pathname, {
      message: `Expected navigation to settle at ${expectedPath}`,
      timeout: 30_000,
    })
    .toBe(expectedPath);
  await page.locator("main").waitFor({ state: "visible" });
  expect(new URL(page.url()).pathname).toBe(expectedPath);
}

function todayInBangkok(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(date: string, count: number): string {
  const result = new Date(`${date}T12:00:00+07:00`);
  result.setUTCDate(result.getUTCDate() + count);
  return result.toISOString().slice(0, 10);
}

async function addApprovedSessionCookies(
  page: Page,
  session: { access_token: string; refresh_token: string },
) {
  const cookieJar = new Map<string, string>();
  const cookieClient = createBrowserClient<Database>(supabaseUrl, anonKey, {
    isSingleton: false,
    auth: {
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
    },
    cookies: {
      getAll() {
        return Array.from(cookieJar, ([name, value]) => ({ name, value }));
      },
      setAll(cookies) {
        for (const cookie of cookies) {
          if (!cookie.value) cookieJar.delete(cookie.name);
          else cookieJar.set(cookie.name, cookie.value);
        }
      },
    },
  });
  const { error } = await cookieClient.auth.setSession(session);
  if (error || cookieJar.size === 0) {
    throw new Error("Approved local fixture session could not be prepared for Chrome");
  }
  const cookies = Array.from(cookieJar, ([name, value]) => ({ name, value, url: getBaseURL() }));
  await page.context().addCookies(cookies);
}

async function createFixture(page: Page): Promise<Fixture> {
  getBaseURL();
  const admin = createAdminClient();
  const token = randomUUID().slice(0, 8);
  const email = `full-system-e2e-${randomUUID()}@kemtit.test`;
  const goalTitle = `Full QA goal ${token}`;
  const planningTaskTitle = `Full QA planning ${token}`;
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password: fixturePassword,
    email_confirm: true,
  });
  if (userError || !userData.user) {
    throw new Error("A local full-system QA account could not be created");
  }

  const fixture: Fixture = {
    admin,
    id: userData.user.id,
    email,
    token,
    goalId: "",
    goalTitle,
    projectId: "",
    releaseId: "",
    rescueTaskId: "",
    planningTaskId: "",
    planningTaskTitle,
    habitId: "",
    habitTitle: `Full QA habit ${token}`,
    rescueTaskTitle: `Full QA rescue ${token}`,
  };

  try {
    const { error: profileError } = await admin
      .from("user_profiles")
      .update({
        display_name: "Full system QA",
        role_code: "employee",
        focus_areas: ["work"],
        default_scope: "work",
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq("id", fixture.id);
    if (profileError) throw new Error("The local QA profile could not be prepared");

    const today = todayInBangkok();
    const tomorrow = addDays(today, 1);
    const { data: goal, error: goalError } = await admin
      .from("goals")
      .insert({
        user_id: fixture.id,
        title: fixture.goalTitle,
        period_type: "week",
        period_start: today,
        domain: "work",
        goal_kind: "execution",
        status: "active",
      })
      .select("id")
      .single();
    if (goalError || !goal) throw new Error("A synthetic local goal could not be prepared");
    fixture.goalId = goal.id;

    const { data: project, error: projectError } = await admin
      .from("projects")
      .insert({
        user_id: fixture.id,
        goal_id: goal.id,
        title: `Full QA project ${token}`,
        domain: "work",
        status: "active",
      })
      .select("id")
      .single();
    if (projectError || !project)
      throw new Error("A synthetic local project could not be prepared");
    fixture.projectId = project.id;

    const tasks = await admin
      .from("tasks")
      .insert([
        {
          user_id: fixture.id,
          title: fixture.rescueTaskTitle,
          due_date: today,
          planned_date: today,
          status: "planned",
          priority: "normal",
          estimated_minutes: 30,
          domain: "work",
        },
        {
          user_id: fixture.id,
          title: fixture.planningTaskTitle,
          due_date: tomorrow,
          planned_date: tomorrow,
          status: "planned",
          priority: "normal",
          estimated_minutes: 30,
          domain: "work",
          goal_id: goal.id,
          project_id: project.id,
        },
      ])
      .select("id, title");
    if (tasks.error || !tasks.data || tasks.data.length !== 2) {
      throw new Error("Synthetic local planning tasks could not be prepared");
    }
    fixture.rescueTaskId =
      tasks.data.find((task) => task.title === fixture.rescueTaskTitle)?.id ?? "";
    fixture.planningTaskId =
      tasks.data.find((task) => task.title === fixture.planningTaskTitle)?.id ?? "";
    if (!fixture.rescueTaskId || !fixture.planningTaskId) {
      throw new Error("Synthetic local planning task IDs were not returned");
    }

    const { data: habit, error: habitError } = await admin
      .from("habits")
      .insert({
        user_id: fixture.id,
        title: fixture.habitTitle,
        domain: "health",
        cadence: "weekly",
        target_per_week: 4,
        estimated_minutes: 20,
      })
      .select("id")
      .single();
    if (habitError || !habit) throw new Error("A synthetic local habit could not be prepared");
    fixture.habitId = habit.id;

    const { data: release, error: releaseError } = await admin
      .from("release_notes")
      .insert({
        version: `full-qa-${token}`,
        build_id: `full-system-qa-${token}`,
        title_th: `ข่าวทดสอบ Full QA ${token}`,
        title_en: `Full QA synthetic release ${token}`,
        new_items_th: [`รายการใหม่ ${token}`],
        new_items_en: [`New item ${token}`],
        improved_items_th: [],
        improved_items_en: [],
        fixed_items_th: [],
        fixed_items_en: [],
        published_at: new Date(Date.now() - 60_000).toISOString(),
      })
      .select("id")
      .single();
    if (releaseError || !release)
      throw new Error("A synthetic local release note could not be prepared");
    fixture.releaseId = release.id;

    const authClient = createAnonClient();
    const approved = await signInAndApproveFixtureSession(authClient, admin, {
      email: fixture.email,
      password: fixturePassword,
      userId: fixture.id,
    });
    await addApprovedSessionCookies(page, approved.session);
    return fixture;
  } catch (error) {
    await cleanupFixture(fixture);
    throw error;
  }
}

async function cleanupFixture(fixture: Fixture) {
  const cleanupErrors: string[] = [];
  const { error: userError } = await fixture.admin.auth.admin.deleteUser(fixture.id);
  if (userError) cleanupErrors.push("local auth user");

  const ownRowChecks = await Promise.all([
    fixture.admin
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .eq("id", fixture.id),
    fixture.admin
      .from("goals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", fixture.id),
    fixture.admin
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", fixture.id),
    fixture.admin
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", fixture.id),
    fixture.admin
      .from("notes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", fixture.id),
    fixture.admin
      .from("calendar_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", fixture.id),
    fixture.admin
      .from("finance_bills")
      .select("id", { count: "exact", head: true })
      .eq("user_id", fixture.id),
    fixture.admin
      .from("finance_budgets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", fixture.id),
    fixture.admin
      .from("finance_transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", fixture.id),
    fixture.admin
      .from("time_blocks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", fixture.id),
    fixture.admin
      .from("habits")
      .select("id", { count: "exact", head: true })
      .eq("user_id", fixture.id),
    fixture.admin
      .from("habit_completions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", fixture.id),
    fixture.admin
      .from("weekly_reviews")
      .select("id", { count: "exact", head: true })
      .eq("user_id", fixture.id),
    fixture.admin
      .from("planning_preferences")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", fixture.id),
    fixture.admin
      .from("rescue_operations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", fixture.id),
  ]);
  if (ownRowChecks.some((result) => result.error || (result.count ?? 0) > 0)) {
    cleanupErrors.push("fixture-owned database rows");
  }

  const releaseBuildId = `full-system-qa-${fixture.token}`;
  const { error: releaseDeleteError } = await fixture.admin
    .from("release_notes")
    .delete()
    .eq("build_id", releaseBuildId);
  const { data: remainingReleases, error: releaseCheckError } = await fixture.admin
    .from("release_notes")
    .select("id")
    .eq("build_id", releaseBuildId);
  if (releaseDeleteError || releaseCheckError || remainingReleases?.length !== 0) {
    cleanupErrors.push("synthetic release note");
  }
  if (cleanupErrors.length > 0) {
    throw new Error("Full-system E2E cleanup failed: " + cleanupErrors.join(", "));
  }
}

async function setLocale(context: BrowserContext, locale: Locale) {
  await context.addCookies([
    { name: "KEMTIT_LOCALE", value: locale, url: getBaseURL(), sameSite: "Lax" },
  ]);
}

async function visibleControls(page: Page): Promise<InventoryControl[]> {
  return page.evaluate(() => {
    const selector =
      "button, a, input, select, textarea, summary, [role='button'], [role='checkbox'], [role='switch'], [role='radio']";
    return Array.from(document.querySelectorAll<HTMLElement>(selector)).map((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const visible =
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        rect.width > 0 &&
        rect.height > 0;
      const labelledBy = element.getAttribute("aria-labelledby");
      const labelledByText = labelledBy
        ? labelledBy
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
            .filter(Boolean)
            .join(" ")
        : "";
      const associatedLabels =
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
          ? Array.from(element.labels ?? [])
              .map((label) => label.textContent?.trim() ?? "")
              .join(" ")
          : "";
      const label =
        element.getAttribute("aria-label") ||
        labelledByText ||
        associatedLabels ||
        element.getAttribute("placeholder") ||
        element.getAttribute("title") ||
        element.innerText?.trim() ||
        element.textContent?.trim() ||
        "";
      const disabled =
        ("disabled" in element && Boolean((element as HTMLButtonElement).disabled)) ||
        element.getAttribute("aria-disabled") === "true";
      const hrefValue = element instanceof HTMLAnchorElement ? element.getAttribute("href") : null;
      let href: string | null = null;
      if (hrefValue) {
        try {
          const url = new URL(hrefValue, window.location.href);
          href =
            url.origin === window.location.origin ? `${url.pathname}${url.search}` : "external";
        } catch {
          href = hrefValue;
        }
      }
      return {
        tag: element.tagName.toLowerCase(),
        role: element.getAttribute("role"),
        label: label.replace(/\s+/g, " ").slice(0, 240),
        type: element instanceof HTMLInputElement ? element.type : null,
        href,
        disabled,
        visible,
      };
    });
  });
}

async function viewportMetrics(page: Page) {
  return page.evaluate(() => ({
    scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    viewportWidth: window.innerWidth,
  }));
}

async function writeJson(filename: string, contents: unknown) {
  mkdirSync(reportDirectory, { recursive: true });
  writeFileSync(resolve(reportDirectory, filename), JSON.stringify(contents, null, 2) + "\n");
}

async function writeExerciseLedger(
  filename: string,
  project: string,
  controls: ExercisedControl[],
  pageErrors: string[],
) {
  await writeJson(filename, {
    generatedAt: new Date().toISOString(),
    project,
    fixture: "synthetic local account; values excluded",
    coverageKind: "explicit-account-scoped-action-ledger",
    coverageNote:
      "Only actions listed below were exercised against the synthetic account. Route inventory does not imply that every visible control was clicked or passed.",
    pageErrors,
    controls,
  });
}

test.describe("Full system real-browser exploratory QA", () => {
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test("inventory production routes and controls in both locales at four widths", async ({
    browser,
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chrome",
      "The complete locale and viewport inventory runs once in the desktop Chrome project.",
    );
    test.setTimeout(20 * 60_000);

    const fixture = await createFixture(page);
    const rows: InventoryRow[] = [];
    const allPageErrors: Array<{ route: string; message: string }> = [];
    let activeRoute = "";
    const onPageError = (error: Error) => {
      allPageErrors.push({ route: activeRoute, message: error.message });
    };
    page.on("pageerror", onPageError);

    try {
      const authenticatedRoutes = [
        ...appRoutes,
        `/goals/${fixture.goalId}`,
        `/work/projects/${fixture.projectId}`,
        `/updates/${fixture.releaseId}`,
      ];
      for (const locale of ["th", "en"] as const) {
        await setLocale(page.context(), locale);
        for (const viewport of viewports) {
          await page.setViewportSize(viewport);
          for (const route of authenticatedRoutes) {
            activeRoute = `${locale} ${viewport.width}px ${route}`;
            const errorStart = allPageErrors.length;
            const response = await page.goto(route, { waitUntil: "domcontentloaded" });
            const expectedPath = expectedFinalPath(route);
            await waitForSettledRoute(page, expectedPath);
            const metrics = await viewportMetrics(page);
            const controls = await visibleControls(page);
            const row: InventoryRow = {
              route,
              expectedPath,
              locale,
              viewport: viewport.width,
              finalPath: new URL(page.url()).pathname,
              status: response?.status() ?? null,
              scrollWidth: metrics.scrollWidth,
              viewportWidth: metrics.viewportWidth,
              controls,
              pageErrors: allPageErrors.slice(errorStart).map((entry) => entry.message),
            };
            rows.push(row);
            expect(row.status, activeRoute + " response status").not.toBeNull();
            expect(row.status, activeRoute + " response status").toBeLessThan(400);
            expect(row.finalPath, activeRoute + " final path").toBe(expectedPath);
            expect(row.scrollWidth, activeRoute + " horizontal overflow").toBeLessThanOrEqual(
              row.viewportWidth + 1,
            );
            expect(row.pageErrors, activeRoute + " page errors").toEqual([]);
          }
        }
      }

      const onboardingRoutes = [
        { path: "/onboarding/persona", roleCode: null, focusAreas: [] as string[] },
        { path: "/onboarding/focus", roleCode: "employee", focusAreas: [] as string[] },
        { path: "/onboarding/starter", roleCode: "employee", focusAreas: ["work"] },
        { path: "/onboarding/first-goal", roleCode: "employee", focusAreas: ["work"] },
      ] as const;
      for (const locale of ["th", "en"] as const) {
        await setLocale(page.context(), locale);
        for (const viewport of viewports) {
          await page.setViewportSize(viewport);
          for (const route of onboardingRoutes) {
            const { error } = await fixture.admin
              .from("user_profiles")
              .update({
                role_code: route.roleCode,
                focus_areas: [...route.focusAreas],
                onboarding_completed_at: null,
              })
              .eq("id", fixture.id);
            if (error) throw new Error("The local onboarding fixture state could not be prepared");

            activeRoute = `${locale} ${viewport.width}px ${route.path}`;
            const errorStart = allPageErrors.length;
            const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
            const expectedPath = expectedFinalPath(route.path);
            await waitForSettledRoute(page, expectedPath);
            const metrics = await viewportMetrics(page);
            const row: InventoryRow = {
              route: route.path,
              expectedPath,
              locale,
              viewport: viewport.width,
              finalPath: new URL(page.url()).pathname,
              status: response?.status() ?? null,
              scrollWidth: metrics.scrollWidth,
              viewportWidth: metrics.viewportWidth,
              controls: await visibleControls(page),
              pageErrors: allPageErrors.slice(errorStart).map((entry) => entry.message),
            };
            rows.push(row);
            expect(row.status, activeRoute + " response status").not.toBeNull();
            expect(row.status, activeRoute + " response status").toBeLessThan(400);
            expect(row.finalPath, activeRoute + " final path").toBe(expectedPath);
            expect(row.scrollWidth, activeRoute + " horizontal overflow").toBeLessThanOrEqual(
              row.viewportWidth + 1,
            );
            expect(row.pageErrors, activeRoute + " page errors").toEqual([]);
          }
        }
      }

      const publicContext = await browser.newContext({
        baseURL: getBaseURL(),
        locale: "th-TH",
        timezoneId: "Asia/Bangkok",
      });
      try {
        const publicPage = await publicContext.newPage();
        let activePublicRoute = "/";
        publicPage.on("pageerror", (error) => {
          allPageErrors.push({
            route: "public " + activePublicRoute,
            message: error.message,
          });
        });
        for (const locale of ["th", "en"] as const) {
          await setLocale(publicContext, locale);
          for (const viewport of viewports) {
            await publicPage.setViewportSize(viewport);
            for (const route of ["/", "/login", "/register"] as const) {
              activePublicRoute = route;
              activeRoute = `public ${locale} ${viewport.width}px ${route}`;
              const errorStart = allPageErrors.length;
              const response = await publicPage.goto(route, { waitUntil: "domcontentloaded" });
              const expectedPath = expectedFinalPath(route);
              await waitForSettledRoute(publicPage, expectedPath);
              const metrics = await viewportMetrics(publicPage);
              const row: InventoryRow = {
                route,
                expectedPath,
                locale,
                viewport: viewport.width,
                finalPath: new URL(publicPage.url()).pathname,
                status: response?.status() ?? null,
                scrollWidth: metrics.scrollWidth,
                viewportWidth: metrics.viewportWidth,
                controls: await visibleControls(publicPage),
                pageErrors: allPageErrors.slice(errorStart).map((entry) => entry.message),
              };
              rows.push(row);
              expect(row.status, activeRoute + " response status").not.toBeNull();
              expect(row.status, activeRoute + " response status").toBeLessThan(400);
              expect(row.finalPath, activeRoute + " final path").toBe(expectedPath);
              expect(row.scrollWidth, activeRoute + " horizontal overflow").toBeLessThanOrEqual(
                row.viewportWidth + 1,
              );
              expect(row.pageErrors, activeRoute + " page errors").toEqual([]);
            }
          }
        }
      } finally {
        await publicContext.close();
      }
    } finally {
      page.off("pageerror", onPageError);
      try {
        await writeJson("control-inventory.json", {
          generatedAt: new Date().toISOString(),
          project: testInfo.project.name,
          fixture: "synthetic local account; values excluded",
          coverageKind: "route-and-control-inventory-only",
          coverageNote:
            "This records visible control inventory. Exercised actions are listed in control-exercise-ledger-*.json files.",
          routeCount: rows.length,
          settledRouteCount: rows.filter((row) => row.finalPath === row.expectedPath).length,
          pageErrorCount: allPageErrors.length,
          rows,
          pageErrors: allPageErrors,
        });
      } finally {
        await cleanupFixture(fixture);
      }
    }
  });

  test("exercise Settings, notes, events, bills, Rescue and Planning with own records", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chrome",
      "State-changing exploratory flows run once in the desktop Chrome project.",
    );
    test.setTimeout(10 * 60_000);

    const fixture = await createFixture(page);
    const exercised: ExercisedControl[] = [];
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    try {
      await page.setViewportSize({ width: 1440, height: 960 });
      const today = todayInBangkok();
      const tomorrow = addDays(today, 1);

      for (const locale of ["en", "th"] as const) {
        const copy = localized[locale];
        await setLocale(page.context(), locale);

        await page.goto("/settings");
        await page
          .locator("#settings-role")
          .selectOption(locale === "en" ? "freelancer" : "seller");
        const healthFocus = page.locator("#settings-focus-health");
        if ((await healthFocus.getAttribute("aria-checked")) !== "true") await healthFocus.click();
        await page.locator("#settings-scope").selectOption(locale === "en" ? "life" : "work");
        await page.getByRole("button", { name: copy.common.save, exact: true }).click();
        await expect(page.getByText(copy.settings.contextSaved, { exact: true })).toBeVisible();
        const profile = await fixture.admin
          .from("user_profiles")
          .select("role_code, focus_areas, default_scope")
          .eq("id", fixture.id)
          .single();
        expect(profile.error).toBeNull();
        expect(profile.data?.role_code).toBe(locale === "en" ? "freelancer" : "seller");
        expect(profile.data?.default_scope).toBe(locale === "en" ? "life" : "work");
        expect(profile.data?.focus_areas).toContain("health");
        exercised.push({
          locale,
          route: "/settings",
          control: "planning context",
          result: "saved and read back from the account profile",
        });

        await page.getByLabel(copy.settings.workStart, { exact: true }).fill("08:30");
        await page.getByLabel(copy.settings.workEnd, { exact: true }).fill("16:30");
        await page.getByLabel(copy.settings.breakStart, { exact: true }).fill("12:00");
        await page.getByLabel(copy.settings.breakEnd, { exact: true }).fill("12:30");
        await page
          .getByRole("button", { name: copy.settings.saveWorkingHours, exact: true })
          .click();
        await expect(
          page.getByText(copy.settings.workingHoursSaved, { exact: true }),
        ).toBeVisible();
        const preferences = await fixture.admin
          .from("planning_preferences")
          .select("working_windows, break_windows")
          .eq("user_id", fixture.id)
          .single();
        expect(preferences.error).toBeNull();
        expect(preferences.data?.working_windows).toEqual([{ start: "08:30", end: "16:30" }]);
        expect(preferences.data?.break_windows).toEqual([{ start: "12:00", end: "12:30" }]);
        exercised.push({
          locale,
          route: "/settings",
          control: "working hours and break",
          result: "saved and read back from the account preferences",
        });

        const noteTitle = `Full QA note ${locale} ${fixture.token}`;
        const editedNoteTitle = `${noteTitle} edited`;
        await page.goto("/inbox");
        await page.getByRole("button", { name: copy.inbox.addNote, exact: true }).click();
        await page.locator("#daily-note-composer").fill(`${noteTitle}\nSynthetic note body`);
        await page.getByRole("button", { name: copy.common.save, exact: true }).click();
        await expect(page.getByText(noteTitle, { exact: true })).toBeVisible();
        await page.getByLabel(copy.inbox.noteActions(noteTitle), { exact: true }).click();
        await page.getByRole("button", { name: copy.common.edit, exact: true }).click();
        await page
          .getByRole("textbox", { name: `${copy.common.edit} ${noteTitle}`, exact: true })
          .fill(`${editedNoteTitle}\nEdited body`);
        await page.getByRole("button", { name: copy.common.save, exact: true }).click();
        await expect(page.getByText(editedNoteTitle, { exact: true })).toBeVisible();
        await page.getByLabel(copy.inbox.noteActions(editedNoteTitle), { exact: true }).click();
        await page.getByRole("button", { name: copy.inbox.archiveNote, exact: true }).click();
        await expect(page.getByText(editedNoteTitle, { exact: true })).toHaveCount(0);
        await page.goto("/archive");
        await page
          .getByRole("button", { name: `${copy.archive.restore} ${editedNoteTitle}`, exact: true })
          .click();
        await expect(
          page.getByRole("button", {
            name: `${copy.archive.restore} ${editedNoteTitle}`,
            exact: true,
          }),
        ).toHaveCount(0);
        const restoredNote = await fixture.admin
          .from("notes")
          .select("id, title, archived_at")
          .eq("user_id", fixture.id)
          .eq("title", editedNoteTitle)
          .single();
        expect(restoredNote.error).toBeNull();
        expect(restoredNote.data?.archived_at).toBeNull();
        await page.goto("/inbox");
        await expect(page.getByText(editedNoteTitle, { exact: true })).toBeVisible();
        exercised.push({
          locale,
          route: "/inbox → /archive",
          control: "create, edit, archive and restore a synthetic note",
          result: "restored note remained visible in Inbox",
        });

        const eventTitle = `Full QA event ${locale} ${fixture.token}`;
        const editedEventTitle = `${eventTitle} edited`;
        await page.goto("/calendar/events");
        await page.getByRole("button", { name: copy.events.new, exact: true }).click();
        await page
          .getByRole("combobox", { name: copy.events.destination, exact: true })
          .selectOption("local");
        await page.getByLabel(copy.events.title, { exact: true }).fill(eventTitle);
        await page.getByRole("button", { name: copy.events.save, exact: true }).click();
        await expect(page.getByText(eventTitle, { exact: true })).toBeVisible();
        await page
          .getByRole("button", { name: `${copy.events.edit}: ${eventTitle}`, exact: true })
          .click();
        await page.getByLabel(copy.events.title, { exact: true }).fill(editedEventTitle);
        await page.getByRole("button", { name: copy.events.save, exact: true }).click();
        await expect(page.getByText(editedEventTitle, { exact: true })).toBeVisible();
        await page
          .getByRole("button", { name: `${copy.events.delete}: ${editedEventTitle}`, exact: true })
          .click();
        await page
          .getByRole("dialog", { name: copy.events.deleteConfirmTitle, exact: true })
          .getByRole("button", { name: copy.events.deleteConfirm, exact: true })
          .click();
        await expect(page.getByText(editedEventTitle, { exact: true })).toHaveCount(0);
        const deletedEvent = await fixture.admin
          .from("calendar_events")
          .select("id")
          .eq("user_id", fixture.id)
          .eq("title", editedEventTitle);
        expect(deletedEvent.error).toBeNull();
        expect(deletedEvent.data).toHaveLength(0);
        exercised.push({
          locale,
          route: "/calendar/events",
          control: "create, edit and confirm-delete a local synthetic event",
          result: "event edits persisted and the owned event was deleted",
        });

        const billTitle = `Full QA bill ${locale} ${fixture.token}`;
        await page.goto("/finance");
        await page.getByLabel(copy.finance.billTitle, { exact: true }).fill(billTitle);
        await page.getByLabel(copy.finance.billAmount, { exact: true }).fill("125.50");
        await page.getByRole("button", { name: copy.finance.addBill, exact: true }).click();
        const billRow = page.getByText(billTitle, { exact: true }).locator("xpath=ancestor::li");
        await expect(billRow).toBeVisible();
        await billRow.getByRole("button", { name: copy.finance.markPaid, exact: true }).click();
        await expect(page.getByText(copy.finance.billPaidToast, { exact: true })).toBeVisible();
        await expect(billRow.getByText(copy.finance.paid, { exact: true })).toBeVisible();
        await expect
          .poll(
            async () => {
              const persistedBill = await fixture.admin
                .from("finance_bills")
                .select("status")
                .eq("user_id", fixture.id)
                .eq("title", billTitle)
                .maybeSingle();
              expect(persistedBill.error).toBeNull();
              return persistedBill.data?.status ?? null;
            },
            { timeout: 10_000 },
          )
          .toBe("paid");
        const bill = await fixture.admin
          .from("finance_bills")
          .select("amount, status, paid_at")
          .eq("user_id", fixture.id)
          .eq("title", billTitle)
          .single();
        expect(bill.error).toBeNull();
        expect(Number(bill.data?.amount)).toBe(125.5);
        expect(bill.data?.status).toBe("paid");
        expect(bill.data?.paid_at).toBeTruthy();
        exercised.push({
          locale,
          route: "/finance",
          control: "create and mark a synthetic bill paid",
          result: "amount and paid status persisted for the fixture account",
        });

        await page.goto(`/rescue?date=${today}`);
        await expect(page.getByText(fixture.rescueTaskTitle, { exact: true })).toBeVisible();
        await page.getByRole("button", { name: copy.rescue.confirm, exact: true }).click();
        await expect(
          page.getByRole("button", { name: copy.rescue.undo, exact: true }),
        ).toBeVisible();
        const rescuedBlocks = await fixture.admin
          .from("time_blocks")
          .select("id, title")
          .eq("user_id", fixture.id)
          .eq("task_id", fixture.rescueTaskId);
        expect(rescuedBlocks.error).toBeNull();
        expect(rescuedBlocks.data).toHaveLength(1);
        await page.getByRole("button", { name: copy.rescue.undo, exact: true }).click();
        await expect(
          page.getByRole("button", { name: copy.rescue.confirm, exact: true }),
        ).toBeVisible();
        const undoneBlocks = await fixture.admin
          .from("time_blocks")
          .select("id")
          .eq("user_id", fixture.id)
          .eq("task_id", fixture.rescueTaskId);
        expect(undoneBlocks.error).toBeNull();
        expect(undoneBlocks.data).toHaveLength(0);
        exercised.push({
          locale,
          route: "/rescue",
          control: "confirm and undo a synthetic rescue plan",
          result: "rescue created a block, then undo removed that block",
        });

        await page.goto("/plan?view=year");
        const periodNav = page.getByRole("navigation", {
          name: copy.planner.viewLabel,
          exact: true,
        });
        await periodNav.getByRole("link", { name: copy.planner.month, exact: true }).click();
        await expect(page).toHaveURL(/\/plan\?view=month/);
        await page
          .getByRole("navigation", { name: copy.planner.viewLabel, exact: true })
          .getByRole("link", { name: copy.planner.week, exact: true })
          .click();
        await expect(page).toHaveURL(/\/plan\?view=week/);
        exercised.push({
          locale,
          route: "/plan",
          control: "switch Year → Month → Week",
          result: "each linked planning horizon opened",
        });
      }

      await setLocale(page.context(), "en");
      await page.goto(`/today?date=${tomorrow}`);
      await page
        .getByLabel(localized.en.planning.timeBlockTitle, { exact: true })
        .fill(`Full QA block ${fixture.token}`);
      await page.locator("#time-block-task").selectOption("");
      await page
        .getByLabel(localized.en.planning.starts, { exact: true })
        .fill(`${tomorrow}T09:00`);
      await page.getByLabel(localized.en.planning.ends, { exact: true }).fill(`${tomorrow}T09:30`);
      await page.getByRole("button", { name: localized.en.planning.schedule, exact: true }).click();
      const blockTitle = `Full QA block ${fixture.token}`;
      await expect(page.getByText(localized.en.planning.saved, { exact: true })).toBeVisible();
      const scheduledBlock = await fixture.admin
        .from("time_blocks")
        .select("id, title, status")
        .eq("user_id", fixture.id)
        .eq("title", blockTitle)
        .single();
      expect(scheduledBlock.error).toBeNull();
      expect(scheduledBlock.data?.status).toBe("active");

      await page.goto(`/calendar?view=day&date=${tomorrow}`);
      await expect(page.getByText(blockTitle, { exact: true })).toBeVisible();
      await page.getByRole("button", { name: localized.en.planning.edit, exact: true }).click();
      const blockRow = page.getByText(blockTitle, { exact: true }).locator("xpath=ancestor::li");
      await blockRow
        .getByLabel(localized.en.planning.timeBlockTitle, { exact: true })
        .fill(`${blockTitle} edited`);
      await page.getByRole("button", { name: localized.en.common.save, exact: true }).click();
      await expect(page.getByText(localized.en.planning.updated, { exact: true })).toBeVisible();
      await expect
        .poll(
          async () => {
            const persistedBlock = await fixture.admin
              .from("time_blocks")
              .select("title")
              .eq("user_id", fixture.id)
              .eq("id", scheduledBlock.data!.id)
              .maybeSingle();
            expect(persistedBlock.error).toBeNull();
            return persistedBlock.data?.title ?? null;
          },
          { timeout: 10_000 },
        )
        .toBe(`${blockTitle} edited`);
      const editedBlock = await fixture.admin
        .from("time_blocks")
        .select("id, title, status")
        .eq("user_id", fixture.id)
        .eq("id", scheduledBlock.data!.id)
        .single();
      expect(editedBlock.error).toBeNull();
      expect(editedBlock.data?.title).toBe(`${blockTitle} edited`);
      await page.getByRole("button", { name: localized.en.planning.cancel, exact: true }).click();
      await expect(page.getByText(localized.en.planning.cancelled, { exact: true })).toBeVisible();
      await expect
        .poll(
          async () => {
            const persistedBlock = await fixture.admin
              .from("time_blocks")
              .select("status")
              .eq("user_id", fixture.id)
              .eq("id", scheduledBlock.data!.id)
              .maybeSingle();
            expect(persistedBlock.error).toBeNull();
            return persistedBlock.data?.status ?? null;
          },
          { timeout: 10_000 },
        )
        .toBe("cancelled");
      const cancelledBlock = await fixture.admin
        .from("time_blocks")
        .select("status")
        .eq("user_id", fixture.id)
        .eq("id", scheduledBlock.data!.id)
        .single();
      expect(cancelledBlock.error).toBeNull();
      expect(cancelledBlock.data?.status).toBe("cancelled");
      exercised.push({
        locale: "en",
        route: "/today → /calendar",
        control: "schedule, edit and cancel a synthetic time block",
        result: "time block transitions persisted for the fixture account",
      });

      expect(errors).toEqual([]);
    } finally {
      try {
        await writeJson("control-exercise-ledger-core.json", {
          generatedAt: new Date().toISOString(),
          project: testInfo.project.name,
          fixture: "synthetic local account; values excluded",
          coverageKind: "explicit-account-scoped-action-ledger",
          coverageNote:
            "Only actions listed below were exercised against this synthetic account. Route inventory does not imply that every visible control was clicked or passed.",
          pageErrors: errors,
          controls: exercised,
        });
      } finally {
        await cleanupFixture(fixture);
      }
    }
  });

  test("Finance budget save persists at desktop and mobile sizes in both locales", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chrome",
      "Responsive finance actions run once in desktop Chrome.",
    );
    test.setTimeout(5 * 60_000);

    const fixture = await createFixture(page);
    const exercised: ExercisedControl[] = [];
    const pageErrors: string[] = [];
    const onPageError = (error: Error) => pageErrors.push(error.message);
    page.on("pageerror", onPageError);

    try {
      const today = todayInBangkok();
      const monthStart = `${today.slice(0, 7)}-01`;
      for (const locale of ["en", "th"] as const) {
        const copy = interactionCopy[locale];
        await setLocale(page.context(), locale);
        for (const width of [1440, 390]) {
          await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
          await page.goto("/finance");
          const amount = 4321.5 + (locale === "en" ? 10 : 20) + (width === 390 ? 1 : 0);
          const budgetInput = page.getByRole("spinbutton", {
            name: copy.finance.budgetLabel,
            exact: true,
          });
          await budgetInput.fill(String(amount));
          await page.getByRole("button", { name: copy.finance.saveBudget, exact: true }).click();
          await expect(page.getByText(copy.finance.budgetSaved, { exact: true })).toBeVisible();

          const savedBudget = await fixture.admin
            .from("finance_budgets")
            .select("amount, month_start")
            .eq("user_id", fixture.id)
            .eq("month_start", monthStart)
            .single();
          expect(savedBudget.error).toBeNull();
          expect(Number(savedBudget.data?.amount)).toBe(amount);
          await page.reload();
          await expect(budgetInput).toHaveValue(String(amount));
          exercised.push({
            locale,
            viewport: width,
            route: "/finance",
            control: "save monthly budget",
            result: "success message, database amount, and reloaded input value matched",
          });
        }
      }
      expect(pageErrors).toEqual([]);
    } finally {
      page.off("pageerror", onPageError);
      try {
        await writeExerciseLedger(
          "control-exercise-ledger-finance-budget.json",
          testInfo.project.name,
          exercised,
          pageErrors,
        );
      } finally {
        await cleanupFixture(fixture);
      }
    }
  });

  test("Task search and status filters return only matching fixture tasks", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chrome",
      "Responsive task-library actions run once in desktop Chrome.",
    );
    test.setTimeout(5 * 60_000);

    const fixture = await createFixture(page);
    const exercised: ExercisedControl[] = [];
    const pageErrors: string[] = [];
    const onPageError = (error: Error) => pageErrors.push(error.message);
    page.on("pageerror", onPageError);

    try {
      const { error: completeSeedError } = await fixture.admin
        .from("tasks")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", fixture.planningTaskId)
        .eq("user_id", fixture.id);
      if (completeSeedError) throw new Error("The synthetic completed task could not be prepared");

      for (const locale of ["en", "th"] as const) {
        const copy = interactionCopy[locale];
        await setLocale(page.context(), locale);
        for (const width of [1440, 390]) {
          await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
          await page.goto("/tasks");
          const search = page.getByLabel(copy.tasks.searchLabel, { exact: true });
          const view = page.getByRole("combobox", { name: copy.tasks.viewLabel, exact: true });
          const submit = page.getByRole("button", { name: copy.tasks.searchButton, exact: true });
          await expect(page.getByRole("combobox")).toHaveCount(1);

          await view.selectOption("all");
          await search.fill(fixture.rescueTaskTitle);
          await submit.click();
          await expect(page.locator(`[data-task-id="${fixture.rescueTaskId}"]`)).toBeVisible();
          await expect(page.locator(`[data-task-id="${fixture.planningTaskId}"]`)).toHaveCount(0);

          await view.selectOption("done");
          await search.fill(fixture.planningTaskTitle);
          await submit.click();
          await expect(page.locator(`[data-task-id="${fixture.planningTaskId}"]`)).toBeVisible();
          await expect(page.locator(`[data-task-id="${fixture.rescueTaskId}"]`)).toHaveCount(0);

          await page.reload();
          await expect(page.locator(`[data-task-id="${fixture.planningTaskId}"]`)).toBeVisible();
          exercised.push({
            locale,
            viewport: width,
            route: "/tasks",
            control: "search tasks and filter by All and Done",
            result:
              "search results matched fixture task IDs; reload retained the selected view and query",
          });
        }
      }
      expect(pageErrors).toEqual([]);
    } finally {
      page.off("pageerror", onPageError);
      try {
        await writeExerciseLedger(
          "control-exercise-ledger-task-search-filter.json",
          testInfo.project.name,
          exercised,
          pageErrors,
        );
      } finally {
        await cleanupFixture(fixture);
      }
    }
  });

  test("Task details archive and restore the owned task", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chrome",
      "Responsive task archive actions run once in desktop Chrome.",
    );
    test.setTimeout(5 * 60_000);

    const fixture = await createFixture(page);
    const exercised: ExercisedControl[] = [];
    const pageErrors: string[] = [];
    const onPageError = (error: Error) => pageErrors.push(error.message);
    page.on("pageerror", onPageError);

    try {
      for (const locale of ["en", "th"] as const) {
        const copy = interactionCopy[locale];
        await setLocale(page.context(), locale);
        for (const width of [1440, 390]) {
          await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
          await page.goto("/today?scope=work");
          const taskOpener = page.getByRole("button", {
            name: copy.a11y.openTask(fixture.rescueTaskTitle),
            exact: true,
          });
          await expect(taskOpener).toBeVisible();
          await taskOpener.click();
          await page
            .getByRole("dialog")
            .getByRole("button", { name: copy.tasks.archive, exact: true })
            .click();
          await expect(
            page.getByText(copy.tasks.archived(fixture.rescueTaskTitle), { exact: true }),
          ).toBeVisible();

          const archivedTask = await fixture.admin
            .from("tasks")
            .select("archived_at, status")
            .eq("id", fixture.rescueTaskId)
            .eq("user_id", fixture.id)
            .single();
          expect(archivedTask.error).toBeNull();
          expect(archivedTask.data?.archived_at).toBeTruthy();

          await page.getByRole("button", { name: copy.common.undo, exact: true }).click();
          await expect(
            page.getByText(copy.tasks.restored(fixture.rescueTaskTitle), { exact: true }),
          ).toBeVisible();
          const restoredTask = await fixture.admin
            .from("tasks")
            .select("archived_at, status")
            .eq("id", fixture.rescueTaskId)
            .eq("user_id", fixture.id)
            .single();
          expect(restoredTask.error).toBeNull();
          expect(restoredTask.data?.archived_at).toBeNull();
          expect(restoredTask.data?.status).toBe("planned");
          await page.reload();
          await expect(taskOpener).toBeVisible();
          exercised.push({
            locale,
            viewport: width,
            route: "/today → /archive",
            control: "open task details, archive task, undo archive",
            result: "archive and restore persisted and task returned after reload",
          });
        }
      }
      expect(pageErrors).toEqual([]);
    } finally {
      page.off("pageerror", onPageError);
      try {
        await writeExerciseLedger(
          "control-exercise-ledger-task-archive-restore.json",
          testInfo.project.name,
          exercised,
          pageErrors,
        );
      } finally {
        await cleanupFixture(fixture);
      }
    }
  });

  test("Goal edit persists through reload at desktop and mobile sizes in both locales", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chrome",
      "Responsive goal editing runs once in desktop Chrome.",
    );
    test.setTimeout(5 * 60_000);

    const fixture = await createFixture(page);
    const exercised: ExercisedControl[] = [];
    const pageErrors: string[] = [];
    const onPageError = (error: Error) => pageErrors.push(error.message);
    page.on("pageerror", onPageError);

    try {
      for (const locale of ["en", "th"] as const) {
        const copy = interactionCopy[locale];
        await setLocale(page.context(), locale);
        for (const width of [1440, 390]) {
          await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
          await page.goto(`/goals/${fixture.goalId}`);
          const updatedTitle = `Full QA goal edited ${locale} ${width} ${fixture.token}`;
          await page
            .locator("main > header")
            .getByRole("button", { name: copy.goals.editButton, exact: true })
            .click();
          const goalDialog = page.getByRole("dialog", { name: copy.goals.editDialog, exact: true });
          await goalDialog.getByLabel(copy.goals.titleLabel, { exact: true }).fill(updatedTitle);
          await goalDialog
            .getByRole("button", { name: copy.goals.saveChanges, exact: true })
            .click();
          await expect(
            page.getByRole("heading", { name: updatedTitle, exact: true }),
          ).toBeVisible();

          const savedGoal = await fixture.admin
            .from("goals")
            .select("title")
            .eq("id", fixture.goalId)
            .eq("user_id", fixture.id)
            .single();
          expect(savedGoal.error).toBeNull();
          expect(savedGoal.data?.title).toBe(updatedTitle);
          await page.reload();
          await expect(
            page.getByRole("heading", { name: updatedTitle, exact: true }),
          ).toBeVisible();
          exercised.push({
            locale,
            viewport: width,
            route: `/goals/${fixture.goalId}`,
            control: "edit goal title",
            result: "updated title was visible, persisted in the fixture row, and survived reload",
          });
        }
      }
      expect(pageErrors).toEqual([]);
    } finally {
      page.off("pageerror", onPageError);
      try {
        await writeExerciseLedger(
          "control-exercise-ledger-goal-edit.json",
          testInfo.project.name,
          exercised,
          pageErrors,
        );
      } finally {
        await cleanupFixture(fixture);
      }
    }
  });

  test("Goal archive and restore operate only on the synthetic goal", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chrome",
      "Responsive goal archive actions run once in desktop Chrome.",
    );
    test.setTimeout(5 * 60_000);

    const fixture = await createFixture(page);
    const exercised: ExercisedControl[] = [];
    const pageErrors: string[] = [];
    const onPageError = (error: Error) => pageErrors.push(error.message);
    page.on("pageerror", onPageError);

    try {
      for (const locale of ["en", "th"] as const) {
        const copy = interactionCopy[locale];
        await setLocale(page.context(), locale);
        for (const width of [1440, 390]) {
          await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
          await page.goto(`/goals/${fixture.goalId}`);
          await page
            .locator("main > header")
            .getByRole("button", { name: copy.goals.archive, exact: true })
            .click();
          await expect(
            page.getByText(copy.goals.archived(fixture.goalTitle), { exact: true }),
          ).toBeVisible();

          const archivedGoal = await fixture.admin
            .from("goals")
            .select("status, archived_at")
            .eq("id", fixture.goalId)
            .eq("user_id", fixture.id)
            .single();
          expect(archivedGoal.error).toBeNull();
          expect(archivedGoal.data?.status).toBe("archived");
          expect(archivedGoal.data?.archived_at).toBeTruthy();

          await page.goto("/archive");
          const goalArchive = page.getByRole("region", { name: copy.archive.goals, exact: true });
          await goalArchive
            .getByRole("button", {
              name: `${copy.archive.restore} ${fixture.goalTitle}`,
              exact: true,
            })
            .click();
          await expect(
            page.getByText(copy.archive.restored(fixture.goalTitle), { exact: true }),
          ).toBeVisible();
          const restoredGoal = await fixture.admin
            .from("goals")
            .select("status, archived_at")
            .eq("id", fixture.goalId)
            .eq("user_id", fixture.id)
            .single();
          expect(restoredGoal.error).toBeNull();
          expect(restoredGoal.data?.status).toBe("active");
          expect(restoredGoal.data?.archived_at).toBeNull();
          await page.reload();
          await expect(
            page.getByRole("button", {
              name: `${copy.archive.restore} ${fixture.goalTitle}`,
              exact: true,
            }),
          ).toHaveCount(0);
          exercised.push({
            locale,
            viewport: width,
            route: `/goals/${fixture.goalId} → /archive`,
            control: "archive goal and restore it from Archive",
            result: "goal status and archive timestamp changed back after restore and reload",
          });
        }
      }
      expect(pageErrors).toEqual([]);
    } finally {
      page.off("pageerror", onPageError);
      try {
        await writeExerciseLedger(
          "control-exercise-ledger-goal-archive-restore.json",
          testInfo.project.name,
          exercised,
          pageErrors,
        );
      } finally {
        await cleanupFixture(fixture);
      }
    }
  });

  test("Project edit, archive and restore persist only the fixture project", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chrome",
      "Responsive project actions run once in desktop Chrome.",
    );
    test.setTimeout(5 * 60_000);

    const fixture = await createFixture(page);
    const exercised: ExercisedControl[] = [];
    const pageErrors: string[] = [];
    const projectScreenshotDirectory = resolve(reportDirectory, "screenshots");
    mkdirSync(projectScreenshotDirectory, { recursive: true });
    const onPageError = (error: Error) => pageErrors.push(error.message);
    page.on("pageerror", onPageError);

    try {
      for (const locale of ["en", "th"] as const) {
        const copy = interactionCopy[locale];
        await setLocale(page.context(), locale);
        for (const width of [1440, 390]) {
          await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
          await page.goto(`/work/projects/${fixture.projectId}`);
          const title = `Full QA project edited ${locale} ${width} ${fixture.token}`;
          const description = `Synthetic project description ${locale} ${width}`;
          await page.getByLabel(copy.projects.titleLabel, { exact: true }).fill(title);
          await page.getByLabel(copy.projects.descriptionLabel, { exact: true }).fill(description);
          await page.getByRole("button", { name: copy.projects.save, exact: true }).click();
          await expect(page.getByText(copy.projects.updated, { exact: true })).toBeVisible();

          const savedProject = await fixture.admin
            .from("projects")
            .select("title, description")
            .eq("id", fixture.projectId)
            .eq("user_id", fixture.id)
            .single();
          expect(savedProject.error).toBeNull();
          expect(savedProject.data?.title).toBe(title);
          expect(savedProject.data?.description).toBe(description);
          await page.reload();
          await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
          await expect(
            page.getByLabel(copy.projects.descriptionLabel, { exact: true }),
          ).toHaveValue(description);
          await expect(page.getByLabel(copy.projects.titleLabel, { exact: true })).toHaveValue(
            title,
          );
          await page.screenshot({
            path: resolve(projectScreenshotDirectory, `project-edit-${locale}-${width}.png`),
            fullPage: true,
            animations: "disabled",
          });

          await page.getByRole("button", { name: copy.projects.archive, exact: true }).click();
          await expect(page).toHaveURL(/\/work\/projects$/);
          await expect(page.getByText(copy.projects.archived, { exact: true })).toBeVisible();
          const archivedProject = await fixture.admin
            .from("projects")
            .select("status, archived_at")
            .eq("id", fixture.projectId)
            .eq("user_id", fixture.id)
            .single();
          expect(archivedProject.error).toBeNull();
          expect(archivedProject.data?.status).toBe("archived");
          expect(archivedProject.data?.archived_at).toBeTruthy();

          await page.goto("/archive");
          const projectArchive = page.getByRole("region", {
            name: copy.archive.projects,
            exact: true,
          });
          await projectArchive
            .getByRole("button", { name: `${copy.archive.restore} ${title}`, exact: true })
            .click();
          await expect(page.getByText(copy.archive.restored(title), { exact: true })).toBeVisible();
          const restoredProject = await fixture.admin
            .from("projects")
            .select("status, archived_at")
            .eq("id", fixture.projectId)
            .eq("user_id", fixture.id)
            .single();
          expect(restoredProject.error).toBeNull();
          expect(restoredProject.data?.status).toBe("active");
          expect(restoredProject.data?.archived_at).toBeNull();
          await page.goto(`/work/projects/${fixture.projectId}`);
          await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
          exercised.push({
            locale,
            viewport: width,
            route: `/work/projects/${fixture.projectId} → /archive`,
            control: "edit project, archive, and restore from Archive",
            result: "project fields persisted and active archive state returned after reload",
          });
        }
      }
      expect(pageErrors).toEqual([]);
    } finally {
      page.off("pageerror", onPageError);
      try {
        await writeExerciseLedger(
          "control-exercise-ledger-project-edit-archive-restore.json",
          testInfo.project.name,
          exercised,
          pageErrors,
        );
      } finally {
        await cleanupFixture(fixture);
      }
    }
  });

  test("Weekly review carries only selected fixture tasks into next week", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chrome",
      "Responsive review actions run once in desktop Chrome.",
    );
    test.setTimeout(5 * 60_000);

    const fixture = await createFixture(page);
    const exercised: ExercisedControl[] = [];
    const pageErrors: string[] = [];
    const onPageError = (error: Error) => pageErrors.push(error.message);
    page.on("pageerror", onPageError);

    try {
      const weekStart = startOfWeekISO(todayInBangkok());
      const firstPlannedDate = addDaysISO(weekStart, 2);
      const secondPlannedDate = addDaysISO(weekStart, 3);
      const nextWeekStart = addDaysISO(weekStart, 7);
      const deadline = addDaysISO(nextWeekStart, 10);
      for (const locale of ["en", "th"] as const) {
        const copy = interactionCopy[locale];
        await setLocale(page.context(), locale);
        for (const width of [1440, 390]) {
          await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
          const { error: seedError } = await fixture.admin
            .from("tasks")
            .update({ planned_date: firstPlannedDate, deadline })
            .eq("id", fixture.rescueTaskId)
            .eq("user_id", fixture.id);
          if (seedError) throw new Error("The selected review task could not be prepared");
          const { error: otherTaskSeedError } = await fixture.admin
            .from("tasks")
            .update({ planned_date: secondPlannedDate, deadline: null })
            .eq("id", fixture.planningTaskId)
            .eq("user_id", fixture.id);
          if (otherTaskSeedError)
            throw new Error("The unselected review task could not be prepared");

          await page.goto("/reviews");
          await expect(
            page.getByRole("heading", { name: copy.reviews.carryoverTitle, exact: true }),
          ).toBeVisible();
          const selectedTask = page
            .locator("label")
            .filter({ hasText: fixture.rescueTaskTitle })
            .getByRole("checkbox");
          await selectedTask.check();
          await page
            .getByRole("button", { name: copy.reviews.carryoverAction, exact: true })
            .click();
          await expect(
            page.getByText(copy.reviews.carryoverSaved(1), { exact: true }),
          ).toBeVisible();

          const movedTask = await fixture.admin
            .from("tasks")
            .select("planned_date, deadline")
            .eq("id", fixture.rescueTaskId)
            .eq("user_id", fixture.id)
            .single();
          const unchangedTask = await fixture.admin
            .from("tasks")
            .select("planned_date, deadline")
            .eq("id", fixture.planningTaskId)
            .eq("user_id", fixture.id)
            .single();
          expect(movedTask.error).toBeNull();
          expect(movedTask.data?.planned_date).toBe(nextWeekStart);
          expect(movedTask.data?.deadline).toBe(deadline);
          expect(unchangedTask.error).toBeNull();
          expect(unchangedTask.data?.planned_date).toBe(secondPlannedDate);
          expect(unchangedTask.data?.deadline).toBeNull();
          await page.reload();
          const reloadedTask = await fixture.admin
            .from("tasks")
            .select("planned_date, deadline")
            .eq("id", fixture.rescueTaskId)
            .eq("user_id", fixture.id)
            .single();
          expect(reloadedTask.data?.planned_date).toBe(nextWeekStart);
          exercised.push({
            locale,
            viewport: width,
            route: "/reviews",
            control: "select one task and carry it into next week",
            result:
              "selected task moved, its deadline stayed fixed, and the unchecked task remained unchanged",
          });
        }
      }
      expect(pageErrors).toEqual([]);
    } finally {
      page.off("pageerror", onPageError);
      try {
        await writeExerciseLedger(
          "control-exercise-ledger-weekly-review-carryover.json",
          testInfo.project.name,
          exercised,
          pageErrors,
        );
      } finally {
        await cleanupFixture(fixture);
      }
    }
  });

  test("Settings display-name changes persist across four viewport sizes", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chrome",
      "Responsive settings actions run once in desktop Chrome.",
    );
    test.setTimeout(5 * 60_000);

    const fixture = await createFixture(page);
    const exercised: ExercisedControl[] = [];
    const pageErrors: string[] = [];
    const onPageError = (error: Error) => pageErrors.push(error.message);
    page.on("pageerror", onPageError);

    try {
      for (const locale of ["en", "th"] as const) {
        const copy = interactionCopy[locale];
        await setLocale(page.context(), locale);
        for (const viewport of viewports) {
          await page.setViewportSize(viewport);
          await page.goto("/settings");
          const displayName = `Full QA ${locale} ${viewport.width} ${fixture.token}`;
          await page.getByLabel(copy.settings.profileName, { exact: true }).fill(displayName);
          await page.getByRole("button", { name: copy.settings.saveName, exact: true }).click();
          await expect(page.getByText(copy.settings.nameSaved, { exact: true })).toBeVisible();

          const savedProfile = await fixture.admin
            .from("user_profiles")
            .select("display_name")
            .eq("id", fixture.id)
            .single();
          expect(savedProfile.error).toBeNull();
          expect(savedProfile.data?.display_name).toBe(displayName);
          await page.reload();
          await expect(page.getByLabel(copy.settings.profileName, { exact: true })).toHaveValue(
            displayName,
          );
          exercised.push({
            locale,
            viewport: viewport.width,
            route: "/settings",
            control: "save profile display name",
            result: "localized confirmation, profile row, and reloaded input value matched",
          });
        }
      }
      expect(pageErrors).toEqual([]);
    } finally {
      page.off("pageerror", onPageError);
      try {
        await writeExerciseLedger(
          "control-exercise-ledger-settings-profile-name.json",
          testInfo.project.name,
          exercised,
          pageErrors,
        );
      } finally {
        await cleanupFixture(fixture);
      }
    }
  });

  test("Settings language switch updates the UI and survives reload", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chrome",
      "Responsive language actions run once in desktop Chrome.",
    );
    test.setTimeout(5 * 60_000);

    const fixture = await createFixture(page);
    const exercised: ExercisedControl[] = [];
    const pageErrors: string[] = [];
    const onPageError = (error: Error) => pageErrors.push(error.message);
    page.on("pageerror", onPageError);

    try {
      for (const locale of ["en", "th"] as const) {
        const copy = interactionCopy[locale];
        const targetLocale = locale === "en" ? "th" : "en";
        const targetCopy = interactionCopy[targetLocale];
        for (const viewport of viewports) {
          await setLocale(page.context(), locale);
          await page.setViewportSize(viewport);
          await page.goto("/settings");
          const languageGroup = page.getByRole("group", {
            name: copy.settings.languageGroup,
            exact: true,
          });
          await languageGroup
            .getByRole("button", {
              name: targetLocale === "th" ? copy.settings.thai : copy.settings.english,
              exact: true,
            })
            .click();
          await expect(
            page.getByRole("heading", { name: targetCopy.settings.languageHeading, exact: true }),
          ).toBeVisible();
          await expect(
            page.getByText(
              targetCopy.settings[targetLocale === "th" ? "previewThai" : "previewEnglish"],
              { exact: true },
            ),
          ).toBeVisible();

          await page.reload();
          await expect(
            page.getByRole("heading", { name: targetCopy.settings.languageHeading, exact: true }),
          ).toBeVisible();
          const activeGroup = page.getByRole("group", {
            name: targetCopy.settings.languageGroup,
            exact: true,
          });
          await expect(
            activeGroup.getByRole("button", {
              name: targetLocale === "th" ? targetCopy.settings.thai : targetCopy.settings.english,
              exact: true,
            }),
          ).toHaveAttribute("aria-pressed", "true");
          exercised.push({
            locale,
            viewport: viewport.width,
            route: "/settings",
            control: "switch language and region UI",
            result: "localized settings preview changed and the selected language survived reload",
          });
        }
      }
      expect(pageErrors).toEqual([]);
    } finally {
      page.off("pageerror", onPageError);
      try {
        await writeExerciseLedger(
          "control-exercise-ledger-settings-language.json",
          testInfo.project.name,
          exercised,
          pageErrors,
        );
      } finally {
        await cleanupFixture(fixture);
      }
    }
  });

  test("Settings show provider limits and issue a local LINE link code", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chrome",
      "Responsive provider states run once in desktop Chrome.",
    );
    test.setTimeout(5 * 60_000);

    const fixture = await createFixture(page);
    const exercised: ExercisedControl[] = [];
    const pageErrors: string[] = [];
    const onPageError = (error: Error) => pageErrors.push(error.message);
    page.on("pageerror", onPageError);

    try {
      for (const locale of ["en", "th"] as const) {
        const copy = interactionCopy[locale];
        await setLocale(page.context(), locale);
        for (const width of [1440, 768, 390, 360]) {
          await page.setViewportSize({ width, height: width < 400 ? 844 : 960 });
          await page.goto("/settings?calendar=not-configured");
          await expect(
            page.getByRole("status").filter({ hasText: copy.settings.calendarNotice }),
          ).toHaveText(copy.settings.calendarNotice);
          for (const [provider, connectName] of [
            [copy.settings.googleCalendar, copy.settings.connectGoogle],
            [copy.settings.outlookCalendar, copy.settings.connectOutlook],
          ] as const) {
            const section = page.getByRole("region", { name: provider, exact: true });
            const connectButton = section.getByRole("button", { name: connectName, exact: true });
            await expect(connectButton).toBeDisabled();
            await expect(
              page.getByText(copy.settings.providerUnavailable(provider), { exact: true }),
            ).toBeAttached();
          }
          const lineSection = page.getByRole("region", {
            name: copy.settings.lineTitle,
            exact: true,
          });
          await expect(lineSection).toContainText(copy.settings.lineDryRunHint);
          await expect(
            lineSection.getByRole("button", { name: copy.settings.connectLine, exact: true }),
          ).toBeEnabled();
          exercised.push({
            locale,
            viewport: width,
            route: "/settings?calendar=not-configured",
            control: "read unavailable calendar and LINE provider states",
            result:
              "localized LINE delivery notice rendered and Google/Outlook connect actions remained disabled",
          });
        }
      }

      const englishCopy = interactionCopy.en;
      await setLocale(page.context(), "en");
      await page.setViewportSize({ width: 1440, height: 960 });
      await page.goto("/settings?calendar=not-configured");
      const lineSection = page.getByRole("region", {
        name: englishCopy.settings.lineTitle,
        exact: true,
      });
      await lineSection
        .getByRole("button", { name: englishCopy.settings.connectLine, exact: true })
        .click();
      const codeElement = page.getByTestId("line-link-code");
      await expect(codeElement).toBeVisible();
      const displayedCode = (await codeElement.textContent())?.trim() ?? "";
      if (!/^[A-HJ-NP-Z2-9]{6}$/.test(displayedCode)) {
        throw new Error("The synthetic LINE link flow did not show a six-character code");
      }
      await expect(
        lineSection.getByText(englishCopy.settings.lineAccountUnavailable, { exact: true }),
      ).toBeVisible();
      const savedLineCode = await fixture.admin
        .from("user_profiles")
        .select("line_link_code, line_link_code_expires_at, line_user_id")
        .eq("id", fixture.id)
        .single();
      expect(savedLineCode.error).toBeNull();
      if (savedLineCode.data?.line_link_code !== displayedCode) {
        throw new Error("The LINE link code was not persisted to the synthetic profile");
      }
      expect(Boolean(savedLineCode.data?.line_link_code_expires_at)).toBe(true);
      expect(savedLineCode.data?.line_user_id).toBeNull();
      exercised.push({
        locale: "en",
        viewport: 1440,
        route: "/settings",
        control: "request a LINE link code for the synthetic account",
        result:
          "the six-digit code and expiry persisted on the fixture profile; LINE remains unavailable",
      });
      expect(pageErrors).toEqual([]);
    } finally {
      page.off("pageerror", onPageError);
      try {
        await writeExerciseLedger(
          "control-exercise-ledger-settings-provider-availability.json",
          testInfo.project.name,
          exercised,
          pageErrors,
        );
      } finally {
        await cleanupFixture(fixture);
      }
    }
  });

  test("Settings sign-out returns the synthetic account to login", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chrome", "Sign-out runs once in desktop Chrome.");
    test.setTimeout(3 * 60_000);

    const fixture = await createFixture(page);
    const exercised: ExercisedControl[] = [];
    const pageErrors: string[] = [];
    const onPageError = (error: Error) => pageErrors.push(error.message);
    page.on("pageerror", onPageError);

    try {
      const locale = "en" as const;
      const copy = interactionCopy[locale];
      await setLocale(page.context(), locale);
      await page.setViewportSize({ width: 1440, height: 960 });
      await page.goto("/settings");
      await page.getByRole("button", { name: copy.settings.signOut, exact: true }).click();
      await expect(page).toHaveURL(/\/login(?:\?|$)/);
      await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
      exercised.push({
        locale,
        viewport: 1440,
        route: "/settings → /login",
        control: "sign out from Settings",
        result: "the synthetic account session ended and login rendered",
      });
      expect(pageErrors).toEqual([]);
    } finally {
      page.off("pageerror", onPageError);
      try {
        await writeExerciseLedger(
          "control-exercise-ledger-settings-signout.json",
          testInfo.project.name,
          exercised,
          pageErrors,
        );
      } finally {
        await cleanupFixture(fixture);
      }
    }
  });

  test("Shell controls open and close menus and responsive navigation destinations", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chrome",
      "Shell controls run once in desktop Chrome.",
    );
    test.setTimeout(5 * 60_000);

    const fixture = await createFixture(page);
    const exercised: ExercisedControl[] = [];
    const pageErrors: string[] = [];
    const onPageError = (error: Error) => pageErrors.push(error.message);
    page.on("pageerror", onPageError);

    try {
      const pageDestinations: Record<Locale, Array<{ label: string; href: string }>> = {
        en: [
          { label: "Today", href: "/today" },
          { label: "Inbox", href: "/inbox" },
          { label: "Tasks", href: "/tasks" },
          { label: "Plan", href: "/plan" },
          { label: "Calendar", href: "/calendar" },
          { label: "Goals", href: "/goals" },
          { label: "Finance", href: "/finance" },
          { label: "Life", href: "/life" },
          { label: "Reviews", href: "/reviews" },
          { label: "Insights", href: "/insights" },
        ],
        th: [
          { label: "วันนี้", href: "/today" },
          { label: "กล่องเข้า", href: "/inbox" },
          { label: "งาน", href: "/tasks" },
          { label: "แผน", href: "/plan" },
          { label: "ปฏิทิน", href: "/calendar" },
          { label: "เป้าหมาย", href: "/goals" },
          { label: "การเงิน", href: "/finance" },
          { label: "ชีวิต", href: "/life" },
          { label: "ทบทวน", href: "/reviews" },
          { label: "วิเคราะห์", href: "/insights" },
        ],
      };
      for (const locale of ["en", "th"] as const) {
        const copy = interactionCopy[locale];
        await setLocale(page.context(), locale);
        for (const viewport of viewports) {
          await page.setViewportSize(viewport);
          await page.goto("/today");

          const header = page.locator("header");
          const userMenu = header.getByRole("button", { name: copy.a11y.userMenu, exact: true });
          await userMenu.click();
          await expect(
            page.getByRole("menuitem", { name: copy.settings.signOut, exact: true }),
          ).toBeVisible();
          await page.keyboard.press("Escape");
          await expect(page.getByRole("menu")).toHaveCount(0);

          if (viewport.width >= 640) {
            const notifications = header.getByRole("button", {
              name: copy.nav.notifications,
              exact: true,
            });
            await notifications.click();
            await expect(
              page.getByRole("menuitem", { name: copy.notifications.lineNotLinked, exact: true }),
            ).toBeVisible();
            await page.keyboard.press("Escape");
            await expect(page.getByRole("menu")).toHaveCount(0);
          } else {
            await expect(
              header.getByRole("button", { name: copy.nav.notifications, exact: true }),
            ).toHaveCount(0);
          }

          if (viewport.width > 1150) {
            const sidebar = page.locator("aside");
            const collapseButton = sidebar.getByRole("button", {
              name: copy.nav.collapse,
              exact: true,
            });
            await collapseButton.click();
            await expect(
              sidebar.getByRole("button", { name: copy.nav.expand, exact: true }),
            ).toHaveAttribute("aria-expanded", "false");
            await page.reload();
            await expect(
              sidebar.getByRole("button", { name: copy.nav.expand, exact: true }),
            ).toHaveAttribute("aria-expanded", "false");
            await sidebar.getByRole("button", { name: copy.nav.expand, exact: true }).click();
            await expect(
              sidebar.getByRole("button", { name: copy.nav.collapse, exact: true }),
            ).toHaveAttribute("aria-expanded", "true");

            const mainNavigation = sidebar.getByRole("navigation", {
              name: copy.a11y.mainNav,
              exact: true,
            });
            for (const destination of pageDestinations[locale]) {
              const destinationLink = mainNavigation.locator(`a[href="${destination.href}"]`);
              await expect(destinationLink).toHaveCount(1);
              await expect(destinationLink).toHaveAccessibleName(
                destination.href === "/tasks"
                  ? new RegExp(`^${destination.label}(?: \\(\\d+\\))?$`)
                  : destination.label,
              );
            }
            const destinationHrefs = await mainNavigation
              .getByRole("link")
              .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
            expect(destinationHrefs.length).toBeGreaterThanOrEqual(pageDestinations[locale].length);
            expect(destinationHrefs.length).toBeLessThanOrEqual(pageDestinations[locale].length + 1);
            expect(new Set(destinationHrefs).size).toBe(destinationHrefs.length);
            await expect(mainNavigation.getByRole("button")).toHaveCount(0);
            await expect(mainNavigation.locator('a[aria-current="page"]')).toHaveCount(1);
            await expect(mainNavigation.locator('a[aria-current="page"]')).toHaveAttribute(
              "href",
              "/today",
            );
            exercised.push({
              locale,
              viewport: viewport.width,
              route: "/today",
              control: "collapse/expand sidebar and inspect unique page navigation",
              result: "collapsed state survived reload and each destination has one route link",
            });
          } else {
            await header.getByRole("button", { name: copy.common.menu, exact: true }).click();
            const drawer = page.getByRole("dialog");
            const drawerNavigation = drawer.getByRole("navigation", {
              name: copy.a11y.mainNav,
              exact: true,
            });
            await expect(drawerNavigation).toBeVisible();
            await expect(
              drawerNavigation.getByRole("link", { name: copy.nav.tasks, exact: true }),
            ).toBeVisible();
            await page.keyboard.press("Escape");
            await expect(page.getByRole("dialog")).toHaveCount(0);
            exercised.push({
              locale,
              viewport: viewport.width,
              route: "/today",
              control: "open and dismiss the mobile navigation drawer",
              result: "drawer navigation and a task destination were visible, then dismissed",
            });
          }
          expect(await viewportMetrics(page)).toMatchObject({
            scrollWidth: viewport.width,
            viewportWidth: viewport.width,
          });
        }
      }
      expect(pageErrors).toEqual([]);
    } finally {
      page.off("pageerror", onPageError);
      try {
        await writeExerciseLedger(
          "control-exercise-ledger-shell-controls.json",
          testInfo.project.name,
          exercised,
          pageErrors,
        );
      } finally {
        await cleanupFixture(fixture);
      }
    }
  });

  test("Habit completion toggles persist for the synthetic habit", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chrome",
      "Responsive habit actions run once in desktop Chrome.",
    );
    test.setTimeout(5 * 60_000);

    const fixture = await createFixture(page);
    const exercised: ExercisedControl[] = [];
    const pageErrors: string[] = [];
    const onPageError = (error: Error) => pageErrors.push(error.message);
    page.on("pageerror", onPageError);

    try {
      const today = todayInBangkok();
      for (const locale of ["en", "th"] as const) {
        const copy = interactionCopy[locale];
        await setLocale(page.context(), locale);
        for (const width of [1440, 390]) {
          await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
          await page.goto("/life");
          const habitRow = page.getByRole("listitem").filter({ hasText: fixture.habitTitle });
          await expect(habitRow).toBeVisible();
          await habitRow
            .getByRole("button", { name: copy.habits.toggle(fixture.habitTitle), exact: true })
            .click();
          await expect(page.getByText(copy.habits.completed, { exact: true })).toBeVisible();

          const completed = await fixture.admin
            .from("habit_completions")
            .select("id")
            .eq("user_id", fixture.id)
            .eq("habit_id", fixture.habitId)
            .eq("completed_on", today);
          expect(completed.error).toBeNull();
          expect(completed.data).toHaveLength(1);
          await page.reload();
          const afterReload = await fixture.admin
            .from("habit_completions")
            .select("id")
            .eq("user_id", fixture.id)
            .eq("habit_id", fixture.habitId)
            .eq("completed_on", today);
          expect(afterReload.data).toHaveLength(1);

          await page
            .getByRole("listitem")
            .filter({ hasText: fixture.habitTitle })
            .getByRole("button", { name: copy.habits.toggle(fixture.habitTitle), exact: true })
            .click();
          await expect(page.getByText(copy.habits.uncompleted, { exact: true })).toBeVisible();
          const incomplete = await fixture.admin
            .from("habit_completions")
            .select("id")
            .eq("user_id", fixture.id)
            .eq("habit_id", fixture.habitId)
            .eq("completed_on", today);
          expect(incomplete.error).toBeNull();
          expect(incomplete.data).toHaveLength(0);
          exercised.push({
            locale,
            viewport: width,
            route: "/life",
            control: "mark habit complete, reload, then mark incomplete",
            result:
              "completion row appeared, survived reload, and was removed by the second toggle",
          });
        }
      }
      expect(pageErrors).toEqual([]);
    } finally {
      page.off("pageerror", onPageError);
      try {
        await writeExerciseLedger(
          "control-exercise-ledger-habit-completion.json",
          testInfo.project.name,
          exercised,
          pageErrors,
        );
      } finally {
        await cleanupFixture(fixture);
      }
    }
  });
});
