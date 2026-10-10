import { createBrowserClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

import { signInAndApproveFixtureSession } from "@/integration/support/auth";
import { todayBkk } from "@/lib/date";
import type { Database } from "@/types/database";

type DbClient = SupabaseClient<Database>;
type Locale = "en" | "th";
type PageDestination = { label: string; href: string };
type SidebarFixture = {
  admin: DbClient;
  authClient: DbClient;
  userId: string;
  baseURL: string;
};

const localHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const fixturePassword = "Kemtit-sidebar-navigation-QA-1!";
const english = {
  mainNavigation: "Main navigation",
  collapse: "Collapse menu",
  expand: "Expand menu",
  scope: { area: "Scope", all: "All", work: "Work", life: "Life" },
  pages: {
    today: "Today",
    inbox: "Inbox",
    tasks: "Tasks",
    projects: "Projects",
    sales: "Sales",
    plan: "Plan",
    calendar: "Calendar",
    goals: "Goals",
    finance: "Finance",
    life: "Life",
    reviews: "Reviews",
    insights: "Insights",
  },
  planView: { label: "Plan view", month: "Month" },
  calendarView: { label: "View", week: "Week" },
  insightsView: { label: "Report type", productivity: "Productivity" },
};
const thai = {
  mainNavigation: "เมนูหลัก",
  collapse: "พับเมนู",
  expand: "ขยายเมนู",
  scope: { area: "ขอบเขต", all: "ทั้งหมด", work: "งาน", life: "ชีวิต" },
  pages: {
    today: "วันนี้",
    inbox: "กล่องเข้า",
    tasks: "งาน",
    projects: "โปรเจกต์",
    sales: "ยอดขาย",
    plan: "แผน",
    calendar: "ปฏิทิน",
    goals: "เป้าหมาย",
    finance: "การเงิน",
    life: "ชีวิต",
    reviews: "ทบทวน",
    insights: "วิเคราะห์",
  },
  planView: { label: "มุมมองแผน", month: "เดือน" },
  calendarView: { label: "มุมมอง", week: "สัปดาห์" },
  insightsView: { label: "ประเภทรายงาน", productivity: "ประสิทธิภาพ" },
};
const copy = { en: english, th: thai };

function baseURL() {
  const configuredBaseURL = test.info().project.use.baseURL;
  if (typeof configuredBaseURL !== "string") {
    throw new Error("Sidebar E2E requires a local browser base URL");
  }
  const parsedBaseURL = new URL(configuredBaseURL);
  if (!localHosts.has(parsedBaseURL.hostname) || parsedBaseURL.port !== "3200") {
    throw new Error("Sidebar E2E can only use the isolated local QA server on port 3200");
  }
  return configuredBaseURL;
}

function createAdminClient(supabaseUrl: string, serviceRoleKey: string): DbClient {
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      storageKey: `kemtit-sidebar-admin-${randomUUID()}`,
    },
  });
}

function createAuthClient(supabaseUrl: string, anonKey: string): DbClient {
  return createClient<Database>(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      storageKey: `kemtit-sidebar-user-${randomUUID()}`,
    },
  });
}

async function installApprovedSession(page: Page, base: string, session: {
  access_token: string;
  refresh_token: string;
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const cookieJar = new Map<string, string>();
  const cookieClient = createBrowserClient<Database>(supabaseUrl, anonKey, {
    isSingleton: false,
    auth: { autoRefreshToken: false, persistSession: true, detectSessionInUrl: false },
    cookies: {
      getAll() {
        return Array.from(cookieJar, ([name, value]) => ({ name, value }));
      },
      setAll(cookies) {
        for (const cookie of cookies) {
          if (cookie.value) cookieJar.set(cookie.name, cookie.value);
          else cookieJar.delete(cookie.name);
        }
      },
    },
  });
  const { error } = await cookieClient.auth.setSession(session);
  if (error || cookieJar.size === 0) {
    throw error ?? new Error("Approved sidebar fixture session could not be prepared");
  }

  await page.context().addCookies(
    Array.from(cookieJar, ([name, value]) => ({ name, value, url: base, sameSite: "Lax" as const })),
  );
}

async function createFixture(page: Page): Promise<SidebarFixture> {
  const base = baseURL();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Sidebar E2E requires local Supabase credentials");
  }
  const parsedSupabaseURL = new URL(supabaseUrl);
  if (!localHosts.has(parsedSupabaseURL.hostname)) {
    throw new Error("Sidebar E2E can only create data in local Supabase");
  }

  const admin = createAdminClient(supabaseUrl, serviceRoleKey);
  const authClient = createAuthClient(supabaseUrl, anonKey);
  const email = `sidebar-navigation-${randomUUID()}@kemtit.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: fixturePassword,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("Sidebar fixture account could not be created");

  try {
    const { error: profileError } = await admin
      .from("user_profiles")
      .update({
        display_name: "Sidebar navigation QA",
        active_persona: null,
        work_mode: null,
        role_code: "employee",
        focus_areas: ["work"],
        default_scope: "work",
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq("id", data.user.id);
    if (profileError) throw new Error("Sidebar fixture profile could not be prepared");

    const { session } = await signInAndApproveFixtureSession(authClient, admin, {
      email,
      password: fixturePassword,
      userId: data.user.id,
    });
    await installApprovedSession(page, base, session);

    const { error: taskError } = await admin.from("tasks").insert({
      user_id: data.user.id,
      title: "Sidebar navigation fixture task",
      due_date: todayBkk(),
      planned_date: todayBkk(),
      status: "planned",
      priority: "normal",
      estimated_minutes: 30,
      domain: "work",
    });
    if (taskError) throw new Error("Sidebar badge fixture task could not be prepared");

    return { admin, authClient, userId: data.user.id, baseURL: base };
  } catch (error) {
    await admin.auth.admin.deleteUser(data.user.id);
    await authClient.auth.signOut();
    throw error;
  }
}

async function setLocale(page: Page, base: string, locale: Locale) {
  await page.context().addCookies([
    { name: "KEMTIT_LOCALE", value: locale, url: base, sameSite: "Lax" },
  ]);
}

async function cleanupFixture(page: Page, fixture: SidebarFixture) {
  await fixture.authClient.auth.signOut();
  const { error } = await fixture.admin.auth.admin.deleteUser(fixture.userId);
  await page.context().clearCookies();
  if (error) throw new Error("Sidebar navigation fixture account could not be deleted");
}

function pageDestinations(locale: Locale): PageDestination[] {
  const pages = copy[locale].pages;
  const destinations: PageDestination[] = [
    { label: pages.today, href: "/today" },
    { label: pages.inbox, href: "/inbox" },
    { label: pages.tasks, href: "/tasks" },
  ];

  destinations.push(
    { label: pages.plan, href: "/plan" },
    { label: pages.calendar, href: "/calendar" },
    { label: pages.goals, href: "/goals" },
    { label: pages.finance, href: "/finance" },
    { label: pages.life, href: "/life" },
    { label: pages.reviews, href: "/reviews" },
    { label: pages.insights, href: "/insights" },
  );

  return destinations;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("desktop sidebar exposes each page once in English and Thai", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chrome",
    "Sidebar navigation runs once in desktop Chrome.",
  );
  test.setTimeout(5 * 60_000);

  const fixture = await createFixture(page);
  const pageErrors: string[] = [];
  const onPageError = (error: Error) => pageErrors.push(error.message);
  page.on("pageerror", onPageError);

  try {
    await page.setViewportSize({ width: 1440, height: 960 });
    for (const locale of ["en", "th"] as const) {
      await setLocale(page, fixture.baseURL, locale);
      const localeCopy = copy[locale];
      await page.goto("/today?scope=work");

      const sidebar = page.locator("aside").filter({
        has: page.getByRole("navigation", {
          name: localeCopy.mainNavigation,
          exact: true,
        }),
      });
      await expect(sidebar).toBeVisible();
      const navigation = sidebar.getByRole("navigation", {
        name: localeCopy.mainNavigation,
        exact: true,
      });
      const destinations = pageDestinations(locale);
      const hrefs = await navigation.getByRole("link").evaluateAll((links) =>
        links.map((link) => link.getAttribute("href")),
      );

      expect(hrefs).toEqual(destinations.map((item) => item.href));
      expect(new Set(hrefs).size).toBe(hrefs.length);
      for (const destination of destinations) {
        const link = navigation.locator(`a[href="${destination.href}"]`);
        await expect(link).toHaveCount(1);
        await expect(link).toHaveAccessibleName(
          destination.href === "/tasks"
            ? new RegExp(`^${escapeRegExp(destination.label)}(?: \\(\\d+\\))?$`)
            : destination.label,
        );
      }
      await expect(navigation.getByRole("button")).toHaveCount(0);
      await expect(navigation.locator('a[aria-current="page"]')).toHaveCount(1);
      await expect(navigation.locator('a[aria-current="page"]')).toHaveAttribute(
        "href",
        "/today",
      );

      const scopes = sidebar.getByRole("region", { name: localeCopy.scope.area, exact: true });
      await expect(scopes.getByRole("link", { name: localeCopy.scope.work })).toHaveAttribute(
        "aria-current",
        "page",
      );
      const taskLink = navigation.locator('a[href="/tasks"]');
      await expect(taskLink).toHaveAccessibleName(
        new RegExp(`^${escapeRegExp(localeCopy.pages.tasks)} \\(1\\)$`),
      );

      await page.screenshot({
        path: testInfo.outputPath(`sidebar-${locale}-expanded.png`),
        fullPage: true,
        animations: "disabled",
      });

      await sidebar.getByRole("button", { name: localeCopy.collapse, exact: true }).click();
      const expandButton = sidebar.getByRole("button", { name: localeCopy.expand, exact: true });
      await expect(expandButton).toHaveAttribute("aria-expanded", "false");
      for (const destination of destinations) {
        const link = navigation.locator(`a[href="${destination.href}"]`);
        await expect(link).toHaveAttribute("title", destination.label);
        await expect(link).toHaveAccessibleName(
          destination.href === "/tasks"
            ? new RegExp(`^${escapeRegExp(destination.label)} \\(1\\)$`)
            : destination.label,
        );
      }
      const badge = taskLink.locator('span[aria-hidden="true"]').filter({ hasText: "1" });
      await expect(badge).toHaveCount(1);
      const badgeGeometry = await badge.evaluate((element) => {
        const badgeRect = element.getBoundingClientRect();
        const linkRect = element.closest("a")?.getBoundingClientRect();
        return {
          badgeLeft: badgeRect.left,
          badgeRight: badgeRect.right,
          linkLeft: linkRect?.left ?? 0,
          linkRight: linkRect?.right ?? 0,
        };
      });
      expect(badgeGeometry.badgeLeft).toBeGreaterThanOrEqual(badgeGeometry.linkLeft);
      expect(badgeGeometry.badgeRight).toBeLessThanOrEqual(badgeGeometry.linkRight);
      await page.screenshot({
        path: testInfo.outputPath(`sidebar-${locale}-collapsed.png`),
        fullPage: true,
        animations: "disabled",
      });
      await expandButton.click();
      await expect(sidebar.getByRole("button", { name: localeCopy.collapse, exact: true })).toHaveAttribute(
        "aria-expanded",
        "true",
      );

      for (const destination of destinations) {
        const link = navigation.locator(`a[href="${destination.href}"]`);
        await expect(link).toHaveAccessibleName(
          destination.href === "/tasks"
            ? new RegExp(`^${escapeRegExp(destination.label)}(?: \\(\\d+\\))?$`)
            : destination.label,
        );
        await link.click();
        await expect.poll(() => new URL(page.url()).pathname).toBe(destination.href);
        const currentLinks = navigation.locator('a[aria-current="page"]');
        await expect(currentLinks).toHaveCount(1);
        await expect(currentLinks).toHaveAttribute("href", destination.href);
      }

      const planCopy = localeCopy.planView;
      await page.goto("/plan");
      const sidebarNavigation = page.getByRole("navigation", {
        name: localeCopy.mainNavigation,
        exact: true,
      });
      const planNavigation = page.getByRole("navigation", { name: planCopy.label, exact: true });
      await planNavigation.getByRole("link", { name: planCopy.month, exact: true }).click();
      await expect(page).toHaveURL(/\/plan\?.*view=month/);
      await expect(sidebarNavigation.locator('a[href="/plan"]')).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(
        planNavigation.getByRole("link", { name: planCopy.month, exact: true }),
      ).toHaveAttribute("aria-current", "page");

      const calendarCopy = localeCopy.calendarView;
      await page.goto("/calendar");
      const calendarNavigation = page.getByRole("navigation", {
        name: calendarCopy.label,
        exact: true,
      });
      await calendarNavigation
        .getByRole("link", { name: calendarCopy.week, exact: true })
        .click();
      await expect(page).toHaveURL(/\/calendar\?.*view=week/);
      await expect(
        page.getByRole("navigation", { name: localeCopy.mainNavigation, exact: true })
          .locator('a[href="/calendar"]'),
      ).toHaveAttribute("aria-current", "page");
      await expect(
        calendarNavigation.getByRole("link", { name: calendarCopy.week, exact: true }),
      ).toHaveAttribute("aria-current", "page");

      const insightsCopy = localeCopy.insightsView;
      await page.goto("/insights");
      const insightsNavigation = page.getByRole("navigation", {
        name: insightsCopy.label,
        exact: true,
      });
      await insightsNavigation
        .getByRole("link", { name: insightsCopy.productivity, exact: true })
        .click();
      await expect(page).toHaveURL(/\/insights\?tab=productivity/);
      await expect(
        page.getByRole("navigation", { name: localeCopy.mainNavigation, exact: true })
          .locator('a[href="/insights"]'),
      ).toHaveAttribute("aria-current", "page");
      await expect(
        insightsNavigation.getByRole("link", { name: insightsCopy.productivity, exact: true }),
      ).toHaveAttribute("aria-current", "page");
    }

    expect(pageErrors).toEqual([]);
  } finally {
    page.off("pageerror", onPageError);
    await cleanupFixture(page, fixture);
  }
});
