import { createBrowserClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import type { Database } from "@/types/database";
import { signInAndApproveFixtureSession } from "@/integration/support/auth";

type DbClient = SupabaseClient<Database>;
type Locale = "th" | "en";
type FixtureIdentity = {
  admin: DbClient;
  id: string;
  email: string;
  seededReleaseIds: string[];
  authCookies: AuthCookie[];
};
type AuthCookie = { name: string; value: string; url: string };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const password = "Kemtit-feedback-e2e-Local-Only-1!";
const userMenuName: Record<Locale, string> = { th: "เมนูผู้ใช้", en: "User menu" };
const feedbackOpenName: Record<Locale, string> = { th: "ส่งความคิดเห็น", en: "Send feedback" };
const feedbackTitle: Record<Locale, string> = { th: "ส่งความคิดเห็น", en: "Send feedback" };
const feedbackSuccess: Record<Locale, string> = {
  th: "ขอบคุณสำหรับความคิดเห็น",
  en: "Thanks for your feedback",
};
const rateLimitCopy: Record<Locale, string> = {
  th: "ส่งความคิดเห็นไปแล้วเมื่อไม่นานนี้ ลองใหม่อีกครั้งภายหลัง",
  en: "You've already sent feedback recently. Try again shortly.",
};
const topicLabels: Record<Locale, string[]> = {
  th: ["ใช้งานง่าย", "ใช้งานยาก", "ระบบช้า", "พบข้อผิดพลาด", "อยากได้ฟีเจอร์เพิ่ม"],
  en: [
    "Easy to use",
    "Hard to use",
    "Slow performance",
    "Encountered an error",
    "Want more features",
  ],
};
const updatesTitle: Record<Locale, string> = { th: "มีอะไรใหม่", en: "What's new" };
const acknowledgeName: Record<Locale, string> = { th: "รับทราบ", en: "Mark as read" };
const captureTitle = "บันทึกด่วน";
const captureDraft = "ตรวจสอบหน้าแผนงานก่อนประชุม";

function requireLocalSupabase() {
  let hostname = "";
  try {
    hostname = new URL(supabaseUrl).hostname;
  } catch {
    throw new Error("Feedback release E2E requires a local Supabase URL");
  }
  if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(hostname)) {
    throw new Error("Feedback release E2E can only create data in local Supabase");
  }
  if (!anonKey || !serviceRoleKey) {
    throw new Error("Feedback release E2E requires local Supabase credentials");
  }
}

function createAdminClient(): DbClient {
  requireLocalSupabase();
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      storageKey: "kemtit-feedback-e2e-admin-" + randomUUID(),
    },
  });
}

function createAnonClient(): DbClient {
  return createClient<Database>(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      storageKey: "kemtit-feedback-e2e-user-" + randomUUID(),
    },
  });
}

async function addApprovedSessionCookies(
  page: Page,
  session: {
    access_token: string;
    refresh_token: string;
  },
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
    throw new Error("Approved fixture session could not be prepared for the browser");
  }

  const baseURL = test.info().project.use.baseURL;
  if (typeof baseURL !== "string") throw new Error("Playwright baseURL is unavailable");
  const cookies = Array.from(cookieJar, ([name, value]) => ({ name, value, url: baseURL }));
  await page.context().addCookies(cookies);
  return cookies;
}

async function createApprovedFixture(page: Page): Promise<FixtureIdentity> {
  const admin = createAdminClient();
  const idempotentEmail = "feedback-e2e-" + randomUUID() + "@kemtit.test";
  const { data, error } = await admin.auth.admin.createUser({
    email: idempotentEmail,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error("Local feedback E2E user could not be created");
  }

  const fixture: FixtureIdentity = {
    admin,
    id: data.user.id,
    email: idempotentEmail,
    seededReleaseIds: [],
    authCookies: [],
  };

  try {
    const { error: profileError } = await admin
      .from("user_profiles")
      .update({
        display_name: "Feedback E2E",
        role_code: "seller",
        focus_areas: ["work"],
        default_scope: "work",
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq("id", fixture.id);
    if (profileError) throw new Error("Feedback E2E profile could not be prepared");

    const authClient = createAnonClient();
    const approved = await signInAndApproveFixtureSession(authClient, admin, {
      email: fixture.email,
      password,
      userId: fixture.id,
    });
    fixture.authCookies = await addApprovedSessionCookies(page, approved.session);
    return fixture;
  } catch (error) {
    await cleanupFixture(fixture);
    throw error;
  }
}

async function cleanupFixture(fixture: FixtureIdentity) {
  const cleanupErrors: string[] = [];
  if (fixture.seededReleaseIds.length > 0) {
    const { error } = await fixture.admin
      .from("release_note_reads")
      .delete()
      .eq("user_id", fixture.id)
      .in("release_note_id", fixture.seededReleaseIds);
    if (error) cleanupErrors.push("release reads");
  }
  const { error: feedbackError } = await fixture.admin
    .from("user_feedback")
    .delete()
    .eq("user_id", fixture.id);
  if (feedbackError) cleanupErrors.push("feedback");
  const { error: userError } = await fixture.admin.auth.admin.deleteUser(fixture.id);
  if (userError) cleanupErrors.push("auth user");
  if (fixture.seededReleaseIds.length > 0) {
    const { error } = await fixture.admin
      .from("release_notes")
      .delete()
      .in("id", fixture.seededReleaseIds);
    if (error) cleanupErrors.push("synthetic releases");
  }
  if (cleanupErrors.length > 0)
    throw new Error("Feedback E2E cleanup failed: " + cleanupErrors.join(", "));
}

async function setLocale(page: Page, locale: Locale) {
  const baseURL = test.info().project.use.baseURL;
  if (typeof baseURL !== "string") throw new Error("Playwright baseURL is unavailable");
  await page
    .context()
    .addCookies([{ name: "KEMTIT_LOCALE", value: locale, url: baseURL, sameSite: "Lax" }]);
}

async function openFeedbackFromProfile(page: Page, locale: Locale) {
  await page.getByRole("button", { name: userMenuName[locale], exact: true }).click();
  await page.getByRole("menuitem", { name: feedbackOpenName[locale], exact: true }).click();
}

async function openFeedbackFromSettings(page: Page, locale: Locale) {
  await page.goto("/settings");
  await page.getByRole("button", { name: feedbackOpenName[locale], exact: true }).click();
}

async function expectFreshFeedbackDialog(page: Page, locale: Locale) {
  const dialog = page.getByRole("dialog", { name: feedbackTitle[locale], exact: true });
  await expect(dialog).toHaveCount(1);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("radio")).toHaveCount(5);
  await expect(dialog.locator("textarea")).toHaveCount(0);
  for (const radio of await dialog.getByRole("radio").all()) {
    await expect(radio).not.toBeChecked();
  }
  await expect(dialog.getByTestId("feedback-submit")).toBeDisabled();
  return dialog;
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
}

async function saveQaScreenshot(page: Page, filename: string) {
  const screenshotDirectory = resolve(process.cwd(), "docs/qa/feedback-releases/screenshots");
  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: resolve(screenshotDirectory, filename),
    fullPage: false,
    animations: "disabled",
  });
}

test.describe("Feedback and release notes in a real browser", () => {
  let fixture: FixtureIdentity | null = null;
  const extraFixtures: FixtureIdentity[] = [];
  const extraContexts: Array<{ close: () => Promise<void> }> = [];

  test.beforeEach(async ({ page }) => {
    fixture = await createApprovedFixture(page);
  });

  test.afterEach(async () => {
    const cleanupErrors: unknown[] = [];
    for (const identity of [...extraFixtures, ...(fixture ? [fixture] : [])]) {
      try {
        await cleanupFixture(identity);
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    for (const context of extraContexts) {
      try {
        await context.close();
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    extraFixtures.length = 0;
    extraContexts.length = 0;
    fixture = null;
    if (cleanupErrors.length > 0)
      throw new Error("One or more feedback E2E fixtures could not be cleaned");
  });

  for (const locale of ["th", "en"] as const) {
    for (const width of [1440, 768, 390, 360] as const) {
      test(
        "feedback dialog is accessible at " + width + "px (" + locale + ")",
        async ({ page }) => {
          await page.setViewportSize({ width, height: width >= 768 ? 960 : 844 });
          await setLocale(page, locale);
          await page.goto("/settings");

          if (width === 1440 || width === 390) {
            await page.goto("/today");
            await openFeedbackFromProfile(page, locale);
          } else {
            await openFeedbackFromSettings(page, locale);
          }

          const dialog = await expectFreshFeedbackDialog(page, locale);
          await expectNoHorizontalOverflow(page);
          await saveQaScreenshot(page, "feedback-" + locale + "-" + width + ".png");

          if (width === 768 && locale === "th") {
            for (let index = 0; index < 8; index += 1) {
              await page.keyboard.press("Tab");
              await expect
                .poll(() =>
                  page.evaluate(() => {
                    const active = document.activeElement;
                    return (
                      active instanceof HTMLElement && active.closest('[role="dialog"]') !== null
                    );
                  }),
                )
                .toBe(true);
            }
            await page.keyboard.press("Escape");
            await expect(dialog).toHaveCount(0);
            await expect(
              page.getByRole("button", { name: feedbackOpenName[locale], exact: true }),
            ).toBeFocused();
            await page.getByRole("button", { name: feedbackOpenName[locale], exact: true }).click();
            await expectFreshFeedbackDialog(page, locale);
          }

          if (width === 390 && locale === "en") {
            await dialog.getByRole("radio", { name: "Hard to use", exact: true }).check();
            await expect(
              dialog.getByRole("radio", { name: "Hard to use", exact: true }),
            ).toBeChecked();
            await page.setViewportSize({ width: 768, height: 960 });
            const desktopDialog = page.getByRole("dialog", {
              name: feedbackTitle[locale],
              exact: true,
            });
            await expect(desktopDialog).toHaveCount(1);
            await expect(
              desktopDialog.getByRole("radio", { name: "Hard to use", exact: true }),
            ).toBeChecked();
            await page.setViewportSize({ width: 390, height: 844 });
            await expect(
              page.getByRole("dialog", { name: feedbackTitle[locale], exact: true }),
            ).toHaveCount(1);
            await expect(
              page
                .getByRole("dialog", { name: feedbackTitle[locale], exact: true })
                .getByRole("radio", {
                  name: "Hard to use",
                  exact: true,
                }),
            ).toBeChecked();
          }

          const radioLabels = topicLabels[locale];
          await expect(
            page
              .getByRole("dialog", { name: feedbackTitle[locale], exact: true })
              .getByRole("radio"),
          ).toHaveCount(radioLabels.length);
          const { data: rows, error } = await fixture!.admin
            .from("user_feedback")
            .select("id")
            .eq("user_id", fixture!.id);
          expect(error).toBeNull();
          expect(rows).toHaveLength(0);
        },
      );
    }
  }

  test.describe("lost-response fault injection", () => {
    test.use({ serviceWorkers: "block" });

    test("feedback persists once after a lost response and keeps the same request on retry", async ({
      page,
    }) => {
      const identity = fixture!;
      await page.setViewportSize({ width: 390, height: 844 });
      await setLocale(page, "en");
      await page.goto("/settings");
      await openFeedbackFromSettings(page, "en");
      let dialog = await expectFreshFeedbackDialog(page, "en");
      const selectedTopic = dialog.getByRole("radio", { name: "Easy to use", exact: true });
      await selectedTopic.check();

      let actionResponseStatus: number | null = null;
      let lostActionResponse = false;
      let feedbackActionRequestCount = 0;
      let feedbackActionFetched = false;
      await page.route("**/*", async (route) => {
        const request = route.request();
        const requestBody = request.postData() ?? "";
        const isFeedbackSubmit =
          request.method() === "POST" &&
          Boolean(request.headers()["next-action"]) &&
          requestBody.includes("easy_to_use");
        if (isFeedbackSubmit) {
          feedbackActionRequestCount += 1;
          lostActionResponse = true;
          // Submit once to commit; abort any automatic replay before it reaches the server.
          if (!feedbackActionFetched) {
            feedbackActionFetched = true;
            const response = await route.fetch({ maxRetries: 0 });
            actionResponseStatus = response.status();
          }
          await route.abort("connectionreset");
          return;
        }
        await route.continue();
      });

      await dialog.getByTestId("feedback-submit").click();
      await expect.poll(() => feedbackActionRequestCount).toBeGreaterThanOrEqual(1);
      await expect(dialog.getByRole("alert")).toContainText(
        "We couldn't confirm whether this feedback was saved",
      );
      expect(lostActionResponse).toBe(true);
      expect(feedbackActionRequestCount).toBeGreaterThanOrEqual(1);
      expect(feedbackActionFetched).toBe(true);
      expect(actionResponseStatus).toBe(200);
      await expect(selectedTopic).toBeChecked();

      const pendingBeforeRetry = await page.evaluate((userId) => {
        const value = sessionStorage.getItem("kemtit:pending-feedback:v1:" + userId);
        return value ? (JSON.parse(value) as { requestId?: string; topicCode?: string }) : null;
      }, identity.id);
      expect(pendingBeforeRetry).toMatchObject({ topicCode: "easy_to_use" });

      const committedBeforeRetry = await identity.admin
        .from("user_feedback")
        .select("id, request_id, topic_code")
        .eq("user_id", identity.id);
      expect(committedBeforeRetry.error).toBeNull();
      expect(committedBeforeRetry.data).toHaveLength(1);
      expect(committedBeforeRetry.data?.[0].request_id).toBe(pendingBeforeRetry?.requestId);
      expect(committedBeforeRetry.data?.[0].topic_code).toBe("easy_to_use");

      await page.getByRole("button", { name: "Close", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await page.reload();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.getByRole("button", { name: feedbackOpenName.en, exact: true }).click();
      dialog = page.getByRole("dialog", { name: feedbackTitle.en, exact: true });
      await expect(dialog).toHaveCount(1);
      await expect(dialog.getByRole("radio", { name: "Easy to use", exact: true })).toBeChecked();
      const pendingAfterReopen = await page.evaluate((userId) => {
        const value = sessionStorage.getItem("kemtit:pending-feedback:v1:" + userId);
        return value ? (JSON.parse(value) as { requestId?: string; topicCode?: string }) : null;
      }, identity.id);
      expect(pendingAfterReopen).toEqual(pendingBeforeRetry);

      await page.unroute("**/*");
      await dialog.getByTestId("feedback-submit").click();
      await expect(
        page.getByRole("heading", { name: feedbackSuccess.en, exact: true }),
      ).toBeVisible();
      const rowsAfterRetry = await identity.admin
        .from("user_feedback")
        .select("id, request_id, topic_code")
        .eq("user_id", identity.id);
      expect(rowsAfterRetry.error).toBeNull();
      expect(rowsAfterRetry.data).toHaveLength(1);
      expect(rowsAfterRetry.data?.[0].request_id).toBe(pendingBeforeRetry?.requestId);

      await page
        .getByRole("dialog", { name: feedbackSuccess.en, exact: true })
        .getByTestId("feedback-success")
        .getByRole("button", { name: "Close", exact: true })
        .click();
      await expect(dialog).toHaveCount(0);
      await openFeedbackFromProfile(page, "en");
      dialog = await expectFreshFeedbackDialog(page, "en");
      await dialog.getByRole("radio", { name: "Slow performance", exact: true }).check();
      await dialog.getByTestId("feedback-submit").click();
      await expect(dialog.getByRole("alert")).toHaveText(rateLimitCopy.en);
      await expect(
        dialog.getByRole("radio", { name: "Slow performance", exact: true }),
      ).toBeChecked();
      const rowsAfterQuota = await identity.admin
        .from("user_feedback")
        .select("id")
        .eq("user_id", identity.id);
      expect(rowsAfterQuota.error).toBeNull();
      expect(rowsAfterQuota.data).toHaveLength(1);
    });
  });

  test("release notes hide drafts and future items and persist acknowledgement by account", async ({
    page,
    browser,
  }) => {
    const identity = fixture!;
    const token = randomUUID().slice(0, 8);
    const now = Date.now();
    const rows = [
      {
        version: token + "-2.0",
        build_id: "feedback-e2e-" + token,
        title_th: "ข่าวทดสอบล่าสุด " + token,
        title_en: "Latest synthetic release " + token,
        new_items_th: ["รายการเพิ่มใหม่ " + token],
        new_items_en: ["New item " + token],
        improved_items_th: ["รายการปรับปรุง " + token],
        improved_items_en: ["Improvement " + token],
        fixed_items_th: ["รายการแก้ไข " + token],
        fixed_items_en: ["Fix " + token],
        published_at: new Date(now - 60_000).toISOString(),
      },
      {
        version: token + "-1.9",
        build_id: "feedback-e2e-" + token,
        title_th: "ข่าวทดสอบเก่า " + token,
        title_en: "Older synthetic release " + token,
        new_items_th: ["รายการเก่า"],
        new_items_en: ["Older item"],
        improved_items_th: [],
        improved_items_en: [],
        fixed_items_th: [],
        fixed_items_en: [],
        published_at: new Date(now - 86_400_000).toISOString(),
      },
      {
        version: token + "-draft",
        build_id: "feedback-e2e-" + token,
        title_th: "ฉบับร่าง " + token,
        title_en: "Draft release " + token,
        new_items_th: ["ร่าง"],
        new_items_en: ["Draft item"],
        improved_items_th: [],
        improved_items_en: [],
        fixed_items_th: [],
        fixed_items_en: [],
        published_at: null,
      },
      {
        version: token + "-future",
        build_id: "feedback-e2e-" + token,
        title_th: "ข่าวสารในอนาคต " + token,
        title_en: "Future release " + token,
        new_items_th: ["ยังไม่ถึงเวลา"],
        new_items_en: ["Not available yet"],
        improved_items_th: [],
        improved_items_en: [],
        fixed_items_th: [],
        fixed_items_en: [],
        published_at: new Date(now + 86_400_000).toISOString(),
      },
    ];
    const { data: seeded, error: seedError } = await identity.admin
      .from("release_notes")
      .insert(rows)
      .select("id, version");
    if (seedError || !seeded || seeded.length !== rows.length) {
      throw new Error("Synthetic local release notes could not be seeded");
    }
    identity.seededReleaseIds.push(...seeded.map((row) => row.id));
    const latest = seeded.find((row) => row.version === token + "-2.0");
    const older = seeded.find((row) => row.version === token + "-1.9");
    const draft = seeded.find((row) => row.version === token + "-draft");
    const future = seeded.find((row) => row.version === token + "-future");
    expect(latest && older && draft && future).toBeTruthy();

    for (const locale of ["th", "en"] as const) {
      for (const width of [1440, 768, 390, 360] as const) {
        await page.setViewportSize({ width, height: width >= 768 ? 960 : 844 });
        await setLocale(page, locale);
        await page.goto("/updates");
        await expect(
          page.getByRole("heading", { name: updatesTitle[locale], exact: true }),
        ).toBeVisible();
        const latestCard = page.getByTestId("release-note-" + latest!.id);
        const olderCard = page.getByTestId("release-note-" + older!.id);
        await expect(latestCard).toBeVisible();
        await expect(olderCard).toBeVisible();
        await expect(latestCard).toContainText(
          locale === "th" ? "ข่าวทดสอบล่าสุด " + token : "Latest synthetic release " + token,
        );
        await expect(latestCard.getByTestId("updates-unread-marker")).toBeVisible();
        await expect(page.getByTestId("release-note-" + draft!.id)).toHaveCount(0);
        await expect(page.getByTestId("release-note-" + future!.id)).toHaveCount(0);
        await expect(page.getByText("ฉบับร่าง " + token, { exact: true })).toHaveCount(0);
        await expect(page.getByText("Draft release " + token, { exact: true })).toHaveCount(0);
        await expect(page.getByText("ข่าวสารในอนาคต " + token, { exact: true })).toHaveCount(0);
        await expect(page.getByText("Future release " + token, { exact: true })).toHaveCount(0);
        await expectNoHorizontalOverflow(page);
        await saveQaScreenshot(page, "updates-list-" + locale + "-" + width + ".png");

        await latestCard.getByRole("link").click();
        await expect(page).toHaveURL(new RegExp("/updates/" + latest!.id + "$"));
        await expect(page.getByTestId("release-note-detail")).toContainText(
          locale === "th" ? "รายการเพิ่มใหม่ " + token : "New item " + token,
        );
        await expect(page.getByTestId("release-note-detail")).toContainText(
          locale === "th" ? "รายการปรับปรุง " + token : "Improvement " + token,
        );
        await expect(page.getByTestId("release-note-detail")).toContainText(
          locale === "th" ? "รายการแก้ไข " + token : "Fix " + token,
        );
        await expect(page.getByTestId("release-note-acknowledge")).toHaveCount(1);
        await expect(page.getByTestId("release-note-acknowledge")).toBeVisible();
        await expect(page.getByTestId("release-note-acknowledge")).toHaveText(
          acknowledgeName[locale],
        );
        await expectNoHorizontalOverflow(page);
        await saveQaScreenshot(page, "updates-detail-" + locale + "-" + width + ".png");
      }
    }

    const otherAccountContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: "th-TH",
    });
    extraContexts.push(otherAccountContext);
    const otherAccountPage = await otherAccountContext.newPage();
    const otherAccount = await createApprovedFixture(otherAccountPage);
    extraFixtures.push(otherAccount);
    await setLocale(otherAccountPage, "th");
    await otherAccountPage.goto("/updates");
    await expect(
      otherAccountPage
        .getByTestId("release-note-" + latest!.id)
        .getByTestId("updates-unread-marker"),
    ).toBeVisible();

    await setLocale(page, "th");
    await page.goto("/updates/" + latest!.id);
    await page.getByTestId("release-note-acknowledge").click();
    await expect(page.getByTestId("release-note-acknowledged")).toBeVisible();
    const reads = await identity.admin
      .from("release_note_reads")
      .select("user_id, release_note_id, read_at")
      .eq("user_id", identity.id)
      .eq("release_note_id", latest!.id);
    expect(reads.error).toBeNull();
    expect(reads.data).toHaveLength(1);
    expect(reads.data?.[0].read_at).toBeTruthy();

    await otherAccountPage.reload();
    await expect(
      otherAccountPage
        .getByTestId("release-note-" + latest!.id)
        .getByTestId("updates-unread-marker"),
    ).toBeVisible();

    const otherDeviceContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: "th-TH",
    });
    extraContexts.push(otherDeviceContext);
    await otherDeviceContext.addCookies(identity.authCookies);
    const otherDevicePage = await otherDeviceContext.newPage();
    await setLocale(otherDevicePage, "th");
    await otherDevicePage.goto("/updates/" + latest!.id);
    await expect(otherDevicePage.getByTestId("release-note-acknowledged")).toBeVisible();
    await expect(otherDevicePage.getByTestId("release-note-acknowledge")).toHaveCount(0);

    await page.goto("/updates");
    await expect(
      page.getByTestId("release-note-" + latest!.id).getByTestId("updates-unread-marker"),
    ).toHaveCount(0);
    await page.goto("/updates/" + draft!.id);
    expect(page.url()).toContain("/updates/" + draft!.id);
    await expect(page.getByTestId("release-note-detail")).toHaveCount(0);
    await expect(page.getByText("ฉบับร่าง " + token, { exact: true })).toHaveCount(0);
    await page.goto("/updates/" + future!.id);
    await expect(page.getByTestId("release-note-detail")).toHaveCount(0);
    await expect(page.getByText("ข่าวสารในอนาคต " + token, { exact: true })).toHaveCount(0);
  });

  test("Quick Capture keeps its draft through a mobile resize before feedback opens normally", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await setLocale(page, "th");
    await page.goto("/today?scope=work");
    await page
      .getByRole("banner")
      .getByRole("button", { name: "เปิดเมนูเพิ่ม", exact: true })
      .click();

    const capture = page.getByRole("dialog", { name: captureTitle, exact: true });
    await expect(capture).toHaveCount(1);
    const captureInput = capture.getByLabel("คุณอยากเพิ่มอะไร");
    await captureInput.fill(captureDraft);
    await expect(page).toHaveURL(/scope=work/);
    await expect(page).toHaveURL(/capture=1/);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await expect(captureInput).toHaveValue(captureDraft);
    await expect(page.getByRole("dialog", { name: feedbackTitle.th, exact: true })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    await capture.getByRole("button", { name: "ปิด", exact: true }).click();
    await expect(capture).toHaveCount(0);
    await expect(page).not.toHaveURL(/capture=1/);
    await openFeedbackFromProfile(page, "th");
    await expectFreshFeedbackDialog(page, "th");
  });
});
