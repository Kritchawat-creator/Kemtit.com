import { expect, test, type Page } from "@playwright/test";

import { E2E_TEST_PASSWORD, latestOtpFor, registerWithPassword, uniqueEmail } from "./helpers";

const loginViewports = [
  { width: 360, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 393, height: 852 },
  { width: 430, height: 932 },
  { width: 390, height: 667 },
  { width: 767, height: 900 },
  { width: 768, height: 1024 },
  { width: 820, height: 1180 },
  { width: 834, height: 1194 },
  { width: 1024, height: 768 },
  { width: 1024, height: 1366 },
  { width: 1151, height: 900 },
  { width: 1152, height: 900 },
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1728, height: 1117 },
  { width: 1920, height: 1080 },
];

const localeCopy = {
  th: {
    title: "เข้าสู่ระบบ",
    email: "อีเมล",
    signIn: "เข้าสู่ระบบ",
    register: "สมัครใช้งาน",
    code: "รหัสยืนยัน 6 หลัก",
    password: "รหัสผ่าน",
  },
  en: {
    title: "Sign in",
    email: "Email",
    signIn: "Sign in",
    register: "Create an account",
    code: "6-digit verification code",
    password: "Password",
  },
} as const;

async function expectUnifiedStackedSurface(page: Page, expectedPadding: number) {
  const shell = page.locator("[data-login-page]");
  const formPanel = page.locator("[data-login-card]");
  const shellMetrics = await shell.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      border: style.borderTopStyle,
      borderWidth: Number.parseFloat(style.borderTopWidth),
      radius: Number.parseFloat(style.borderTopLeftRadius),
      shadow: style.boxShadow,
      paddingTop: Number.parseFloat(style.paddingTop),
      paddingBottom: Number.parseFloat(style.paddingBottom),
    };
  });
  const formMetrics = await formPanel.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      border: style.borderTopStyle,
      radius: Number.parseFloat(style.borderTopLeftRadius),
      shadow: style.boxShadow,
      paddingTop: Number.parseFloat(style.paddingTop),
      paddingLeft: Number.parseFloat(style.paddingLeft),
    };
  });
  const shellBox = await shell.boundingBox();
  const formBox = await formPanel.boundingBox();

  expect(shellMetrics.background).not.toBe("rgba(0, 0, 0, 0)");
  expect(shellMetrics.border).toBe("solid");
  expect(shellMetrics.borderWidth).toBe(1);
  expect(shellMetrics.radius).toBeGreaterThanOrEqual(18);
  expect(shellMetrics.shadow).not.toBe("none");
  expect(shellMetrics.paddingTop).toBe(expectedPadding);
  expect(shellMetrics.paddingBottom).toBe(expectedPadding);

  expect(formMetrics.background).toBe("rgba(0, 0, 0, 0)");
  expect(formMetrics.border).toBe("none");
  expect(formMetrics.radius).toBe(0);
  expect(formMetrics.shadow).toBe("none");
  expect(formMetrics.paddingTop).toBe(0);
  expect(formMetrics.paddingLeft).toBe(expectedPadding);

  expect(shellBox).not.toBeNull();
  expect(formBox).not.toBeNull();
  expect(formBox!.x).toBeGreaterThanOrEqual(shellBox!.x + 1);
  expect(formBox!.x + formBox!.width).toBeLessThanOrEqual(shellBox!.x + shellBox!.width - 1);

  return { shellBox, formBox };
}

test("login stays usable across Thai and English responsive layouts", async ({
  page,
}, testInfo) => {
  const next = "/today?source=login&view=focus";

  for (const locale of ["th", "en"] as const) {
    await page.goto("/login");
    await page
      .context()
      .addCookies([{ name: "KEMTIT_LOCALE", value: locale, url: new URL(page.url()).origin }]);
    await page.goto("/login?next=" + encodeURIComponent(next));

    const copy = localeCopy[locale];
    const emailInput = page.getByLabel(copy.email);
    const submitButton = page.getByRole("button", { name: copy.signIn, exact: true });
    const registerLink = page.getByRole("link", { name: copy.register });

    await expect(page.getByRole("heading", { name: copy.title })).toBeVisible();
    await expect(page.locator("[data-login-brand-mark] img")).toHaveAttribute(
      "src",
      /kemtit-logo-v2-transparent\.png/,
    );
    await expect(emailInput).toBeVisible();
    await page.getByLabel(copy.password, { exact: true }).fill(E2E_TEST_PASSWORD);
    await expect(submitButton).toBeVisible();
    await expect(registerLink).toHaveAttribute(
      "href",
      "/register?next=" + encodeURIComponent(next),
    );
    const registerHref = await registerLink.getAttribute("href");
    expect(registerHref).not.toBeNull();
    expect(new URL(registerHref!, page.url()).searchParams.get("next")).toBe(next);

    for (const viewport of loginViewports) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
        .toBe(true);

      const inputBox = await emailInput.boundingBox();
      const submitBox = await submitButton.boundingBox();
      const registerBox = await registerLink.boundingBox();
      const googleBox = await page
        .getByRole("button", {
          name: locale === "th" ? "เข้าสู่ระบบด้วย Google" : "Continue with Google",
        })
        .boundingBox();
      expect(inputBox?.height).toBeGreaterThanOrEqual(44);
      expect(submitBox?.height).toBeGreaterThanOrEqual(44);
      expect(registerBox?.height).toBeGreaterThanOrEqual(44);
      expect(googleBox?.height).toBeGreaterThanOrEqual(44);
      const introBox = await page.locator("[data-login-page] > aside").boundingBox();
      const formPanel = page.locator("[data-login-card]");
      const formBox = await formPanel.boundingBox();
      const pageBox = await page.locator("[data-login-page]").boundingBox();
      const languageBox = await page.locator("[data-login-language-control]").boundingBox();
      expect(introBox).not.toBeNull();
      expect(formBox).not.toBeNull();
      expect(pageBox).not.toBeNull();
      expect(languageBox).not.toBeNull();

      if (viewport.width >= 1152) {
        expect(formBox!.x).toBeGreaterThan(introBox!.x + introBox!.width - 1);
        expect(formBox!.width).toBeGreaterThanOrEqual(420);
        expect(formBox!.width).toBeLessThanOrEqual(480);
        expect(introBox!.width).toBeGreaterThan(formBox!.width);
        expect(
          Math.abs(languageBox!.x + languageBox!.width - pageBox!.x - pageBox!.width),
        ).toBeLessThanOrEqual(1);
        const desktopMetrics = await page.locator("[data-login-page]").evaluate((root) => {
          const style = (selector: string) => {
            const element = root.querySelector(selector);
            if (!element) throw new Error("Missing desktop login element: " + selector);
            return getComputedStyle(element);
          };
          return {
            brand: Number.parseFloat(style("[data-login-brand-name]").fontSize),
            logo: Number.parseFloat(style("[data-login-brand-mark] img").width),
            hero: Number.parseFloat(style("[data-login-hero-title]").fontSize),
            accent: Number.parseFloat(style("[data-login-hero-title] span:last-child").fontSize),
          };
        });
        expect(desktopMetrics.brand).toBeGreaterThanOrEqual(28);
        expect(desktopMetrics.brand).toBeLessThanOrEqual(32);
        expect(desktopMetrics.logo).toBeGreaterThanOrEqual(48);
        expect(desktopMetrics.logo).toBeLessThanOrEqual(56);
        expect(desktopMetrics.hero).toBeGreaterThanOrEqual(40);
        expect(desktopMetrics.hero).toBeLessThanOrEqual(48);
        expect(desktopMetrics.accent).toBeGreaterThanOrEqual(44);
        expect(desktopMetrics.accent).toBeLessThanOrEqual(52);
        const benefitsBox = await page.locator("[data-login-benefits]").boundingBox();
        const artworkBox = await page.locator("[data-login-artwork]").boundingBox();
        expect(benefitsBox).not.toBeNull();
        expect(artworkBox).not.toBeNull();
        expect(benefitsBox!.y + benefitsBox!.height).toBeLessThanOrEqual(artworkBox!.y + 2);
      } else {
        const artworkBox = await page.locator("[data-login-artwork]").boundingBox();
        expect(artworkBox).not.toBeNull();
        expect(formBox!.y).toBeGreaterThanOrEqual(artworkBox!.y + artworkBox!.height - 1);

        const mainPadding = await page.locator("main").evaluate((main) => ({
          left: Number.parseFloat(getComputedStyle(main).paddingLeft),
          right: Number.parseFloat(getComputedStyle(main).paddingRight),
        }));
        const shellPadding = viewport.width <= 390 ? 18 : viewport.width <= 767 ? 24 : 32;
        const { shellBox: sharedShellBox, formBox: sharedFormBox } =
          await expectUnifiedStackedSurface(page, shellPadding);
        expect(sharedShellBox).not.toBeNull();
        expect(sharedFormBox).not.toBeNull();
        if (viewport.width <= 767) {
          expect(mainPadding.left).toBeGreaterThanOrEqual(16);
          expect(mainPadding.left).toBeLessThanOrEqual(20);
          expect(mainPadding.right).toBeGreaterThanOrEqual(16);
          expect(mainPadding.right).toBeLessThanOrEqual(20);
          expect(formBox!.width).toBeLessThan(pageBox!.width);
        } else {
          expect(pageBox!.width).toBeLessThanOrEqual(864);
          expect(formBox!.width).toBeGreaterThan(600);
          expect(formBox!.width).toBeLessThanOrEqual(720);
        }

        const alignedElements = [
          page.locator("[data-login-brand-mark]"),
          page.locator("[data-login-hero-title]"),
          page.locator("[data-login-brand-tagline]"),
          page.locator("[data-login-title]"),
          page.locator("[data-login-email-label]"),
          emailInput,
        ];
        const alignedBoxes = await Promise.all(
          alignedElements.map((element) => element.boundingBox()),
        );
        expect(alignedBoxes.every((box) => box !== null)).toBe(true);
        const leftEdges = alignedBoxes.map((box) => box!.x);
        expect(Math.max(...leftEdges) - Math.min(...leftEdges)).toBeLessThanOrEqual(2);
        expect(
          Math.abs(languageBox!.x + languageBox!.width - inputBox!.x - inputBox!.width),
        ).toBeLessThanOrEqual(2);
        const artworkMask = await page
          .locator("[data-login-artwork]")
          .evaluate((artwork) => getComputedStyle(artwork).maskImage);
        expect(artworkMask).toContain("linear-gradient");

        const languageButtons = await page
          .locator("[data-login-language-control] button")
          .all()
          .then((buttons) => Promise.all(buttons.map((button) => button.boundingBox())));
        const brandBox = alignedBoxes[0];
        expect(brandBox).not.toBeNull();
        expect(languageButtons.every((box) => box !== null && box.height >= 44)).toBe(true);
        expect(languageButtons.every((box) => box!.x >= brandBox!.x + brandBox!.width)).toBe(true);

        const heroMetrics = await page.locator("[data-login-page]").evaluate((root) => {
          const getStyle = (selector: string) => {
            const element = root.querySelector(selector);
            if (!element) throw new Error("Missing login typography target: " + selector);
            return window.getComputedStyle(element);
          };
          const hero = getStyle("[data-login-hero-title]");
          const title = getStyle("[data-login-title]");
          return {
            brand: Number.parseFloat(getStyle("[data-login-brand-name]").fontSize),
            logo: Number.parseFloat(getStyle("[data-login-brand-mark] img").width),
            hero: Number.parseFloat(hero.fontSize),
            accent: Number.parseFloat(getStyle("[data-login-hero-title] span:last-child").fontSize),
            lineHeight: Number.parseFloat(hero.lineHeight),
            title: Number.parseFloat(title.fontSize),
            support: Number.parseFloat(getStyle("[data-login-hero-support]").fontSize),
            label: Number.parseFloat(getStyle("[data-login-email-label]").fontSize),
            metadata: Number.parseFloat(getStyle("[data-login-metadata]").fontSize),
            input: Number.parseFloat(getStyle("input[type=email]").fontSize),
          };
        });

        if (viewport.width >= 768) {
          expect(heroMetrics.brand).toBeCloseTo(24, 1);
          expect(heroMetrics.logo).toBeCloseTo(46, 1);
          expect(heroMetrics.hero).toBeGreaterThanOrEqual(34);
          expect(heroMetrics.hero).toBeLessThanOrEqual(40);
          expect(heroMetrics.accent).toBeGreaterThanOrEqual(36);
          expect(heroMetrics.accent).toBeLessThanOrEqual(40);
          expect(heroMetrics.support).toBeCloseTo(16, 1);
        } else {
          expect(heroMetrics.brand).toBeCloseTo(viewport.width <= 390 ? 21 : 24, 1);
          expect(heroMetrics.logo).toBeCloseTo(viewport.width <= 390 ? 38 : 40, 1);
          expect(heroMetrics.hero).toBeCloseTo(viewport.width <= 390 ? 28 : 32, 1);
          expect(heroMetrics.accent).toBeCloseTo(heroMetrics.hero, 1);
          expect(heroMetrics.support).toBeCloseTo(15, 1);
        }
        expect(heroMetrics.title).toBeCloseTo(24, 1);
        expect(heroMetrics.hero).toBeGreaterThanOrEqual(heroMetrics.title);
        expect(heroMetrics.lineHeight / heroMetrics.hero).toBeGreaterThanOrEqual(1.2);
        expect(heroMetrics.label).toBeGreaterThanOrEqual(13);
        expect(heroMetrics.metadata).toBeGreaterThanOrEqual(13);
        expect(heroMetrics.input).toBeGreaterThanOrEqual(16);

        const taglineBox = await page.locator("[data-login-brand-tagline]").boundingBox();
        const heroBox = await page.locator("[data-login-hero-title]").boundingBox();
        expect(taglineBox).not.toBeNull();
        expect(heroBox).not.toBeNull();
        expect(heroBox!.y).toBeGreaterThan(taglineBox!.y + taglineBox!.height);

        const artworkHeight = artworkBox!.height;
        if (viewport.height <= 700) {
          expect(artworkHeight).toBeLessThanOrEqual(50);
        } else {
          expect(artworkHeight).toBeGreaterThanOrEqual(viewport.width <= 767 ? 68 : 140);
        }

        await emailInput.focus();
        await expect(emailInput).toBeFocused();
        await emailInput.evaluate((input) => input.blur());
      }

      const documentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      expect(documentHeight).toBeGreaterThanOrEqual(formBox!.y + formBox!.height - 1);
      if (viewport.width <= 767 && viewport.height <= 700) {
        await submitButton.scrollIntoViewIfNeeded();
        await expect(submitButton).toBeInViewport();
        await registerLink.scrollIntoViewIfNeeded();
        await expect(registerLink).toBeInViewport();
        await page.evaluate(() => window.scrollTo(0, 0));
      }

      if (
        testInfo.project.name === "desktop-chrome" &&
        (viewport.width === 1440 ||
          (viewport.width === 768 && viewport.height === 1024) ||
          (viewport.width === 390 && viewport.height === 844))
      ) {
        const screenshotName =
          "login-" + locale + "-" + viewport.width + "x" + viewport.height + ".png";
        const screenshotPath = testInfo.outputPath(screenshotName);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        await testInfo.attach(screenshotName, {
          path: screenshotPath,
          contentType: "image/png",
        });
      }
    }
  }
});

test("language selector changes login locale and preserves the register destination", async ({
  page,
}) => {
  const next = "/today?source=language-switcher&view=focus";
  await page.goto("/login");
  await page
    .context()
    .addCookies([{ name: "KEMTIT_LOCALE", value: "th", url: new URL(page.url()).origin }]);
  await page.goto("/login?next=" + encodeURIComponent(next));

  const languageGroup = page.getByRole("group", { name: "ภาษา" });
  await expect(languageGroup.getByRole("button", { name: "อังกฤษ" })).toBeVisible();
  await languageGroup.getByRole("button", { name: "อังกฤษ" }).click();

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.locator("[data-login-brand-tagline]")).toHaveText(
    "Turn your yearly goals into what matters today",
  );
  await expect(page.getByRole("link", { name: "Create an account" })).toHaveAttribute(
    "href",
    "/register?next=" + encodeURIComponent(next),
  );
});

test("OTP keeps the same responsive card and fits long addresses in both locales", async ({
  page,
}) => {
  const otpViewports = [
    { width: 360, height: 800 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ];

  for (const locale of ["th", "en"] as const) {
    const copy = localeCopy[locale];
    const email = `long-local-part-for-layout-${uniqueEmail("otp-layout").split("@")[0]}@kemtit.test`;
    const account = await registerWithPassword(page, email);
    await page.context().clearCookies();
    await page.goto("/login");
    await page
      .context()
      .addCookies([{ name: "KEMTIT_LOCALE", value: locale, url: new URL(page.url()).origin }]);
    await page.goto("/login");

    await page.getByLabel(copy.email).fill(email);
    await page.getByLabel(copy.password, { exact: true }).fill(account.password);
    await page.getByRole("button", { name: copy.signIn, exact: true }).click();
    await expect(page.getByLabel(copy.code)).toBeVisible();
    await expect(page.getByText(email, { exact: true })).toBeVisible();

    for (const viewport of otpViewports) {
      await page.setViewportSize(viewport);
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
        .toBe(true);

      const card = page.locator("[data-login-card]");
      const cardBox = await card.boundingBox();
      const emailBox = await page.getByText(email, { exact: true }).boundingBox();
      const slotBoxes = await page
        .locator('[data-slot="input-otp-slot"]')
        .all()
        .then((slots) => Promise.all(slots.map((slot) => slot.boundingBox())));
      expect(cardBox).not.toBeNull();
      expect(emailBox).not.toBeNull();
      expect(slotBoxes).toHaveLength(6);
      expect(emailBox!.x).toBeGreaterThanOrEqual(cardBox!.x);
      expect(emailBox!.x + emailBox!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width + 1);
      expect(
        slotBoxes.every(
          (box) =>
            box !== null &&
            box.x >= cardBox!.x &&
            box.x + box.width <= cardBox!.x + cardBox!.width + 1,
        ),
      ).toBe(true);

      if (viewport.width >= 1152) {
        expect(cardBox!.width).toBeGreaterThanOrEqual(420);
        expect(cardBox!.width).toBeLessThanOrEqual(480);
      } else if (viewport.width >= 768) {
        expect(cardBox!.width).toBeGreaterThan(600);
        expect(cardBox!.width).toBeLessThanOrEqual(720);
        await expectUnifiedStackedSurface(page, 32);
      } else {
        const pageBox = await page.locator("[data-login-page]").boundingBox();
        expect(pageBox).not.toBeNull();
        expect(cardBox!.width).toBeLessThan(pageBox!.width);
        await expectUnifiedStackedSurface(page, viewport.width <= 390 ? 18 : 24);
      }
    }
  }
});

test("recovery OTP stays inside the card after resizing to mobile", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chrome",
    "The desktop project explicitly exercises the 1440px-to-360px transition.",
  );

  await page.setViewportSize({ width: 1440, height: 900 });
  const account = await registerWithPassword(page, uniqueEmail("recovery-layout"));
  await page.context().clearCookies();
  await page.goto("/login");
  await page
    .context()
    .addCookies([{ name: "KEMTIT_LOCALE", value: "en", url: new URL(page.url()).origin }]);
  await page.goto("/login");

  await page.getByRole("button", { name: "Forgot password or need to set one?" }).click();
  await page.getByLabel("Email").fill(account.email);
  await page.getByRole("button", { name: "Email me a code" }).click();

  const recoveryOtp = page.getByLabel("6-digit verification code");
  await expect(recoveryOtp).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);

  const inputBox = await recoveryOtp.boundingBox();
  const otpContainer = page.locator("[data-input-otp-container]");
  const containerBox = await otpContainer.boundingBox();
  expect(inputBox).not.toBeNull();
  expect(containerBox).not.toBeNull();
  expect(inputBox!.x).toBeGreaterThanOrEqual(containerBox!.x - 1);
  expect(inputBox!.x + inputBox!.width).toBeLessThanOrEqual(
    containerBox!.x + containerBox!.width + 1,
  );
});

test("login validates email before starting the code flow", async ({ page }) => {
  await page.goto("/login");
  await page
    .context()
    .addCookies([{ name: "KEMTIT_LOCALE", value: "th", url: new URL(page.url()).origin }]);
  await page.reload();
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(E2E_TEST_PASSWORD);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page.locator("[data-login-page]").getByRole("alert")).toContainText(
    "อีเมลไม่ถูกต้อง",
  );
  await expect(page.getByLabel("อีเมล")).toHaveValue("");
  await page.getByLabel("อีเมล").fill("not-an-email");
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page.locator("[data-login-page]").getByRole("alert")).toContainText(
    "อีเมลไม่ถูกต้อง",
  );
});

test("login recovers from a wrong code and redirects after a valid code", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const firstEmail = `long-local-part-${uniqueEmail("login").split("@")[0]}@kemtit.test`;
  const firstAccount = await registerWithPassword(page, firstEmail);
  await page.context().clearCookies();
  const secondAccount = await registerWithPassword(page, uniqueEmail("login-returning"));
  await page.context().clearCookies();
  await page.goto("/login");
  await page
    .context()
    .addCookies([{ name: "KEMTIT_LOCALE", value: "th", url: new URL(page.url()).origin }]);
  await page.goto("/login?next=%2Ftoday%3Fsource%3Dlogin");

  await page.getByLabel("อีเมล").fill(firstAccount.email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(firstAccount.password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page.getByRole("heading", { name: /ใส่รหัสที่ส่งไปที่/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /ส่งรหัสใหม่ได้ในอีก/ })).toBeDisabled();

  const displayedEmail = page.getByText(firstEmail, { exact: true });
  await expect(displayedEmail).toBeVisible();
  const emailBox = await displayedEmail.boundingBox();
  expect(emailBox?.height).toBeGreaterThan(0);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);

  const otpInput = page.getByLabel("รหัสยืนยัน 6 หลัก");
  await expect(otpInput).toHaveAttribute("aria-describedby", /login-otp-hint/);
  await otpInput.fill("000000");
  const otpError = page.locator("#login-otp-error");
  await expect(otpError).toContainText("รหัสไม่ถูกต้อง", { timeout: 15_000 });
  await expect(otpInput).toHaveAttribute("aria-invalid", "true");
  await expect(otpInput).toHaveAttribute("aria-describedby", /login-otp-error/);
  await expect(otpInput).toBeEnabled();

  await page.getByRole("button", { name: "เปลี่ยนอีเมล" }).click();
  await expect(page.getByLabel("อีเมล")).toHaveValue(firstEmail);

  await page.getByLabel("อีเมล").fill(secondAccount.email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(secondAccount.password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page.getByRole("heading", { name: /ใส่รหัสที่ส่งไปที่/ })).toBeVisible();

  await page.getByLabel("รหัสยืนยัน 6 หลัก").fill(await latestOtpFor(secondAccount.email));
  await expect(page).toHaveURL(/\/onboarding\/persona/, { timeout: 15_000 });
});
