import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getOutlookCalendarEnv,
  isGoogleCalendarConfigured,
  isOutlookCalendarConfigured,
} from "./env.server";

describe("optional Outlook Calendar environment", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("validates Outlook settings independently from Google settings", () => {
    vi.stubEnv("SKIP_ENV_VALIDATION", "");
    vi.stubEnv("OUTLOOK_CALENDAR_CLIENT_ID", "outlook-client-id");
    vi.stubEnv("OUTLOOK_CALENDAR_CLIENT_SECRET", "outlook-client-secret");
    vi.stubEnv(
      "OUTLOOK_CALENDAR_REDIRECT_URI",
      "https://example.test/api/calendar/outlook/callback",
    );
    vi.stubEnv(
      "CALENDAR_TOKEN_ENCRYPTION_KEY",
      "this-key-is-long-enough-for-the-calendar-token-box",
    );

    expect(isOutlookCalendarConfigured()).toBe(true);
    expect(isGoogleCalendarConfigured()).toBe(false);
    expect(getOutlookCalendarEnv()).toEqual({
      clientId: "outlook-client-id",
      clientSecret: "outlook-client-secret",
      redirectUri: "https://example.test/api/calendar/outlook/callback",
      tokenEncryptionKey: "this-key-is-long-enough-for-the-calendar-token-box",
    });
  });

  it("fails closed when a required Outlook credential is absent", () => {
    vi.stubEnv("SKIP_ENV_VALIDATION", "");
    vi.stubEnv("OUTLOOK_CALENDAR_CLIENT_ID", "outlook-client-id");
    vi.stubEnv("OUTLOOK_CALENDAR_CLIENT_SECRET", "");
    vi.stubEnv(
      "OUTLOOK_CALENDAR_REDIRECT_URI",
      "https://example.test/api/calendar/outlook/callback",
    );
    vi.stubEnv(
      "CALENDAR_TOKEN_ENCRYPTION_KEY",
      "this-key-is-long-enough-for-the-calendar-token-box",
    );

    expect(isOutlookCalendarConfigured()).toBe(false);
    expect(() => getOutlookCalendarEnv()).toThrow(/OUTLOOK_CALENDAR_CLIENT_SECRET/);
    let message = "";
    try {
      getOutlookCalendarEnv();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).not.toContain("outlook-client-secret");
  });
});
