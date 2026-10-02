import "server-only";

import type { CalendarProviderAdapter, CalendarProviderName } from "./provider";
import { googleCalendarProvider } from "./google-provider";
import { outlookCalendarProvider } from "./outlook-provider";

export function getCalendarProvider(provider: CalendarProviderName): CalendarProviderAdapter {
  switch (provider) {
    case "google":
      return googleCalendarProvider;
    case "outlook":
      return outlookCalendarProvider;
    default: {
      const unsupportedProvider: never = provider;
      throw new Error(`Unsupported calendar provider: ${String(unsupportedProvider)}`);
    }
  }
}
