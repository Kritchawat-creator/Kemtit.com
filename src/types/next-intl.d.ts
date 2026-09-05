import type messages from "../messages/th.json";

/** Type-safe message keys จาก messages/th.json — t("home.cta") ผิด key จะฟ้องตอน typecheck */
declare module "next-intl" {
  interface AppConfig {
    Locale: "th";
    Messages: typeof messages;
  }
}
