import type { getTranslations } from "next-intl/server";

import { lineOpenUrl } from "./url";

export type LineT = Awaited<ReturnType<typeof getTranslations<"line">>>;

const MAX_LISTED = 5;

/** ข้อความ LINE ทั้งหมดมาจาก th.json (line.*) — ไม่มี emoji (Design §4.3) */
export function goalCompletedText(t: LineT, appUrl: string, goalId: string, title: string): string {
  return t("goalCompleted", { title, url: lineOpenUrl(appUrl, `/goals/${goalId}`) });
}

export function overdueText(t: LineT, appUrl: string, titles: string[]): string {
  const listed = titles.slice(0, MAX_LISTED).map((title) => `• ${title}`);
  const more = titles.length - listed.length;
  const list =
    more > 0 ? [...listed, t("overdueMore", { count: more })].join("\n") : listed.join("\n");
  return t("overdue", { count: titles.length, list, url: lineOpenUrl(appUrl, "/dashboard") });
}
