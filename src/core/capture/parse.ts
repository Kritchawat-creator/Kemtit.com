import type { Domain } from "@/core/domain/domains";
import {
  addDaysISO,
  startOfMonthISO,
  type ISODate,
  weekdayOf,
} from "@/lib/date";

export const CAPTURE_KINDS = ["task", "event", "habit", "bill", "expense", "goal", "note"] as const;
export type CaptureKind = (typeof CAPTURE_KINDS)[number];

export const SUPPORTED_CAPTURE_KINDS = CAPTURE_KINDS;
export type SupportedCaptureKind = CaptureKind;

export type CaptureHistoryDefaults = {
  taskEstimatedMinutes?: number | null;
  habitCadence?: "daily" | "weekly";
  habitTargetPerWeek?: number;
};

export type CaptureProposal = {
  kind: CaptureKind;
  supported: boolean;
  title: string;
  domain: Domain;
  dueDate: ISODate | null;
  periodStart: ISODate | null;
  cadence: "daily" | "weekly" | null;
  recurrence: "none" | "monthly" | null;
  targetPerWeek: number | null;
  estimatedMinutes: number | null;
  amount: number | null;
  currency: "THB" | null;
};

const WEEKDAYS: Array<{ day: number; terms: RegExp }> = [
  { day: 0, terms: /(?:sunday|sun\b|วันอาทิตย์|อาทิตย์)/i },
  { day: 1, terms: /(?:monday|mon\b|วันจันทร์|จันทร์)/i },
  { day: 2, terms: /(?:tuesday|tue\b|วันอังคาร|อังคาร)/i },
  { day: 3, terms: /(?:wednesday|wed\b|วันพุธ|พุธ)/i },
  { day: 4, terms: /(?:thursday|thu\b|วันพฤหัส(?:บดี)?|พฤหัส(?:บดี)?)/i },
  { day: 5, terms: /(?:friday|fri\b|วันศุกร์|ศุกร์)/i },
  { day: 6, terms: /(?:saturday|sat\b|วันเสาร์|เสาร์)/i },
];

export function prepareCapture(
  rawInput: string,
  today: ISODate,
  manualKind?: SupportedCaptureKind,
  preferredDomain: Domain = "work",
  historyDefaults: CaptureHistoryDefaults = {},
): CaptureProposal {
  const title = rawInput.trim().replace(/\s+/g, " ");
  const detectedKind = manualKind ?? classifyCapture(title);
  const dueDate = extractDate(title, today);
  const amount =
    detectedKind === "bill" || detectedKind === "expense" ? extractThbAmount(title) : null;
  const domain = inferDomain(title, detectedKind, preferredDomain);
  const cadence = detectedKind === "habit" ? inferCadence(title, historyDefaults.habitCadence) : null;
  const recurrence =
    detectedKind === "bill" && /ทุกเดือน|รายเดือน|monthly|every month/i.test(title)
      ? "monthly"
      : detectedKind === "bill"
        ? "none"
        : null;
  const habitTarget =
    detectedKind === "habit"
      ? Math.max(
          1,
          Math.min(
            7,
            historyDefaults.habitTargetPerWeek ?? (cadence === "daily" ? 7 : 3),
          ),
        )
      : null;

  return {
    kind: detectedKind,
    supported: true,
    title,
    domain,
    dueDate:
      detectedKind === "goal" || detectedKind === "note"
        ? null
        : (dueDate ?? today),
    periodStart: detectedKind === "goal" ? startOfMonthISO(today) : null,
    cadence,
    recurrence,
    targetPerWeek: habitTarget,
    estimatedMinutes:
      detectedKind === "task" && historyDefaults.taskEstimatedMinutes
        ? historyDefaults.taskEstimatedMinutes
        : null,
    amount,
    currency: amount === null ? null : "THB",
  };
}

export function classifyCapture(input: string): CaptureKind {
  const normalized = input.toLowerCase();
  if (/\b(?:bill|invoice)\b|บิล|ค่าไฟ|ค่าน้ำ|ค่าโทรศัพท์|ค่าอินเทอร์เน็ต|ค่าเช่า/i.test(normalized)) return "bill";
  if (/\b(?:expense|spent|spend)\b|ค่าอาหาร|ค่าเดินทาง|ซื้อของ|รายจ่าย/i.test(normalized)) return "expense";
  if (/\b(?:meeting|appointment|event)\b|ประชุม|นัดหมาย|นัดพบ/i.test(normalized)) return "event";
  if (/\bnote\b|โน้ต|จดไว้|บันทึกไว้/i.test(normalized)) return "note";
  if (/\b(?:habit|routine|daily|weekly)\b|ทุกวัน|ทุกสัปดาห์|กิจวัตร|เป็นประจำ|ออกกำลังกาย/i.test(normalized)) return "habit";
  if (/\bgoal\b|เป้าหมาย|ตั้งเป้า/i.test(normalized)) return "goal";
  return "task";
}

function inferDomain(input: string, kind: CaptureKind, preferredDomain: Domain): Domain {
  if (kind === "bill" || kind === "expense" || /บิล|ค่าไฟ|ค่าน้ำ|ค่าโทรศัพท์|ค่าเช่า|การเงิน|finance|budget/i.test(input)) return "finance";
  if (/สุขภาพ|ออกกำลัง|exercise|workout|doctor|หมอ/i.test(input)) return "health";
  if (/เรียน|อ่านหนังสือ|สอบ|study|class|course/i.test(input)) return "growth";
  if (/ครอบครัว|บ้าน|family/i.test(input)) return "family";
  return preferredDomain;
}

function inferCadence(
  input: string,
  fallback: "daily" | "weekly" = "daily",
): "daily" | "weekly" {
  if (/ทุกสัปดาห์|weekly|สัปดาห์ละ/i.test(input)) return "weekly";
  if (/ทุกวัน|daily|รายวัน/i.test(input)) return "daily";
  return fallback;
}

function extractDate(input: string, today: ISODate): ISODate | null {
  if (/วันนี้|\btoday\b/i.test(input)) return today;
  if (/พรุ่งนี้|\btomorrow\b/i.test(input)) return addDaysISO(today, 1);
  const weekday = WEEKDAYS.find((candidate) => candidate.terms.test(input));
  if (!weekday) return null;
  const current = weekdayOf(today);
  const delta = (weekday.day - current + 7) % 7;
  return addDaysISO(today, delta);
}

function extractThbAmount(input: string): number | null {
  const match =
    input.match(/฿\s*([\d,]+(?:\.\d+)?)/i) ??
    input.match(/([\d,]+(?:\.\d+)?)\s*(?:THB|บาท)(?=\s|$|[,.)])/i);
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}
