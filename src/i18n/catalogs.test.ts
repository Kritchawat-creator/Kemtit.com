import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";

import en from "../messages/en.json";
import th from "../messages/th.json";
import { APP_TIME_ZONE, LOCALE_CONFIG } from "./config";

type Catalog = Record<string, unknown>;

function flattenKeys(value: Catalog, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === "object" && !Array.isArray(child)
      ? flattenKeys(child as Catalog, path)
      : [path];
  });
}

function flattenStrings(value: Catalog, prefix = ""): Array<[string, string]> {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "string") return [[path, child] as [string, string]];
    return child && typeof child === "object" && !Array.isArray(child)
      ? flattenStrings(child as Catalog, path)
      : [];
  });
}

const THAI_ALLOWED_LATIN_TOKENS_BY_PATH: Record<string, readonly string[]> = {
  "app.nameLatin": ["Kemtit"],
  "notifications.lineNotLinked": ["LINE"],
  "auth.emailPlaceholder": ["you", "example.com"],
  "auth.googleSignIn": ["Google"],
  "auth.googleSigningIn": ["Google"],
  "auth.registerGoogleSignIn": ["Google"],
  "onboarding.starter.calendarTitle": ["Google", "Calendar"],
  "onboarding.starter.calendarConnect": ["Google", "Calendar"],
  "onboarding.starter.calendarConnected": ["Google", "Calendar"],
  "onboarding.starter.calendarUnavailable": ["Google", "Calendar"],
  "entries.channels.shopee": ["Shopee"],
  "entries.channels.lazada": ["Lazada"],
  "entries.channels.tiktok": ["TikTok", "Shop"],
  "entries.channels.line": ["LINE"],
  "entries.channels.facebook": ["Facebook"],
  "calendarEvents.providerGoogle": ["Google", "Calendar"],
  "calendarEvents.providerOutlook": ["Outlook", "Calendar"],
  "settings.language.description": ["UTC+7"],
  "settings.language.timezoneBangkok": ["UTC+7"],
  "settings.language.previewEnglish": ["September"],
  "settings.calendar.description": ["Google", "Calendar", "Outlook"],
  "settings.calendar.providers.google": ["Google", "Calendar"],
  "settings.calendar.providers.outlook": ["Outlook", "Calendar"],
  "settings.calendar.connectGoogle": ["Google", "Calendar"],
  "settings.calendar.connectOutlook": ["Outlook", "Calendar"],
  "settings.line.title": ["LINE"],
  "settings.line.connect": ["LINE"],
  "settings.line.step1": ["LINE"],
  "settings.line.addFriend": ["LINE"],
  "settings.line.linkedToast": ["LINE"],
  "settings.line.noBasicId": ["LINE"],
  "settings.line.dryRunHint": ["LINE"],
  "settings.notifications.overdue": ["LINE"],
  "settings.notifications.dailyBriefDescription": ["LINE"],
  "settings.empty.description": ["LINE"],
  "errors.googleAuthFailed": ["Google"],
  "errors.googleAuthCancelled": ["Google"],
  "errors.photoType": ["JPG", "PNG", "WebP"],
  "errors.photoInvalid": ["JPEG", "PNG", "WebP"],
  "errors.photoTooLarge": ["MB"],
  "inbox.noteComposerHint": ["Enter", "Shift+Enter"],
  "settings.notifications.weeklyReviewDescription": ["LINE"],
  "settings.notifications.habitsDescription": ["LINE"],
  "settings.notifications.investmentDescription": ["LINE"],
  "line.greeting": ["LINE"],
  "line.notCode": ["LINE"],
  "pwa.install.iosSteps": ["iPhone", "iPad"],
  "photos.attachHint": ["JPG", "PNG", "WebP", "MB"],
};

describe("i18n catalogs", () => {
  it("Thai and English contain exactly the same message keys", () => {
    expect(flattenKeys(en).sort()).toEqual(flattenKeys(th).sort());
  });

  it("English UI does not silently contain Thai text", () => {
    const unexpected = flattenStrings(en).filter(
      ([, text]) => /[\u0E00-\u0E7F]/.test(text),
    );
    expect(unexpected).toEqual([]);
  });

  it("Thai UI uses Thai text and keeps approved Latin terms at their assigned paths", () => {
    const unexpected: string[] = [];
    for (const [path, text] of flattenStrings(th)) {
      const allowedTokens = new Set(THAI_ALLOWED_LATIN_TOKENS_BY_PATH[path] ?? []);
      const visibleText = text.replace(/\{[^}]+\}/g, "");
      const unexpectedTokens = (visibleText.match(/[A-Za-z][A-Za-z0-9+#.-]*/g) ?? [])
        .filter((token) => !allowedTokens.has(token));

      if (unexpectedTokens.length) {
        unexpected.push(`${path}: ${unexpectedTokens.join(", ")}`);
      }
    }

    // ICU placeholders are removed before scanning. English brand, format,
    // keyboard and date-preview tokens are allowed only at the paths above.
    expect(unexpected).toEqual([]);
  });

  it("Thai prose uses the Thai brand name except in its Latin brand field", () => {
    const unexpected = flattenStrings(th).filter(
      ([path, text]) => path !== "app.nameLatin" && /\bKemtit\b/.test(text),
    );

    expect(th.app.nameLatin).toBe("Kemtit");
    expect(unexpected).toEqual([]);
  });

  it("Thai and English preserve the same ICU placeholders", () => {
    const placeholders = (text: string) =>
      [...text.matchAll(/\{([A-Za-z0-9_]+)(?:,[^}]*)?\}/g)]
        .map((match) => match[1])
        .sort();

    const thStrings = new Map(flattenStrings(th));
    const enStrings = new Map(flattenStrings(en));

    for (const [path, thText] of thStrings) {
      expect(placeholders(enStrings.get(path) ?? "")).toEqual(placeholders(thText));
    }
  });

  it("English streak copy formats singular and plural remaining days", () => {
    const t = createTranslator({ locale: "en", messages: en });

    expect(t("entries.kpi.streakToGo", { days: 1 })).toBe(
      "1 day to a 7-day streak",
    );
    expect(t("entries.kpi.streakToGo", { days: 2 })).toBe(
      "2 days to a 7-day streak",
    );
  });

  it("core Thai UI labels do not fall back to English module names", () => {
    expect(th.nav.inbox).toBe("กล่องเข้า");
    expect(th.nav.insights).toBe("วิเคราะห์");
    expect(th.capture.title).toBe("บันทึกด่วน");
    expect(th.today.openInbox).toBe("เปิดกล่องเข้า");
  });
});

describe("locale calendar contract", () => {
  it("Thai uses Buddhist Era and English uses Gregorian while both use Bangkok time", () => {
    expect(LOCALE_CONFIG.th.calendar).toBe("buddhist");
    expect(LOCALE_CONFIG.en.calendar).toBe("gregory");
    expect(APP_TIME_ZONE).toBe("Asia/Bangkok");
  });
});
