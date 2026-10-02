import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  expect,
  test as base,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";

import { signInWithOtp, uniqueEmail } from "./helpers";

type StorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;

type PrototypeWorkerFixtures = {
  prototypeStorageState: StorageState;
};

function readLocalEnvValue(key: string): string | undefined {
  try {
    const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = envFile.match(new RegExp(`^(?:export\\s+)?${escapedKey}\\s*=\\s*(.*)$`, "m"));
    const value = match?.[1]?.trim();
    if (!value) return undefined;
    return value.replace(/^(?:"([^"]*)"|'([^']*)').*$/, (_whole, doubleQuoted, singleQuoted) =>
      doubleQuoted ?? singleQuoted ?? "",
    );
  } catch {
    return undefined;
  }
}

function assertLoopbackUrl(name: string, value: string | undefined) {
  let parsed: URL;
  try {
    if (!value) throw new Error("missing URL");
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be set to a loopback URL before running prototype auth E2E.`);
  }

  const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (parsed.protocol !== "http:" || !loopbackHosts.has(parsed.hostname)) {
    throw new Error(`${name} must use HTTP on a loopback host before running prototype auth E2E.`);
  }
}

function assertLocalAuthTargets(baseURL: unknown) {
  assertLoopbackUrl("Playwright baseURL", typeof baseURL === "string" ? baseURL : undefined);
  assertLoopbackUrl("MAILPIT_URL", process.env.MAILPIT_URL ?? "http://127.0.0.1:54324");

  const configuredSupabaseUrls = [
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? readLocalEnvValue("NEXT_PUBLIC_SUPABASE_URL"),
    process.env.SUPABASE_URL ?? readLocalEnvValue("SUPABASE_URL"),
  ].filter((value): value is string => Boolean(value));
  if (configuredSupabaseUrls.length === 0) {
    throw new Error("A loopback Supabase URL is required before running prototype auth E2E.");
  }
  configuredSupabaseUrls.forEach((url, index) => assertLoopbackUrl(`Supabase URL ${index + 1}`, url));
}

const test = base.extend<Record<never, never>, PrototypeWorkerFixtures>({
  prototypeStorageState: [
    async ({ browser }, provideFixture, workerInfo) => {
      const configuredBaseURL =
        workerInfo.project.use.baseURL ??
        process.env.PLAYWRIGHT_BASE_URL ??
        "http://localhost:3000";
      assertLocalAuthTargets(configuredBaseURL);
      const authContext = await browser.newContext({
        baseURL: configuredBaseURL,
        locale: "th-TH",
        timezoneId: "Asia/Bangkok",
      });
      let storageState: StorageState | undefined;
      try {
        const authPage = await authContext.newPage();
        await signInWithOtp(authPage, uniqueEmail("prototype-qa"));
        storageState = await authContext.storageState();
      } finally {
        await authContext.close();
      }

      if (!storageState) {
        throw new Error("Local prototype auth setup did not produce a storage state.");
      }
      await provideFixture(storageState);
    },
    { scope: "worker" },
  ],
  storageState: async ({ prototypeStorageState }, provideFixture) => {
    await provideFixture(prototypeStorageState);
  },
});

const EVIDENCE_DIR = resolve(process.cwd(), "test-results/prototype");
const COMPACT_NAV_BREAKPOINT = 1150;

const DESIGN_DIRECTIONS = [
  { key: "minimal", label: "Modern Minimal" },
  { key: "dark", label: "Dark Focus" },
  { key: "life", label: "Life Blend" },
  { key: "pro", label: "Productivity Pro" },
  { key: "spatial", label: "Spatial Flow" },
] as const;

const SUPPORTED_DESTINATION_HEADINGS: Record<string, string> = {
  today: "Today",
  workspace: "Workspace",
  inbox: "Inbox",
  tasks: "Tasks",
  planner: "Planner",
  "planner-year": "Year overview",
  "planner-month": "Month plan",
  "planner-week": "Week plan",
  "planner-day": "Day plan",
  calendar: "Calendar",
  "calendar-month": "Month view",
  "calendar-week": "Week view",
  "calendar-schedule": "Schedule",
  "calendar-upcoming": "Upcoming",
  goals: "Goals",
  "goals-active": "Active goals",
  "goals-review": "Review",
  finance: "Finance",
  "finance-overview": "Overview",
  "finance-budget": "Budget",
  "finance-bills": "Bills",
  routine: "Routine",
  "routine-habits": "Habits",
  "routine-reflection": "Reflection",
  insights: "Insights",
  "insights-overview": "Overview",
  "insights-productivity": "Productivity",
  "insights-time": "Time",
  "insights-balance": "Life balance",
};

const uncaughtPageErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  uncaughtPageErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
});

test.afterEach(async ({ page }) => {
  expect(uncaughtPageErrors.get(page) ?? []).toEqual([]);
});

async function openPrototype(page: Page) {
  await page.goto("/prototype");
  await expect(page.getByText("Kemtit Visual Prototype · Demo data only")).toBeVisible();
  await expectPrototypeDateControls(page);
}

async function expectPrototypeDateControls(page: Page) {
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  const topbarDate = page.getByTestId("prototype-date");
  if (await topbarDate.isVisible()) {
    const bounds = await topbarDate.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(viewportWidth);
  }

  const screenHeader = page.locator("[data-screen-heading]").locator("xpath=ancestor::section[1]");
  const previous = screenHeader.getByRole("button", { name: /^Previous (day|week|month|year)$/ });
  const demoToday = screenHeader.getByRole("button", { name: "Demo today", exact: true });
  const next = screenHeader.getByRole("button", { name: /^Next (day|week|month|year)$/ });
  const controls = [previous, demoToday, next];
  const boxes = await Promise.all(controls.map((control) => control.boundingBox()));
  for (const box of boxes) {
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewportWidth);
    }
  }

  if (viewportWidth === 390 && boxes.every((box) => box !== null)) {
    const [previousBox, todayBox, nextBox] = boxes;
    const rows = boxes.map((box) => Math.round(box!.y));
    expect(Math.max(...rows) - Math.min(...rows)).toBeLessThanOrEqual(2);
    expect(previousBox!.x + previousBox!.width).toBeLessThanOrEqual(todayBox!.x + 1);
    expect(todayBox!.x + todayBox!.width).toBeLessThanOrEqual(nextBox!.x + 1);
  }
}

async function selectView(page: Page, view: "today" | "week" | "month" | "year") {
  const trigger = page.getByRole("button", { name: "Choose view", exact: true });
  await trigger.click();
  const label = view[0].toUpperCase() + view.slice(1);
  const option = page.getByRole("menuitemradio", { name: new RegExp(`^${label}\\b`) });
  await expect(option).toBeVisible();
  await option.click();
  await expect(option).toBeHidden();
  await expect(trigger).toContainText(label);
  await expect(page.getByTestId("prototype-view-surface")).toHaveAttribute("data-view", view);
}

async function openQuickCapture(page: Page) {
  const input = page.getByRole("combobox", { name: "Quick capture", exact: true });
  await input.click();
  await expect(input).toBeFocused();
  return input;
}

function captureField(page: Page, name: string) {
  return page.getByTestId("capture-draft").getByLabel(name, { exact: true });
}

async function openPrototypeNavigation(page: Page) {
  const menuButton = page.getByTestId("mobile-menu-button");
  if (await menuButton.isVisible() && (await menuButton.getAttribute("aria-expanded")) !== "true") {
    await menuButton.click();
  }
  return page.getByRole("navigation", { name: "Prototype navigation" });
}

async function closePrototypeNavigation(page: Page) {
  const closeButton = page.getByTestId("drawer-close-button");
  if (await closeButton.isVisible()) await closeButton.click();
}

async function ensureNavigationGroupExpanded(navigation: Locator, label: string) {
  const disclosure = navigation.getByRole("button", {
    name: new RegExp(`^(Expand|Collapse) ${label}$`),
  });
  if ((await disclosure.getAttribute("aria-expanded")) !== "true") await disclosure.click();
}

async function chooseScope(page: Page, scope: "all" | "work" | "life") {
  await openPrototypeNavigation(page);
  await page.getByTestId(`scope-${scope}`).click();
  await expect(page.getByTestId(`scope-${scope}`)).toHaveAttribute("aria-pressed", "true");
  await closePrototypeNavigation(page);
}

async function expectScope(page: Page, scope: "all" | "work" | "life") {
  await openPrototypeNavigation(page);
  await expect(page.getByTestId(`scope-${scope}`)).toHaveAttribute("aria-pressed", "true");
  await closePrototypeNavigation(page);
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));

  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
}

function trackMutatingRequests(page: Page) {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method().toUpperCase())) {
      requests.push(`${request.method()} ${request.url()}`);
    }
  });
  return requests;
}

async function expectDisabledWithVisibleReason(control: Locator, page: Page) {
  await expect(control).toBeDisabled();
  const reasonIds = (await control.getAttribute("aria-describedby"))?.split(/\s+/) ?? [];
  expect(reasonIds.length).toBeGreaterThan(0);
  for (const reasonId of reasonIds) {
    await expect(page.locator(`#${reasonId}`)).toBeVisible();
  }
}

test("all five design directions keep Today and Quick Capture usable at every viewport", async ({
  page,
  browser,
}, testInfo) => {
  await openPrototype(page);
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const viewport = page.viewportSize();
  const browserEvidence = {
    browserType: browser.browserType().name(),
    channel: "chrome",
    version: browser.version(),
    project: testInfo.project.name,
    viewport,
  };
  writeFileSync(
    join(EVIDENCE_DIR, `${testInfo.project.name}-browser.json`),
    `${JSON.stringify(browserEvidence, null, 2)}\n`,
  );
  testInfo.annotations.push({
    type: "browser",
    description: `${browserEvidence.browserType} channel=${browserEvidence.channel} version=${browserEvidence.version}`,
  });
  console.info(
    `[prototype evidence] ${testInfo.project.name}: ${browserEvidence.browserType} channel=${browserEvidence.channel} version=${browserEvidence.version}`,
  );

  const task = page
    .getByTestId("task-row")
    .filter({ hasText: "Finish Kemtit redesign" });
  await expect(task).toHaveCount(1);
  const taskId = await task.getAttribute("data-record-id");
  expect(taskId).toBeTruthy();
  await task.click();
  await expect(task).toHaveAttribute("data-completed", "true");

  for (const direction of DESIGN_DIRECTIONS) {
    const themeButton = page.getByRole("button", { name: new RegExp(direction.label) });
    await themeButton.click();
    await expect(page.getByRole("heading", { name: direction.label, exact: true })).toBeVisible();
    await expect(task).toHaveAttribute("data-record-id", taskId!);
    await expect(task).toHaveAttribute("data-completed", "true");
    await expectNoHorizontalOverflow(page);

    await page.screenshot({
      path: join(EVIDENCE_DIR, `${testInfo.project.name}-${direction.key}-today.png`),
      fullPage: true,
      animations: "disabled",
    });

    const quickCaptureInput = await openQuickCapture(page);
    await expectNoHorizontalOverflow(page);
    const quickCaptureFrame = quickCaptureInput.locator("xpath=..");
    await expect(quickCaptureInput).toHaveCSS("outline-style", "none");
    await expect(quickCaptureFrame).toHaveCSS("border-top-width", "1px");
    const focusShadow = await quickCaptureFrame.evaluate((element) => getComputedStyle(element).boxShadow);
    expect(focusShadow).not.toBe("none");
    await page.screenshot({
      path: join(EVIDENCE_DIR, `${testInfo.project.name}-${direction.key}-capture-open.png`),
      fullPage: true,
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox", { name: "Quick capture suggestions" })).toBeHidden();
    await expect(page.getByTestId("capture-draft")).toHaveCount(0);
  }
});

test("each supported navigation destination opens its declared screen", async ({ page }) => {
  test.setTimeout(90_000);
  await openPrototype(page);

  let navigation = await openPrototypeNavigation(page);
  const supportedDestinations = navigation.locator(
    '[data-testid="prototype-nav-destination"][data-supported="true"]',
  );
  await expect(supportedDestinations).toHaveCount(Object.keys(SUPPORTED_DESTINATION_HEADINGS).length);
  for (const [destinationId, screenHeading] of Object.entries(SUPPORTED_DESTINATION_HEADINGS)) {
    navigation = await openPrototypeNavigation(page);
    const parentKey = ["planner", "calendar", "goals", "finance", "routine", "insights"].find(
      (group) => destinationId.startsWith(`${group}-`),
    );
    if (parentKey) {
      const parentLabel = parentKey[0].toUpperCase() + parentKey.slice(1);
      await ensureNavigationGroupExpanded(navigation, parentLabel);
    }

    const destination = navigation.locator(
      `[data-testid="prototype-nav-destination"][data-supported="true"][data-destination-id="${destinationId}"]`,
    );
    await expect(destination).toHaveCount(1);
    await destination.scrollIntoViewIfNeeded();
    await destination.click();
    const heading = page.locator(`[data-screen-heading="${screenHeading}"]`);
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    const headingIntersectsViewport = await heading.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return (
        bounds.width > 0 &&
        bounds.height > 0 &&
        bounds.bottom > 0 &&
        bounds.top < window.innerHeight &&
        bounds.right > 0 &&
        bounds.left < window.innerWidth
      );
    });
    expect(headingIntersectsViewport).toBe(true);
    if ((page.viewportSize()?.width ?? 1440) <= COMPACT_NAV_BREAKPOINT) {
      await expect(page.getByTestId("mobile-drawer")).toBeHidden();
    }
    navigation = await openPrototypeNavigation(page);
    const selectedDestination = navigation.locator(
      `[data-testid="prototype-nav-destination"][data-supported="true"][data-destination-id="${destinationId}"]`,
    );
    await expect(selectedDestination).toHaveAttribute("aria-current", "page");
    await closePrototypeNavigation(page);
  }

  if (page.viewportSize()?.width === 1440) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    navigation = await openPrototypeNavigation(page);
    await ensureNavigationGroupExpanded(navigation, "Insights");
    const sameDestination = navigation.locator(
      '[data-testid="prototype-nav-destination"][data-supported="true"][data-destination-id="insights-balance"]',
    );
    await sameDestination.click();

    const sameHeading = page.locator('[data-screen-heading="Life balance"]');
    await expect(sameHeading).toBeVisible();
    await expect(sameHeading).toBeFocused();
    const sameHeadingIntersectsViewport = await sameHeading.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return (
        bounds.width > 0 &&
        bounds.height > 0 &&
        bounds.bottom > 0 &&
        bounds.top < window.innerHeight &&
        bounds.right > 0 &&
        bounds.left < window.innerWidth
      );
    });
    expect(sameHeadingIntersectsViewport).toBe(true);
  }

  navigation = await openPrototypeNavigation(page);
  for (const parentLabel of ["Calendar", "Goals", "Finance", "Routine"]) {
    await ensureNavigationGroupExpanded(navigation, parentLabel);
  }
  const unsupportedDestinations = navigation.locator(
    '[data-testid="prototype-nav-destination"][data-supported="false"]',
  );
  for (const destination of await unsupportedDestinations.all()) {
    await expectDisabledWithVisibleReason(destination, page);
    const reasonId = await destination.getAttribute("aria-describedby");
    expect(reasonId).toBeTruthy();
    const reason = page.locator(`[id="${reasonId}"]`);
    const bounds = await Promise.all([navigation, reason].map((element) => element.boundingBox()));
    const reasonStyles = await reason.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        display: style.display,
        borderTopStyle: style.borderTopStyle,
        whiteSpace: style.whiteSpace,
      };
    });
    expect(reasonStyles.display).toBe("block");
    expect(reasonStyles.borderTopStyle).toBe("none");
    expect(reasonStyles.whiteSpace).toBe("normal");
    expect(bounds[0]).not.toBeNull();
    expect(bounds[1]).not.toBeNull();
    if (bounds[0] && bounds[1]) {
      expect(bounds[1].x).toBeGreaterThanOrEqual(bounds[0].x - 1);
      expect(bounds[1].x + bounds[1].width).toBeLessThanOrEqual(bounds[0].x + bounds[0].width + 1);
    }
  }
});

test("remaining unsupported concept actions stay disabled with a visible explanation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "prototype-1440", "Action inventory is sampled on desktop.");
  await openPrototype(page);

  await expectDisabledWithVisibleReason(
    page.getByRole("button", { name: "Settings", exact: true }),
    page,
  );
});

test("Habits can be created with recurrence and reminder settings", async ({ page }) => {
  await openPrototype(page);
  const navigation = await openPrototypeNavigation(page);
  await ensureNavigationGroupExpanded(navigation, "Routine");
  await navigation
    .locator(
      '[data-testid="prototype-nav-destination"][data-supported="true"][data-destination-id="routine-habits"]',
    )
    .click();

  const surface = page.getByTestId("prototype-view-surface");
  await expect(surface).toHaveAttribute("data-destination-id", "routine-habits");
  const habitsPanel = surface
    .getByRole("heading", { name: "Habits", exact: true })
    .locator("xpath=ancestor::section[1]");
  const habit = page.getByTestId("task-row").filter({ hasText: "Exercise 30 minutes" });
  await expect(habit).toContainText("Mon · Wed · Fri");
  await expect(habit).toHaveAttribute("aria-pressed", "false");
  await habit.click();
  await expect(habit).toHaveAttribute("aria-pressed", "true");

  const addHabit = habitsPanel.getByRole("button", { name: "Add habit", exact: true });
  await expect(addHabit).toBeVisible();
  await addHabit.click();

  const draft = page.getByTestId("capture-draft");
  await expect(draft).toBeVisible();
  await expect(captureField(page, "Type")).toHaveValue("habit");
  await captureField(page, "Title").fill("Read for 20 minutes");
  await captureField(page, "Scope").selectOption("life");
  await captureField(page, "Duration (minutes)").fill("20");
  await captureField(page, "Repeat").fill("Every day");
  await captureField(page, "Reminder minutes").fill("15");
  await page.getByTestId("capture-confirm").click();

  await expect(page.getByTestId("prototype-view-surface")).toHaveAttribute("data-destination-id", "routine-habits");
  const created = page.getByTestId("task-row").filter({ hasText: "Read for 20 minutes" });
  await expect(created).toBeVisible();
  await expect(created).toContainText("Every day");
});

test("shared empty states are flat, bounded, and expose one clear CTA", async ({ page }) => {
  await openPrototype(page);
  await page.getByTestId("demo-mode-toggle").click();
  await expect(page.getByText("Empty workspace mode", { exact: true })).toBeVisible();

  const todayFocus = page
    .getByRole("heading", { name: "Today’s focus", exact: true })
    .locator("xpath=ancestor::section[1]");
  const todaySchedule = page
    .getByRole("heading", { name: "Today’s schedule", exact: true })
    .locator("xpath=ancestor::section[1]");
  await expect(todayFocus.getByRole("button", { name: "Capture an item", exact: true })).toHaveCount(1);
  await expect(todayFocus.getByRole("button", { name: "Add item", exact: true })).toHaveCount(0);
  await expect(todaySchedule.getByRole("button", { name: "Add event", exact: true })).toHaveCount(1);

  const navigation = await openPrototypeNavigation(page);
  await ensureNavigationGroupExpanded(navigation, "Workspace");
  await navigation
    .locator(
      '[data-testid="prototype-nav-destination"][data-supported="true"][data-destination-id="inbox"]',
    )
    .click();

  const surface = page.getByTestId("prototype-view-surface");
  await expect(surface).toHaveAttribute("data-destination-id", "inbox");
  const emptyState = surface
    .getByText("Your inbox is clear", { exact: true })
    .locator("xpath=ancestor::div[1]");
  const action = emptyState.getByRole("button", { name: "Capture an item", exact: true });

  await expect(emptyState).toBeVisible();
  await expect(surface.getByText("Capture first. Organize when you are ready.", { exact: true })).toBeVisible();
  await expect(action).toHaveCount(1);

  const emptyStyles = await emptyState.evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      borderTopStyle: style.borderTopStyle,
      backgroundColor: style.backgroundColor,
      width: rect.width,
    };
  });
  expect(emptyStyles.borderTopStyle).toBe("none");
  expect(emptyStyles.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  if (await page.evaluate(() => window.innerWidth > 760)) {
    expect(emptyStyles.width).toBeLessThanOrEqual(722);
  }

  const actionStyles = await action.evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      display: style.display,
      backgroundColor: style.backgroundColor,
      height: rect.height,
    };
  });
  expect(actionStyles.display).toBe("inline-flex");
  expect(actionStyles.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(actionStyles.height).toBeGreaterThanOrEqual(44);
});

test("Starter Workspace previews suggestions before creating local user data", async ({ page }) => {
  await openPrototype(page);
  await page.getByTestId("demo-mode-toggle").click();

  const starter = page.getByTestId("starter-workspace");
  await expect(starter).toBeVisible();
  await expect(starter).toContainText("nothing is added until you confirm");
  await expect(page.getByTestId("task-row")).toHaveCount(0);

  await starter.getByRole("button", { name: /Seller \/ Creator/ }).click();
  await expect(starter).toContainText("Plan next product launch");
  await expect(starter).toContainText("Capture next content idea");
  await starter.getByRole("button", { name: "Create starter workspace", exact: true }).click();

  await expect(starter).toHaveCount(0);
  const focusPanel = page
    .getByRole("heading", { name: "Today’s focus", exact: true })
    .locator("xpath=ancestor::section[1]");
  await expect(focusPanel.getByText("Plan next product launch", { exact: true })).toBeVisible();

  const navigation = await openPrototypeNavigation(page);
  await ensureNavigationGroupExpanded(navigation, "Workspace");
  await navigation
    .locator('[data-testid="prototype-nav-destination"][data-destination-id="inbox"]')
    .click();
  await expect(page.getByText("Capture next content idea", { exact: true })).toBeVisible();
});

test("mobile execution navigation keeps Today, Planner, Capture, and Insights one tap away", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "prototype-390", "Mobile execution navigation is sampled at 390px.");
  await openPrototype(page);

  const mobileNav = page.getByRole("navigation", { name: "Mobile prototype navigation" });
  await expect(mobileNav).toBeVisible();
  await mobileNav.getByRole("button", { name: "Planner", exact: true }).click();
  await expect(page.getByTestId("prototype-view-surface")).toHaveAttribute("data-destination-id", "planner");

  await mobileNav.getByRole("button", { name: "Insights", exact: true }).click();
  await expect(page.getByTestId("prototype-view-surface")).toHaveAttribute("data-destination-id", "insights");

  await mobileNav.getByRole("button", { name: "Quick capture", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Quick capture", exact: true })).toBeFocused();
});

test("Quick Capture proposes structured details and can park an item in Inbox", async ({ page }) => {
  await openPrototype(page);
  const input = await openQuickCapture(page);
  await input.fill("Prepare listing images tomorrow 45m work");

  const proposal = page.getByTestId("capture-proposal");
  await expect(proposal).toBeVisible();
  await expect(proposal).toContainText("Prepare listing images");
  await expect(proposal).toContainText("Tomorrow");
  await expect(proposal).toContainText("45m");
  await expect(proposal).toContainText("Work");

  await proposal.getByRole("button", { name: "Add to Inbox", exact: true }).click();
  const surface = page.getByTestId("prototype-view-surface");
  await expect(surface).toHaveAttribute("data-destination-id", "inbox");
  await expect(surface.getByRole("heading", { name: "Unplanned items", exact: true })).toBeVisible();
  const inboxItem = surface.locator('[data-record-id^="prototype-created-"]').filter({ hasText: "Prepare listing images" });
  await expect(inboxItem).toHaveCount(1);
  await expect(inboxItem).toContainText("due Sep 25");
  await expect(inboxItem).toContainText("45m");
});

test("a note can be captured to Inbox before an Area is chosen", async ({ page }) => {
  await openPrototype(page);
  const input = await openQuickCapture(page);
  await input.fill("Idea research a new product");
  await input.press("Enter");

  const draft = page.getByTestId("capture-draft");
  await expect(draft).toBeVisible();
  await expect(captureField(page, "Type")).toHaveValue("note");
  await expect(captureField(page, "Scope")).toHaveValue("");
  await page.getByTestId("capture-confirm").click();

  const surface = page.getByTestId("prototype-view-surface");
  await expect(surface).toHaveAttribute("data-destination-id", "inbox");
  const note = surface.locator('[data-record-id^="prototype-created-"]').filter({ hasText: "research a new product" });
  await expect(note).toBeVisible();
  await expect(note).toContainText("Area not set");
});

test("Plan my day turns an Inbox task into a scheduled time block", async ({ page }) => {
  await openPrototype(page);
  const planPanel = page.getByTestId("plan-day-panel");
  await expect(planPanel).toContainText("1 item waiting in Inbox");

  await planPanel.getByRole("button", { name: "Prepare plan", exact: true }).click();
  await expect(planPanel).toContainText("Prepare new listing images");
  await expect(planPanel).toContainText("09:30");
  await planPanel.getByRole("button", { name: "Confirm plan", exact: true }).click();

  const focusPanel = page
    .getByRole("heading", { name: "Today’s focus", exact: true })
    .locator("xpath=ancestor::section[1]");
  await expect(focusPanel.getByText("Prepare new listing images", { exact: true })).toBeVisible();

  const schedulePanel = page
    .getByRole("heading", { name: "Today’s schedule", exact: true })
    .locator("xpath=ancestor::section[1]");
  const plannedBlock = schedulePanel.locator('[data-record-id="task-listing-images"]');
  await expect(plannedBlock).toBeVisible();
  await expect(plannedBlock).toContainText("Task block");
  await expect(schedulePanel.getByText("09:30", { exact: true })).toBeVisible();
});

test("capacity keeps hidden-area commitments when the visible Area filter changes", async ({ page }) => {
  await openPrototype(page);
  const freeCapacity = page
    .getByText("Free capacity", { exact: true })
    .locator("xpath=ancestor::article[1]");
  const allValue = await freeCapacity.locator("strong").innerText();

  await chooseScope(page, "work");
  await expect(freeCapacity.locator("strong")).toHaveText(allValue);
});

test("reviewing a smart capture keeps plan date and due date separate", async ({ page }) => {
  await openPrototype(page);
  const input = await openQuickCapture(page);
  await input.fill("Prepare proposal tomorrow 60m work");
  const proposal = page.getByTestId("capture-proposal");
  await proposal.getByRole("button", { name: "Review", exact: true }).click();

  const draft = page.getByTestId("capture-draft");
  await expect(draft).toBeVisible();
  await expect(captureField(page, "Date")).toHaveValue("2026-09-24");
  await expect(captureField(page, "Due date")).toHaveValue("2026-09-25");
  await expect(captureField(page, "Duration (minutes)")).toHaveValue("60");
  await expect(captureField(page, "Scope")).toHaveValue("work");
  await page.getByTestId("capture-cancel").click();
});

test("Finance keeps a bill obligation separate from the recorded payment", async ({ page }) => {
  await openPrototype(page);
  const navigation = await openPrototypeNavigation(page);
  await ensureNavigationGroupExpanded(navigation, "Finance");
  await navigation
    .locator('[data-testid="prototype-nav-destination"][data-destination-id="finance-bills"]')
    .click();

  const bill = page
    .getByTestId("prototype-record-row")
    .filter({ hasText: "Pay electricity bill" });
  await expect(bill).toBeVisible();
  await bill.click();

  const detail = page.locator('[data-testid="prototype-record-detail"][data-record-id="bill-electricity"]');
  await expect(detail).toBeVisible();
  await expect(detail.getByRole("button", { name: "Mark as paid", exact: true })).toBeVisible();
  await detail.getByRole("button", { name: "Mark as paid", exact: true }).click();
  await expect(detail.getByRole("button", { name: "Mark as paid", exact: true })).toHaveCount(0);

  const navigationAfterPayment = await openPrototypeNavigation(page);
  await navigationAfterPayment
    .locator('[data-testid="prototype-nav-destination"][data-destination-id="finance-overview"]')
    .click();
  const balanceCard = page.getByText("Monthly balance", { exact: true }).locator("xpath=ancestor::section[1]");
  await expect(balanceCard).toContainText("11,250");
});

test("Insights overview exposes a review workflow instead of only summary cards", async ({ page }) => {
  await openPrototype(page);
  const navigation = await openPrototypeNavigation(page);
  await ensureNavigationGroupExpanded(navigation, "Insights");
  await navigation
    .locator('[data-testid="prototype-nav-destination"][data-destination-id="insights-overview"]')
    .click();

  await expect(page.getByRole("heading", { name: "Day review", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Goal coverage", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Prepare next week", exact: true })).toBeVisible();
});

test("Upcoming and Workspace cards keep complete internal layout", async ({ page }) => {
  await openPrototype(page);

  const comingUp = page
    .getByText("Coming up", { exact: true })
    .locator("xpath=ancestor::section[1]");
  await expect(comingUp.getByRole("button", { name: "See all", exact: true })).toBeVisible();
  await expect(comingUp.getByRole("button")).toHaveCount(4);
  await comingUp.getByRole("button", { name: "See all", exact: true }).click();

  const upcomingCards = page.getByTestId("upcoming-card");
  await expect(upcomingCards).toHaveCount(5);
  const firstUpcomingAction = upcomingCards.first().getByRole("button", { name: "Open item", exact: true });
  await expect(firstUpcomingAction).toHaveCSS("display", "inline-flex");

  const navigation = await openPrototypeNavigation(page);
  await navigation
    .locator('[data-testid="prototype-nav-destination"][data-destination-id="workspace"]')
    .click();
  const workspaceCards = page.getByTestId("workspace-card");
  await expect(workspaceCards).toHaveCount(3);
  for (const card of await workspaceCards.all()) {
    await expect(card).toHaveCSS("display", "grid");
    await expect(card.locator("strong")).toBeVisible();
    await expect(card.locator("small")).toBeVisible();
  }
});

test("planned-time chart preserves every proportional bar height", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openPrototype(page);
  const chart = page.locator('[data-chart-title="Weekly rhythm"]');
  await expect(chart).toBeVisible();
  const samples = await chart.getByTestId("planned-time-bar").evaluateAll((elements) =>
    elements.map((element) => ({
      minutes: Number(element.getAttribute("data-minutes")),
      height: element.querySelector<HTMLElement>('[data-testid="planned-time-bar-fill"]')?.getBoundingClientRect().height ?? 0,
    })),
  );
  const positive = samples.filter((sample) => sample.minutes > 0).sort((a, b) => b.minutes - a.minutes);
  expect(positive.length).toBeGreaterThanOrEqual(2);
  for (const sample of positive) {
    const expectedHeight = positive[0].height * sample.minutes / positive[0].minutes;
    expect(Math.abs(sample.height - expectedHeight)).toBeLessThanOrEqual(0.15);
  }
  for (const zero of samples.filter((sample) => sample.minutes === 0)) expect(zero.height).toBe(0);
});

test("chart card stays intrinsic when an adjacent card grows in every theme", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openPrototype(page);
  const chart = page.locator('[data-chart-title="Weekly rhythm"]');
  for (const theme of DESIGN_DIRECTIONS) {
    await page.getByRole("group", { name: "Design direction" }).getByRole("button", { name: new RegExp(theme.label) }).click();
    const before = await chart.boundingBox();
    expect(before).not.toBeNull();
    await chart.evaluate((element) => {
      const sibling = element.nextElementSibling as HTMLElement | null;
      if (!sibling) throw new Error("Missing Goals neighbor");
      sibling.dataset.previousMinHeight = sibling.style.minHeight;
      sibling.style.minHeight = "1000px";
    });
    const after = await chart.boundingBox();
    expect(after).not.toBeNull();
    expect(Math.abs(after!.height - before!.height)).toBeLessThanOrEqual(1);
    const geometry = await chart.evaluate((element) => {
      const style = getComputedStyle(element);
      const footer = element.querySelector<HTMLElement>('[data-testid="chart-footer"]')!;
      return {
        remainder: element.getBoundingClientRect().bottom - footer.getBoundingClientRect().bottom - parseFloat(style.borderBottomWidth),
        padding: parseFloat(style.paddingBottom),
        overflow: element.scrollWidth - element.clientWidth,
      };
    });
    expect(Math.abs(geometry.remainder - geometry.padding)).toBeLessThanOrEqual(1);
    expect(geometry.overflow).toBeLessThanOrEqual(1);
    await expect(chart.getByTestId("chart-baseline")).toBeVisible();
    await chart.evaluate((element) => {
      const sibling = element.nextElementSibling as HTMLElement;
      sibling.style.minHeight = sibling.dataset.previousMinHeight ?? "";
      delete sibling.dataset.previousMinHeight;
    });
  }
  await testInfo.attach("chart-row-after", { body: await chart.locator("..").screenshot(), contentType: "image/png" });
});

test("chart selection is local, keyboard accessible, and drill-down preserves scope", async ({ page }) => {
  await openPrototype(page);
  await chooseScope(page, "work");
  const chart = page.locator('[data-chart-title="Weekly rhythm"]');
  const dateBefore = await page.getByTestId("prototype-date").getAttribute("data-date");
  const friday = chart.getByRole("button", { name: /Friday, Sep 25, 2026/ });
  await friday.click();
  await expect(page.getByTestId("prototype-date")).toHaveAttribute("data-date", dateBefore!);
  await expect(chart.getByTestId("chart-selected-value")).toContainText("Fri, Sep 25");
  await friday.press("ArrowRight");
  await expect(chart.getByRole("button", { name: /Saturday, Sep 26, 2026/ })).toBeFocused();
  await chart.getByText("View data table", { exact: true }).click();
  await expect(chart.getByRole("table")).toBeVisible();
  await expect(chart.getByRole("table").locator("tbody tr")).toHaveCount(7);
  await chart.getByRole("button", { name: /Open day’s plan/ }).click();
  await expect(page.getByTestId("prototype-view-surface")).toHaveAttribute("data-destination-id", "planner-day");
  await expect(page.getByTestId("prototype-view-surface")).toHaveAttribute("data-scope", "work");
  await expect(page.getByTestId("prototype-date")).toHaveAttribute("data-date", "2026-09-26");
});

test("a five-minute workload stays proportional beside a ten-hour workload", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openPrototype(page);
  await page.getByTestId("demo-mode-toggle").click();
  for (const item of [{ title: "Large estimate", date: "2026-09-24", minutes: "600" }, { title: "Tiny estimate", date: "2026-09-25", minutes: "5" }]) {
    const input = await openQuickCapture(page);
    await input.fill(item.title);
    await input.press("Enter");
    await captureField(page, "Type").selectOption("task");
    await captureField(page, "Date").fill(item.date);
    await captureField(page, "Scope").selectOption("work");
    await captureField(page, "Duration (minutes)").fill(item.minutes);
    await page.getByTestId("capture-confirm").click();
  }
  const navigation = await openPrototypeNavigation(page);
  await navigation.locator('[data-testid="prototype-nav-destination"][data-destination-id="today"]').click();
  const chart = page.locator('[data-chart-title="Weekly rhythm"]');
  const large = await chart.locator('[data-minutes="600"] [data-testid="planned-time-bar-fill"]').boundingBox();
  const tiny = await chart.locator('[data-minutes="5"] [data-testid="planned-time-bar-fill"]').boundingBox();
  expect(large).not.toBeNull();
  expect(tiny).not.toBeNull();
  expect(tiny!.height).toBeGreaterThan(0);
  expect(Math.abs(tiny!.height - large!.height * 5 / 600)).toBeLessThanOrEqual(0.15);
});

test("Today and Insights exclude the same Inbox task from completion", async ({ page }) => {
  await openPrototype(page);
  await page.getByTestId("task-row").filter({ hasText: "Finish Kemtit redesign" }).click();
  const metric = page.getByText("Tasks complete", { exact: true }).locator("xpath=ancestor::article[1]");
  await expect(metric.locator("strong")).toHaveText("1/1");
  const navigation = await openPrototypeNavigation(page);
  await ensureNavigationGroupExpanded(navigation, "Insights");
  await navigation.locator('[data-testid="prototype-nav-destination"][data-destination-id="insights-productivity"]').click();
  const panel = page.getByRole("heading", { name: "Task completion", exact: true }).locator("xpath=ancestor::section[1]");
  await expect(panel).toContainText("1 of 1 visible tasks completed");
});

test("over-budget labels keep 130 percent while the track stops at 100", async ({ page }) => {
  await openPrototype(page);
  const input = await openQuickCapture(page);
  await input.fill("Budget overrun regression");
  await input.press("Enter");
  await captureField(page, "Type").selectOption("bill");
  await captureField(page, "Scope").selectOption("life");
  await captureField(page, "Date").fill("2026-09-24");
  await captureField(page, "Amount (THB)").fill("8450");
  await page.getByTestId("capture-confirm").click();
  await page.getByTestId("prototype-record-detail").getByRole("button", { name: "Mark as paid", exact: true }).click();
  const navigation = await openPrototypeNavigation(page);
  await ensureNavigationGroupExpanded(navigation, "Finance");
  await navigation.locator('[data-testid="prototype-nav-destination"][data-destination-id="finance-budget"]').click();
  await expect(page.getByTestId("budget-percent")).toHaveText("130%");
  await expect(page.getByTestId("budget-overspend")).toContainText("6,000");
  expect(await page.getByTestId("budget-fill").evaluate((element) => (element as HTMLElement).style.width)).toBe("100%");
});

test("task hover does not shift row content", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openPrototype(page);
  const row = page.getByTestId("task-row").filter({ hasText: "Finish Kemtit redesign" });
  const title = row.locator("strong").first();
  const before = await Promise.all([row, title].map((element) => element.boundingBox()));
  await row.hover();
  const after = await Promise.all([row, title].map((element) => element.boundingBox()));
  expect(before[0]).not.toBeNull();
  expect(before[1]).not.toBeNull();
  expect(after[0]).not.toBeNull();
  expect(after[1]).not.toBeNull();
  if (before.every(Boolean) && after.every(Boolean)) {
    expect(Math.abs(after[0]!.width - before[0]!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(after[1]!.x - before[1]!.x)).toBeLessThanOrEqual(1);
  }
});

test("All, Work, and Life change the shared demo task projection", async ({ page }) => {
  await openPrototype(page);

  const rows = page.getByTestId("task-row");
  const allIds = await rows.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-record-id")).filter(Boolean),
  );
  expect(allIds.length).toBeGreaterThan(1);

  await chooseScope(page, "work");
  const workIds = await rows.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-record-id")).filter(Boolean),
  );
  expect(workIds.length).toBeGreaterThan(0);
  expect(workIds.length).toBeLessThan(allIds.length);
  await expect(rows.filter({ hasText: "Finish Kemtit redesign" })).toBeVisible();
  await expect(rows.filter({ hasText: "Exercise 30 minutes" })).toHaveCount(0);

  await chooseScope(page, "life");
  const lifeIds = await rows.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-record-id")).filter(Boolean),
  );
  expect(lifeIds.length).toBeGreaterThan(0);
  expect(lifeIds.length).toBeLessThan(allIds.length);
  await expect(rows.filter({ hasText: "Finish Kemtit redesign" })).toHaveCount(0);
  await expect(rows.filter({ hasText: "Exercise 30 minutes" })).toBeVisible();

  await chooseScope(page, "all");
  await expect(rows).toHaveCount(allIds.length);
});

test("Today, Week, Month, and Year keep view, heading, and destination synchronized", async ({ page }) => {
  await openPrototype(page);

  await expect(page.getByTestId("prototype-date")).toHaveAttribute("data-date", "2026-09-24");
  const expected = {
    today: { heading: "Today", destination: "today" },
    week: { heading: "Week plan", destination: "planner-week" },
    month: { heading: "Month plan", destination: "planner-month" },
    year: { heading: "Year overview", destination: "planner-year" },
  } as const;

  for (const view of ["today", "week", "month", "year"] as const) {
    await selectView(page, view);
    const surface = page.getByTestId("prototype-view-surface");
    await expect(surface).toHaveAttribute("data-view", view);
    await expect(surface).toHaveAttribute("data-destination-id", expected[view].destination);
    await expect(page.locator("[data-screen-heading]")).toHaveText(expected[view].heading);
    const screenHeader = page.locator("[data-screen-heading]").locator("xpath=ancestor::section[1]");
    await expect(screenHeader.getByText("Thursday, September 24, 2026", { exact: false })).toBeVisible();
  }
});

test("Week completion gives immediate visual feedback and stays synchronized with Today", async ({ page }) => {
  await openPrototype(page);
  await selectView(page, "week");

  const weekTask = page
    .getByTestId("week-action-item")
    .filter({ hasText: "Finish Kemtit redesign" });
  await expect(weekTask).toHaveCount(1);
  await expect(weekTask).toHaveAttribute("aria-pressed", "false");
  await weekTask.click();
  await expect(weekTask).toHaveAttribute("aria-pressed", "true");
  await expect(weekTask.getByTestId("week-item-title")).toHaveCSS("text-decoration-line", "line-through");

  const navigation = await openPrototypeNavigation(page);
  await navigation
    .locator('[data-testid="prototype-nav-destination"][data-destination-id="today"]')
    .click();
  const todayTask = page.getByTestId("task-row").filter({ hasText: "Finish Kemtit redesign" });
  await expect(todayTask).toHaveAttribute("data-completed", "true");
});

test("Week view caps dense days and opens every item without stretching the week", async ({ page }) => {
  test.setTimeout(120_000);
  await openPrototype(page);
  for (let index = 0; index < 6; index += 1) {
    const input = await openQuickCapture(page);
    await input.fill(`Overflow validation event ${index}`);
    await input.press("Enter");
    await expect(page.getByTestId("capture-draft")).toBeVisible();
    await captureField(page, "Type").selectOption("event");
    await captureField(page, "Scope").selectOption("work");
    await captureField(page, "Date").fill("2026-09-24");
    await captureField(page, "Start time").fill("17:00");
    await captureField(page, "Duration (minutes)").fill("15");
    await page.getByTestId("capture-confirm").click();
    await expect(page.getByTestId("capture-draft")).toHaveCount(0);
  }
  const navigation = await openPrototypeNavigation(page);
  await navigation.locator('[data-testid="prototype-nav-destination"][data-destination-id="today"]').click();
  await chooseScope(page, "all");
  await selectView(page, "week");
  const card = page.locator('[data-testid="week-day-card"][data-week-date="2026-09-24"]');
  const total = Number((await card.locator("small").first().innerText()).split(" ")[0]);
  expect(total).toBeGreaterThan(10);
  await expect(card.getByTestId("week-preview-row")).toHaveCount(5);
  const trigger = card.getByTestId("week-day-more");
  await expect(trigger).toContainText(`+${total - 5} more`);
  const heights = await page.getByTestId("week-day-card").evaluateAll((cards) => cards.map((element) => element.getBoundingClientRect().height));
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);

  await trigger.click();
  const dialog = page.getByTestId("week-day-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("week-detail-row")).toHaveCount(total);
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  const scroller = dialog.getByTestId("week-day-scroll");
  expect(await scroller.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  const calendarAction = dialog.getByRole("button", { name: "View in Calendar" });
  const footerBefore = await calendarAction.boundingBox();
  await scroller.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  const footerAfter = await calendarAction.boundingBox();
  expect(Math.abs(footerBefore!.y - footerAfter!.y)).toBeLessThanOrEqual(1);
  const search = dialog.getByRole("searchbox");
  await search.fill("Overflow validation event 5");
  await expect(dialog.getByTestId("week-detail-row")).toHaveCount(1);
  await search.fill("");
  await expect(dialog.getByTestId("week-detail-row")).toHaveCount(total);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await calendarAction.click();
  await expect(page.getByTestId("prototype-view-surface")).toHaveAttribute("data-destination-id", "calendar-schedule");
  await expect(page.getByTestId("prototype-date")).toHaveAttribute("data-date", "2026-09-24");
});

test("mobile Week navigation changes the inspected column without changing the selected date", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "prototype-390", "Mobile day navigation is checked at 390px.");
  await openPrototype(page);
  await selectView(page, "week");
  const originalDate = await page.getByTestId("prototype-date").getAttribute("data-date");
  const grid = page.getByTestId("week-day-grid");
  const before = await grid.evaluate((element) => element.scrollLeft);
  await page.getByRole("button", { name: "Show next day", exact: true }).click();
  await expect.poll(() => grid.evaluate((element) => element.scrollLeft)).toBeGreaterThan(before);
  await expect(page.getByTestId("prototype-date")).toHaveAttribute("data-date", originalDate!);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("month view uses two intentional surfaces and one empty-state CTA", async ({ page }) => {
  await openPrototype(page);
  await selectView(page, "month");

  const grid = page.getByTestId("prototype-month-view-grid");
  const cards = grid.locator(":scope > section");
  await expect(cards).toHaveCount(2);

  const viewportWidth = await page.evaluate(() => window.innerWidth);
  const gridBox = await grid.boundingBox();
  const firstBox = await cards.nth(0).boundingBox();
  const secondBox = await cards.nth(1).boundingBox();
  const cardPadding = await Promise.all(
    [cards.nth(0), cards.nth(1)].map((card) => card.evaluate((element) => getComputedStyle(element).paddingTop)),
  );
  expect(gridBox).not.toBeNull();
  expect(firstBox).not.toBeNull();
  expect(secondBox).not.toBeNull();
  expect(cardPadding[0]).toBe(cardPadding[1]);

  if (gridBox && firstBox && secondBox) {
    if (viewportWidth > 760) {
      expect(Math.abs(firstBox.y - secondBox.y)).toBeLessThanOrEqual(2);
      expect(Math.abs(firstBox.height - secondBox.height)).toBeLessThanOrEqual(2);
      expect(firstBox.x).toBeGreaterThanOrEqual(gridBox.x - 1);
      expect(secondBox.x + secondBox.width).toBeLessThanOrEqual(gridBox.x + gridBox.width + 1);
      expect(Math.abs(secondBox.x - (firstBox.x + firstBox.width) - 16)).toBeLessThanOrEqual(1);
    } else {
      expect(secondBox.y).toBeGreaterThanOrEqual(firstBox.y + firstBox.height - 1);
    }
  }

  await page.getByRole("button", { name: /September 22, 2026/ }).click();
  const selectedDay = page.getByRole("heading", { name: "Selected day", exact: true }).locator("xpath=ancestor::section[1]");
  const selectedDayEmpty = selectedDay.getByText("Nothing planned yet", { exact: true }).locator("xpath=ancestor::div[1]");
  await expect(selectedDayEmpty).toBeVisible();
  await expect(selectedDay.getByRole("button", { name: "Add item", exact: true })).toHaveCount(1);
  await expect(selectedDay.getByText("No items are planned for this selected day.", { exact: true })).toBeVisible();
  const selectedDayStyles = await selectedDayEmpty.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      borderTopStyle: style.borderTopStyle,
      minHeight: style.minHeight,
      paddingLeft: style.paddingLeft,
    };
  });
  expect(selectedDayStyles.borderTopStyle).toBe("none");
  expect(selectedDayStyles.minHeight).toBe("0px");
  expect(selectedDayStyles.paddingLeft).toBe("16px");
});

test("view menu supports keyboard navigation without scrolling the page", async ({ page }) => {
  await openPrototype(page);
  const trigger = page.getByRole("button", { name: "Choose view", exact: true });
  const viewMenu = page.getByTestId("prototype-view-popover");
  const option = (label: string) =>
    page.getByRole("menuitemradio", { name: new RegExp(`^${label}\\b`) });
  const today = option("Today");
  const week = option("Week");
  const month = option("Month");
  const year = option("Year");

  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(viewMenu).toBeVisible();
  await expect(today).toBeFocused();
  await expect(page.getByTestId("prototype-view-surface")).toHaveAttribute("data-view", "today");
  await page.keyboard.press("Escape");
  await expect(viewMenu).toBeHidden();
  await expect(trigger).toBeFocused();

  await page.keyboard.press("Space");
  await expect(viewMenu).toBeVisible();
  await expect(today).toBeFocused();
  const scrollYBeforeNavigation = await page.evaluate(() => window.scrollY);

  await page.keyboard.press("ArrowDown");
  await expect(week).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollYBeforeNavigation);
  await page.keyboard.press("ArrowDown");
  await expect(month).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollYBeforeNavigation);
  await page.keyboard.press("ArrowUp");
  await expect(week).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollYBeforeNavigation);
  await page.keyboard.press("ArrowUp");
  await expect(today).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(year).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(today).toBeFocused();
  await page.keyboard.press("Home");
  await expect(today).toBeFocused();
  await page.keyboard.press("End");
  await expect(year).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollYBeforeNavigation);

  await page.keyboard.press("Enter");
  await expect(viewMenu).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(trigger).toContainText("Year");
  await expect(page.getByTestId("prototype-view-surface")).toHaveAttribute("data-view", "year");

  await page.keyboard.press("Enter");
  await expect(viewMenu).toBeVisible();
  await expect(year).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(month).toBeFocused();
  await page.keyboard.press("Space");
  await expect(viewMenu).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(trigger).toContainText("Month");
  await expect(page.getByTestId("prototype-view-surface")).toHaveAttribute("data-view", "month");

  await page.keyboard.press("Enter");
  await expect(viewMenu).toBeVisible();
  await expect(month).toBeFocused();
  const scrollYBeforeTab = await page.evaluate(() => window.scrollY);
  await page.keyboard.press("Tab");
  await expect(viewMenu).toBeHidden();
  await expect(page.getByRole("button", { name: "Previous month", exact: true }).first()).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollYBeforeTab);
});

test("selected date, scope, and view survive reload and browser history", async ({ page }) => {
  await openPrototype(page);
  const initialUrl = page.url();

  await chooseScope(page, "work");
  const screenHeader = page.locator("[data-screen-heading]").locator("xpath=ancestor::section[1]");
  await screenHeader.getByRole("button", { name: "Next day", exact: true }).click();
  await selectView(page, "week");
  const selectedUrl = page.url();
  expect(selectedUrl).not.toBe(initialUrl);
  await expect(page.getByTestId("prototype-date")).toHaveAttribute("data-date", "2026-09-25");

  await page.reload();
  await expectScope(page, "work");
  await expect(page.getByTestId("prototype-date")).toHaveAttribute("data-date", "2026-09-25");
  await expect(page.getByRole("button", { name: "Choose view", exact: true })).toContainText("Week");
  await expect(page.getByTestId("prototype-view-surface")).toHaveAttribute("data-view", "week");

  await page.goBack();
  await expect(page.getByTestId("prototype-date")).toHaveAttribute("data-date", "2026-09-25");
  await expect(page.getByRole("button", { name: "Choose view", exact: true })).toContainText("Today");
  await expect(page.getByTestId("prototype-view-surface")).toHaveAttribute("data-view", "today");
  await page.goBack();
  await expect(page.getByTestId("prototype-date")).toHaveAttribute("data-date", "2026-09-24");
  await page.goBack();
  await expectScope(page, "all");
  await page.goForward();
  await page.goForward();
  await page.goForward();
  await expectScope(page, "work");
  await expect(page.getByTestId("prototype-date")).toHaveAttribute("data-date", "2026-09-25");
  await expect(page.getByTestId("prototype-view-surface")).toHaveAttribute("data-view", "week");
});

test("calendar navigation crosses years and selects leap day with the derived weekday", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "prototype-1440", "Calendar edge dates are sampled on desktop.");
  await openPrototype(page);
  const nextMonth = page.getByRole("button", { name: "Next month" });

  for (let month = 0; month < 3; month += 1) await nextMonth.click();
  await expect(page.getByRole("heading", { name: "December 2026", exact: true })).toBeVisible();
  await nextMonth.click();
  await expect(page.getByRole("heading", { name: "January 2027", exact: true })).toBeVisible();
  for (let month = 0; month < 13; month += 1) await nextMonth.click();
  await expect(page.getByRole("heading", { name: "February 2028", exact: true })).toBeVisible();

  await page.getByRole("button", { name: /February 29, 2028/ }).click();
  const selectedDate = page.getByTestId("prototype-date");
  await expect(selectedDate).toHaveAttribute("data-date", "2028-02-29");
  const date = await selectedDate.getAttribute("data-date");
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
  await expect(selectedDate).toContainText(weekday);
});

test("invalid and inherited hash values fall back to the safe Today route", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "prototype-1440", "Malformed hash fallback is sampled on desktop.");
  await page.goto("/prototype#screen=constructor&date=2026-02-30");
  await expect(page.getByText("Kemtit Visual Prototype · Demo data only")).toBeVisible();
  await expect(page.locator("[data-screen-heading]")).toHaveText("Today");
  await expect(page.getByTestId("prototype-view-surface")).toHaveAttribute(
    "data-destination-id",
    "today",
  );
  await expect(page.getByTestId("prototype-date")).toHaveAttribute("data-date", "2026-09-24");
});

test("empty mode can create one confirmed local item without a server mutation", async ({ page }) => {
  await openPrototype(page);
  const mutations = trackMutatingRequests(page);

  await page.getByTestId("demo-mode-toggle").click();
  await expect(page.getByText("Empty workspace mode", { exact: true })).toBeVisible();
  await expect(page.getByText("Nothing here yet", { exact: true })).toBeVisible();
  const tasksMetric = page.getByText("Tasks complete", { exact: true }).locator("xpath=ancestor::article[1]");
  await expect(tasksMetric.locator("strong")).toHaveText("No data");
  await expect(page.getByTestId("task-row")).toHaveCount(0);

  const title = "Prototype confirmed local task";
  let input = await openQuickCapture(page);
  await input.fill(title);
  await input.press("Enter");
  await expect(page.getByTestId("capture-draft")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Review new demo item", exact: true })).toBeVisible();
  await page.getByTestId("capture-cancel").click();
  await expect(page.getByTestId("capture-draft")).toBeHidden();
  await expect(page.getByTestId("task-row")).toHaveCount(0);

  input = await openQuickCapture(page);
  await input.fill(title);
  await input.press("Enter");
  await expect(page.getByTestId("capture-draft")).toBeVisible();
  await captureField(page, "Type").selectOption({ label: "Task" });
  await captureField(page, "Scope").selectOption({ label: "Work" });
  const confirm = page.getByTestId("capture-confirm");
  const confirmBox = await confirm.boundingBox();
  expect(confirmBox).not.toBeNull();
  if (confirmBox) {
    await page.mouse.click(confirmBox.x + confirmBox.width / 2, confirmBox.y + confirmBox.height / 2, {
      clickCount: 2,
      delay: 30,
    });
  }

  const createdTask = page.getByTestId("task-row").filter({ hasText: title });
  await expect(createdTask).toHaveCount(1);
  const createdTaskId = await createdTask.getAttribute("data-record-id");
  expect(createdTaskId).toBeTruthy();
  const createdDetail = page.locator(
    `[data-testid="prototype-record-detail"][data-record-id="${createdTaskId}"]`,
  );
  await expect(createdDetail).toBeVisible();
  await expect(createdDetail).toBeFocused();
  await expect(createdDetail).toBeInViewport();

  const navigation = await openPrototypeNavigation(page);
  await navigation
    .locator('[data-testid="prototype-nav-destination"][data-destination-id="today"]')
    .click();
  await closePrototypeNavigation(page);
  await expect(page.getByTestId("task-row").filter({ hasText: title })).toHaveCount(1);
  await expect(tasksMetric.locator("strong")).toHaveText("0/1");
  expect(mutations).toEqual([]);
});

test("capture dialog keeps internal padding clicks, spacing, and error styling stable", async ({ page }) => {
  await openPrototype(page);
  const input = await openQuickCapture(page);
  await input.fill("Dialog padding regression");
  await input.press("Enter");

  const draft = page.getByTestId("capture-draft");
  const body = page.getByTestId("capture-dialog-body");
  await expect(draft).toBeVisible();
  const bodyBox = await body.boundingBox();
  expect(bodyBox).not.toBeNull();
  if (bodyBox) {
    await page.mouse.click(bodyBox.x + 4, bodyBox.y + 4);
  }
  await expect(draft).toBeVisible();

  const description = draft.locator("#capture-description");
  const form = draft.locator("form");
  const [descriptionBox, formBox] = await Promise.all([description.boundingBox(), form.boundingBox()]);
  expect(descriptionBox).not.toBeNull();
  expect(formBox).not.toBeNull();
  if (descriptionBox && formBox) {
    expect(formBox.y - (descriptionBox.y + descriptionBox.height)).toBeGreaterThanOrEqual(12);
  }

  await captureField(page, "Title").fill("");
  await page.getByTestId("capture-confirm").click();
  const alert = draft.getByRole("alert");
  await expect(alert).toBeVisible();
  await expect(alert).toHaveCSS("color", "rgb(180, 35, 24)");
  await page.getByTestId("capture-cancel").click();
});

test("capture requires scope and rejects an invalid bill amount", async ({ page }) => {
  await openPrototype(page);
  const createdRecords = page.locator('[data-record-id^="prototype-created-"]');

  let input = await openQuickCapture(page);
  await input.fill("Missing scope validation item");
  await input.press("Enter");
  await captureField(page, "Type").selectOption({ label: "Task" });
  await page.getByTestId("capture-confirm").click();
  await expect(page.getByTestId("capture-draft")).toBeVisible();
  await expect(page.getByTestId("capture-draft").getByRole("alert")).toHaveText("Choose Work or Life area before planning this item.");
  await expect(
    page.getByTestId("task-row").filter({ hasText: "Missing scope validation item" }),
  ).toHaveCount(0);
  await page.getByTestId("capture-cancel").click();

  input = await openQuickCapture(page);
  await input.fill("Invalid bill amount validation");
  await input.press("Enter");
  await captureField(page, "Type").selectOption({ label: "Bill" });
  await captureField(page, "Scope").selectOption({ label: "Life" });
  const amount = captureField(page, "Amount (THB)");
  await expect(page.getByTestId("capture-draft")).toBeVisible();
  for (const invalidAmount of ["0", "-1", "199.501"]) {
    await amount.fill(invalidAmount);
    await page.getByTestId("capture-confirm").click();
    const amountIsValid = await amount.evaluate((element) =>
      (element as HTMLInputElement).checkValidity(),
    );
    expect(amountIsValid).toBe(false);
    await expect(page.getByTestId("capture-draft")).toBeVisible();
    await expect(createdRecords).toHaveCount(0);
  }
  await page.getByTestId("capture-cancel").click();
});

test("correcting a bill title clears its stale error while the amount is invalid", async ({ page }) => {
  await openPrototype(page);

  const input = await openQuickCapture(page);
  await input.fill("Temporary bill title");
  await input.press("Enter");
  await captureField(page, "Type").selectOption({ label: "Bill" });
  await captureField(page, "Scope").selectOption({ label: "Life" });

  const draft = page.getByTestId("capture-draft");
  const title = captureField(page, "Title");
  const amount = captureField(page, "Amount (THB)");
  await title.fill("");
  await amount.fill("0.50");
  await page.getByTestId("capture-confirm").click();
  await expect(draft.getByRole("alert")).toHaveText(
    "Enter a title before adding this demo item.",
  );

  await amount.fill("199.501");
  expect(
    await amount.evaluate((element) => (element as HTMLInputElement).checkValidity()),
  ).toBe(false);
  await title.fill("Corrected bill title");
  await page.getByTestId("capture-confirm").click();
  await expect(draft.getByRole("alert")).toHaveCount(0);
  await expect(draft).toBeVisible();
  await page.getByTestId("capture-cancel").click();
});

test("fractional bill amounts preserve cents in their details", async ({ page }) => {
  await openPrototype(page);
  const mutations = trackMutatingRequests(page);

  for (const [title, amountText] of [
    ["Prototype bill with cents", "199.50"],
    ["Prototype small bill with cents", "0.50"],
  ] as const) {
    const input = await openQuickCapture(page);
    await input.fill(title);
    await input.press("Enter");
    await captureField(page, "Type").selectOption({ label: "Bill" });
    await captureField(page, "Date").fill("2026-09-24");
    await captureField(page, "Scope").selectOption({ label: "Life" });
    const amount = captureField(page, "Amount (THB)");
    await amount.fill(amountText);
    expect(
      await amount.evaluate((element) => (element as HTMLInputElement).checkValidity()),
    ).toBe(true);
    await page.getByTestId("capture-confirm").click();
    await expect(page.getByTestId("capture-draft")).toHaveCount(0);

    const billRow = page.getByTestId("prototype-record-row").filter({ hasText: title });
    await expect(billRow).toHaveCount(1);
    const recordId = await billRow.getAttribute("data-record-id");
    expect(recordId).toBeTruthy();
    await billRow.click();
    const detail = page.locator(
      `[data-testid="prototype-record-detail"][data-record-id="${recordId}"]`,
    );
    await expect(detail).toBeVisible();
    await expect(detail.locator("p")).toContainText(new RegExp(amountText.replace(".", "\\.")));
    await detail.getByRole("button", { name: "Close details", exact: true }).click();
  }

  expect(mutations).toEqual([]);
});

test("a confirmed bill remains a bill and does not change the monthly balance", async ({ page }) => {
  await openPrototype(page);
  const mutations = trackMutatingRequests(page);
  const balanceMetric = page.locator("article").filter({ hasText: "Monthly balance" });
  await expect(balanceMetric).toHaveCount(1);
  const originalBalance = await balanceMetric.locator("strong").textContent();
  expect(originalBalance).toBeTruthy();

  const title = "Prototype unpaid bill regression";
  const input = await openQuickCapture(page);
  await input.fill(title);
  await input.press("Enter");
  await captureField(page, "Type").selectOption({ label: "Bill" });
  await captureField(page, "Date").fill("2026-09-24");
  await captureField(page, "Scope").selectOption({ label: "Life" });
  await captureField(page, "Amount (THB)").fill("4200");
  await page.getByTestId("capture-confirm").click();

  const billRow = page.getByTestId("prototype-record-row").filter({ hasText: title });
  await expect(billRow).toHaveCount(1);
  await expect(billRow).toContainText("Bill");
  await expect(billRow).not.toHaveAttribute("aria-pressed", "true");
  const billRecordId = await billRow.getAttribute("data-record-id");
  expect(billRecordId).toBeTruthy();
  await billRow.click();
  const billDetail = page.locator(
    `[data-testid="prototype-record-detail"][data-record-id="${billRecordId}"]`,
  );
  await expect(billDetail).toBeVisible();
  const integerAmountDisplay = new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(4200);
  const billDetailText = await billDetail.locator("p").textContent();
  expect(billDetailText).toContain(integerAmountDisplay);
  expect(billDetailText).not.toMatch(/4[,.]?200[,.]00/);
  await billDetail.getByRole("button", { name: "Close details", exact: true }).click();

  const navigation = await openPrototypeNavigation(page);
  const overview = navigation.locator(
    '[data-testid="prototype-nav-destination"][data-destination-id="finance-overview"]',
  );
  await expect(overview).toBeVisible();
  await overview.click();
  await expect(page.getByTestId("prototype-view-surface")).toHaveAttribute(
    "data-destination-id",
    "finance-overview",
  );
  const balanceSection = page.getByText("Monthly balance", { exact: true }).locator("xpath=ancestor::section[1]");
  await expect(balanceSection).toContainText(originalBalance!);
  expect(mutations).toEqual([]);
});

test("event capture requires a start time and positive duration", async ({ page }) => {
  await openPrototype(page);

  const invalidEventRecords = page.locator('[data-record-id^="prototype-created-"]');
  let input = await openQuickCapture(page);
  await input.fill("Event missing start time");
  await input.press("Enter");
  await captureField(page, "Type").selectOption({ label: "Event" });
  await captureField(page, "Scope").selectOption({ label: "Work" });
  await captureField(page, "Start time").fill("");
  await page.getByTestId("capture-confirm").click();
  await expect(page.getByTestId("capture-draft")).toBeVisible();
  await expect(page.getByTestId("capture-draft").getByRole("alert")).toBeVisible();
  await expect(invalidEventRecords).toHaveCount(0);
  const shortcut = process.platform === "darwin" ? "Meta+k" : "Control+k";
  await page.keyboard.press(shortcut);
  await expect(page.getByTestId("capture-draft")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Quick capture", exact: true })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await page.getByTestId("capture-cancel").click();

  input = await openQuickCapture(page);
  await input.fill("Event with zero duration");
  await input.press("Enter");
  await captureField(page, "Type").selectOption({ label: "Event" });
  await captureField(page, "Scope").selectOption({ label: "Work" });
  await captureField(page, "Start time").fill("09:30");
  await captureField(page, "Duration (minutes)").fill("0");
  await page.getByTestId("capture-confirm").click();
  await expect(page.getByTestId("capture-draft")).toBeVisible();
  await expect(page.getByTestId("capture-draft").getByRole("alert")).toBeVisible();
  await expect(invalidEventRecords).toHaveCount(0);
  await page.getByTestId("capture-cancel").click();
});

test("long event titles wrap inside the timeline without horizontal overflow", async ({ page }) => {
  await openPrototype(page);
  const title = "LONGEVENTTITLE".repeat(20);
  const input = await openQuickCapture(page);
  await input.fill(title);
  await input.press("Enter");
  await captureField(page, "Type").selectOption({ label: "Event" });
  await captureField(page, "Scope").selectOption({ label: "Work" });
  await captureField(page, "Start time").fill("17:30");
  await captureField(page, "Duration (minutes)").fill("30");
  await page.getByTestId("capture-confirm").click();

  const detail = page.getByTestId("prototype-record-detail");
  await expect(detail).toBeVisible();
  const recordId = await detail.getAttribute("data-record-id");
  expect(recordId).toBeTruthy();
  const eventButton = page.locator(`button[data-record-id="${recordId}"]`);
  await expect(eventButton).toBeVisible();
  const dimensions = await eventButton.evaluate((element) => ({
    clientWidth: (element as HTMLElement).clientWidth,
    scrollWidth: (element as HTMLElement).scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  await expectNoHorizontalOverflow(page);
});

test("selecting an existing result does not duplicate it; same-title tasks complete by ID", async ({ page }) => {
  await openPrototype(page);

  const title = "Finish Kemtit redesign";
  const originalRows = page.getByTestId("task-row").filter({ hasText: title });
  await expect(originalRows).toHaveCount(1);
  const originalId = await originalRows.getAttribute("data-record-id");
  expect(originalId).toBeTruthy();

  const input = await openQuickCapture(page);
  await input.fill(title);
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(page.getByTestId("task-row").filter({ hasText: title })).toHaveCount(1);
  await expect(page.getByTestId("capture-draft")).toHaveCount(0);

  await page.keyboard.press("Escape");
  const duplicateInput = await openQuickCapture(page);
  await duplicateInput.fill(title);
  await page.getByRole("button", { name: "Create new demo item", exact: true }).click();
  await expect(page.getByTestId("capture-draft")).toBeVisible();
  await captureField(page, "Type").selectOption({ label: "Task" });
  await captureField(page, "Scope").selectOption({ label: "Work" });
  await page.getByTestId("capture-confirm").click();

  const sameTitleRows = page.getByTestId("task-row").filter({ hasText: title });
  await expect(sameTitleRows).toHaveCount(2);
  const recordIds = await sameTitleRows.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-record-id")),
  );
  expect(recordIds.every((id) => Boolean(id))).toBe(true);
  expect(new Set(recordIds).size).toBe(2);
  const createdId = recordIds.find((id) => id !== originalId);
  expect(createdId).toBeTruthy();

  const createdRow = page.locator(
    `[data-testid="task-row"][data-record-id="${createdId}"]`,
  );
  const originalRow = page.locator(
    `[data-testid="task-row"][data-record-id="${originalId}"]`,
  );
  await createdRow.click();
  await expect(createdRow).toHaveAttribute("data-completed", "true");
  await expect(originalRow).toHaveAttribute("data-completed", "false");
});

test("keyboard shortcut, suggestion navigation, and IME composition guard work", async ({ page }) => {
  await openPrototype(page);
  const shortcut = process.platform === "darwin" ? "Meta+k" : "Control+k";
  await page.keyboard.press(shortcut);
  const input = page.getByRole("combobox", { name: "Quick capture", exact: true });
  await expect(input).toBeFocused();

  await input.fill("Client meeting");
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(page.getByTestId("prototype-view-surface")).toHaveAttribute(
    "data-destination-id",
    "calendar-schedule",
  );
  const openedDetail = page.locator(
    '[data-testid="prototype-record-detail"][data-record-id="event-client-meeting"]',
  );
  await expect(openedDetail).toHaveCount(1);
  await expect(openedDetail).toBeFocused();
  await expect(openedDetail).toBeInViewport();
  await expect(page.getByTestId("capture-draft")).toHaveCount(0);

  await page.keyboard.press("Escape");
  const resumedInput = await openQuickCapture(page);
  await resumedInput.fill("IME guarded demo item");
  await resumedInput.evaluate((element) => {
    element.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true, data: "IME guarded demo item" }),
    );
  });
  await resumedInput.press("Enter");
  await expect(page.getByTestId("capture-draft")).toHaveCount(0);

  await resumedInput.evaluate((element) => {
    element.dispatchEvent(
      new CompositionEvent("compositionend", { bubbles: true, data: "IME guarded demo item" }),
    );
  });
  await resumedInput.press("Enter");
  await expect(page.getByTestId("capture-draft")).toBeVisible();
  await page.getByTestId("capture-cancel").click();
});

test("view and search popovers stay anchored without moving content across themes and widths", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "prototype-390", "Run the explicit four-width geometry sweep once.");
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openPrototype(page);
  mkdirSync(EVIDENCE_DIR, { recursive: true });

  const widths = [320, 390, 768, 1440];
  const heading = page.locator("[data-screen-heading]");
  const trigger = page.getByRole("button", { name: "Choose view", exact: true });
  const viewPopover = page.getByTestId("prototype-view-popover");
  const input = page.getByRole("combobox", { name: "Quick capture", exact: true });
  const suggestionPopover = page.getByTestId("prototype-suggestion-popover");

  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const direction of DESIGN_DIRECTIONS) {
      await page.getByRole("button", { name: new RegExp(direction.label) }).click();
      await expect(heading).toBeVisible();
      const closedHeading = await heading.boundingBox();
      expect(closedHeading).not.toBeNull();

      await trigger.click();
      await expect(viewPopover).toBeVisible();
      await expect(viewPopover).toHaveCSS("transform", /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
      const [triggerBox, viewBox, openHeading] = await Promise.all([
        trigger.boundingBox(),
        viewPopover.boundingBox(),
        heading.boundingBox(),
      ]);
      expect(triggerBox).not.toBeNull();
      expect(viewBox).not.toBeNull();
      expect(openHeading).not.toBeNull();
      if (triggerBox && viewBox && closedHeading && openHeading) {
        expect(viewBox.y).toBeGreaterThanOrEqual(triggerBox.y + triggerBox.height - 1);
        expect(viewBox.y - (triggerBox.y + triggerBox.height)).toBeLessThanOrEqual(10);
        expect(Math.abs(viewBox.x + viewBox.width - (triggerBox.x + triggerBox.width))).toBeLessThanOrEqual(1);
        expect(viewBox.x).toBeGreaterThanOrEqual(0);
        expect(viewBox.x + viewBox.width).toBeLessThanOrEqual(width);
        expect(viewBox.height).toBeLessThanOrEqual(280);
        expect(Math.abs(openHeading.y - closedHeading.y)).toBeLessThanOrEqual(1);
      }
      await expectNoHorizontalOverflow(page);

      const weekOption = page.getByRole("menuitemradio", { name: /^Week\b/ });
      await expect(weekOption).toBeVisible();
      const weekBox = await weekOption.boundingBox();
      expect(weekBox).not.toBeNull();
      if (weekBox) {
        const hitLabel = await page.evaluate(({ x, y }) => {
          const hit = document.elementFromPoint(x, y)?.closest('[role="menuitemradio"]');
          return hit?.querySelector("strong")?.textContent?.trim() ?? null;
        }, { x: weekBox.x + weekBox.width / 2, y: weekBox.y + weekBox.height / 2 });
        expect(hitLabel).toBe("Week");
      }
      if (width === 390 && direction.key === "minimal") {
        await page.screenshot({
          path: join(EVIDENCE_DIR, `${testInfo.project.name}-dropdown-view-open.png`),
          animations: "disabled",
        });
      }

      await weekOption.click();
      await expect(viewPopover).toBeHidden();
      await expect(trigger).toContainText("Week");
      await expect(page.getByTestId("prototype-view-surface")).toHaveAttribute("data-view", "week");
      const selectedHeading = await heading.boundingBox();
      expect(selectedHeading).not.toBeNull();
      if (closedHeading && selectedHeading) {
        expect(Math.abs(selectedHeading.y - closedHeading.y)).toBeLessThanOrEqual(1);
      }

      await input.click();
      await expect(viewPopover).toBeHidden();
      await expect(input).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByRole("listbox", { name: "Quick capture suggestions" })).toBeVisible();
      await expect(page.getByRole("option").first()).toBeVisible();
      await expect(suggestionPopover).toHaveCSS("transform", /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
      const searchField = input.locator("xpath=..");
      const [searchFieldBox, suggestionBox, searchHeading] = await Promise.all([
        searchField.boundingBox(),
        suggestionPopover.boundingBox(),
        heading.boundingBox(),
      ]);
      expect(searchFieldBox).not.toBeNull();
      expect(suggestionBox).not.toBeNull();
      expect(searchHeading).not.toBeNull();
      if (searchFieldBox && suggestionBox && searchHeading && closedHeading) {
        const fieldBottom = searchFieldBox.y + searchFieldBox.height;
        expect(suggestionBox.y).toBeGreaterThanOrEqual(fieldBottom);
        expect(suggestionBox.y - fieldBottom).toBeLessThanOrEqual(12);
        expect(Math.abs(suggestionBox.x - searchFieldBox.x)).toBeLessThanOrEqual(1);
        expect(suggestionBox.x).toBeGreaterThanOrEqual(0);
        expect(suggestionBox.x + suggestionBox.width).toBeLessThanOrEqual(width);
        if (width === 1440) {
          expect(Math.abs(suggestionBox.width - searchFieldBox.width)).toBeLessThanOrEqual(1);
        }
        expect(Math.abs(searchHeading.y - closedHeading.y)).toBeLessThanOrEqual(1);
      }
      await expectNoHorizontalOverflow(page);

      await input.press("Escape");
      await expect(input).toHaveAttribute("aria-expanded", "false");
      await expect(suggestionPopover).toBeHidden();

      await input.click();
      await expect(suggestionPopover).toBeVisible();
      await trigger.click();
      await expect(suggestionPopover).toBeHidden();
      await expect(viewPopover).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(viewPopover).toBeHidden();

      await trigger.click();
      await expect(viewPopover).toBeVisible();
      await heading.click({ position: { x: 1, y: 1 } });
      await expect(viewPopover).toBeHidden();
    }
  }

  await page.setViewportSize({ width: 390, height: 600 });
  const scrollYBeforeArrow = await page.evaluate(() => window.scrollY);
  await input.click();
  const suggestionList = page.getByRole("listbox", { name: "Quick capture suggestions" });
  await input.press("ArrowUp");
  await expect(page.locator('[role="option"][aria-selected="true"]')).toBeVisible();
  await expect.poll(() => suggestionList.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(suggestionPopover).toHaveCSS("transform", /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  const activeSuggestionBounds = await page.evaluate(() => {
    const list = document.querySelector<HTMLElement>('[role="listbox"]');
    const activeOption = list?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]');
    if (!list || !activeOption) return null;
    const listBounds = list.getBoundingClientRect();
    const optionBounds = activeOption.getBoundingClientRect();
    return {
      scrollY: window.scrollY,
      optionTop: optionBounds.top,
      optionBottom: optionBounds.bottom,
      listTop: listBounds.top,
      listBottom: listBounds.bottom,
    };
  });
  expect(activeSuggestionBounds).not.toBeNull();
  if (activeSuggestionBounds) {
    expect(activeSuggestionBounds.optionTop).toBeGreaterThanOrEqual(activeSuggestionBounds.listTop - 1);
    expect(activeSuggestionBounds.optionBottom).toBeLessThanOrEqual(activeSuggestionBounds.listBottom + 1);
    expect(activeSuggestionBounds.scrollY).toBe(scrollYBeforeArrow);
  }
  await input.press("Escape");
  await expect(suggestionPopover).toBeHidden();

  await page.setViewportSize({ width: 390, height: 500 });
  const shortViewHeading = await heading.boundingBox();
  await trigger.click();
  await expect(viewPopover).toBeVisible();
  await expect(viewPopover).toHaveCSS("transform", /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  const [shortTriggerBox, shortViewBox, shortOpenHeading] = await Promise.all([
    trigger.boundingBox(),
    viewPopover.boundingBox(),
    heading.boundingBox(),
  ]);
  expect(shortTriggerBox).not.toBeNull();
  expect(shortViewBox).not.toBeNull();
  expect(shortOpenHeading).not.toBeNull();
  if (shortTriggerBox && shortViewBox && shortOpenHeading && shortViewHeading) {
    expect(shortViewBox.y).toBeGreaterThanOrEqual(shortTriggerBox.y + shortTriggerBox.height - 1);
    expect(shortViewBox.y + shortViewBox.height).toBeLessThanOrEqual(500);
    expect(Math.abs(shortOpenHeading.y - shortViewHeading.y)).toBeLessThanOrEqual(1);
  }
  await page.getByRole("menuitemradio", { name: /^Year\b/ }).click();
  await expect(viewPopover).toBeHidden();
  await expect(trigger).toContainText("Year");

  await input.click();
  await expect(suggestionPopover).toBeVisible();
  await expect(suggestionPopover).toHaveCSS("transform", /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  const shortSearchBox = await suggestionPopover.boundingBox();
  expect(shortSearchBox).not.toBeNull();
  if (shortSearchBox) expect(shortSearchBox.y + shortSearchBox.height).toBeLessThanOrEqual(500);
  await input.press("ArrowUp");
  await expect.poll(() => suggestionList.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(page.locator('[role="option"][aria-selected="true"]')).toBeVisible();
  await input.press("Escape");
  await expect(suggestionPopover).toBeHidden();

  await input.click();
  await expect(page.getByRole("option", { name: /Client meeting/ })).toBeVisible();
  await page.getByRole("option", { name: /Client meeting/ }).click();
  await expect(suggestionPopover).toBeHidden();
  await expect(page.locator('[data-testid="prototype-record-detail"][data-record-id="event-client-meeting"]')).toHaveCount(1);
  await expect(page.getByTestId("prototype-view-surface")).toHaveAttribute("data-destination-id", "calendar-schedule");
});

test("mobile drawer opens with keyboard and Escape returns focus; resize closes it", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "prototype-390", "The drawer is tested at its compact breakpoint.");
  await openPrototype(page);
  const openButton = page.getByTestId("mobile-menu-button");
  await expect(openButton).toBeVisible();
  await openButton.focus();
  await page.keyboard.press("Enter");

  const drawer = page.getByTestId("mobile-drawer");
  await expect(drawer).toBeVisible();
  const focusInsideDrawer = await page.evaluate(() =>
    Boolean(document.activeElement?.closest('[data-testid="mobile-drawer"]')),
  );
  expect(focusInsideDrawer).toBe(true);
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(openButton).toBeFocused();

  await openButton.click();
  await expect(drawer).toBeVisible();
  await page.setViewportSize({ width: COMPACT_NAV_BREAKPOINT + 1, height: 844 });
  await expect(drawer).toBeVisible();
  expect(await drawer.getAttribute("role")).toBeNull();
  expect(await drawer.getAttribute("aria-modal")).toBeNull();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await expect(openButton).toBeHidden();
  await expect(page.getByRole("navigation", { name: "Prototype navigation" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("prototype keeps the page within mobile and breakpoint boundary widths", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "prototype-390", "The responsive width sweep runs once.");
  await openPrototype(page);

  for (const width of [
    320,
    360,
    759,
    760,
    761,
    COMPACT_NAV_BREAKPOINT - 1,
    COMPACT_NAV_BREAKPOINT,
    COMPACT_NAV_BREAKPOINT + 1,
  ]) {
    await page.setViewportSize({ width, height: 844 });
    await expectNoHorizontalOverflow(page);
    await expectPrototypeDateControls(page);
    await expect(page.locator("main")).toBeVisible();
  }
});

test("reduced motion removes nonessential transition while selection still responds", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "prototype-1440", "Reduced-motion behavior is sampled on desktop.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openPrototype(page);

  const themeButton = page.getByRole("button", { name: /Dark Focus/ });
  const transitionSeconds = await themeButton.evaluate((element) =>
    getComputedStyle(element)
      .transitionDuration.split(",")
      .map((duration) => {
        const value = Number.parseFloat(duration);
        return duration.trim().endsWith("ms") ? value / 1000 : value;
      })
      .reduce((longest, duration) => Math.max(longest, duration), 0),
  );
  expect(transitionSeconds).toBeLessThanOrEqual(0.001);
  await themeButton.click();
  await expect(page.getByRole("heading", { name: "Dark Focus", exact: true })).toBeVisible();
});
