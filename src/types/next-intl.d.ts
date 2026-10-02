import type messages from "../messages/th.json";

declare module "next-intl" {
  interface AppConfig {
    Locale: "th" | "en";
    Messages: typeof messages;
  }
}
