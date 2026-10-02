import type { getTranslations } from "next-intl/server";

import type { EventPayloads } from "@/core/events/types";

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

function listedTitles(titles: string[]): string {
  return titles.length > 0
    ? titles
        .slice(0, 3)
        .map((title) => `• ${title}`)
        .join("\n")
    : "• ยังไม่มีงานสำคัญ";
}

function baht(value: number | null): string {
  return value === null ? "ยังไม่ได้ตั้ง" : `฿${new Intl.NumberFormat("th-TH").format(value)}`;
}

function minutes(value: number | null): string {
  if (value === null) return "ยังไม่ได้คำนวณ";
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  if (hours === 0) return `${rest} นาที`;
  if (rest === 0) return `${hours} ชม.`;
  return `${hours} ชม. ${rest} นาที`;
}

export function dailyPlanReadyText(t: LineT, appUrl: string): string {
  return t("dailyPlanReady", { url: lineOpenUrl(appUrl, "/today") });
}

export function dailyBriefText(
  t: LineT,
  appUrl: string,
  payload: EventPayloads["daily.brief"],
): string {
  const tasks = listedTitles(payload.importantTaskTitles);
  const url = lineOpenUrl(appUrl, "/today");
  if (payload.workMode === "seller") {
    return t("dailyBriefSeller", {
      tasks,
      revenueRemaining: baht(payload.revenueRemaining),
      requiredDailyPace: baht(payload.requiredDailyPace),
      url,
    });
  }
  return t("dailyBriefProfessional", {
    tasks,
    plannedWorkload: minutes(payload.plannedWorkloadMinutes),
    remainingCapacity: minutes(payload.remainingCapacityMinutes),
    url,
  });
}

export function weeklyReviewReadyText(t: LineT, appUrl: string, weekStart: string): string {
  return t("weeklyReviewReady", { weekStart, url: lineOpenUrl(appUrl, "/reviews") });
}

export function habitReminderText(t: LineT, appUrl: string, title: string): string {
  return t("habitReminder", { title, url: lineOpenUrl(appUrl, "/life") });
}

export function investmentReminderText(
  t: LineT,
  appUrl: string,
  title: string,
  monthlyTarget: number | null,
): string {
  return t("investmentReminder", {
    title,
    monthlyTarget: baht(monthlyTarget),
    url: lineOpenUrl(appUrl, "/finance"),
  });
}
