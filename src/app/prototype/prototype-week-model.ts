import { formatPrototypeDate, formatPrototypeDuration } from "./prototype-model";
import type { PrototypeDateKey, PrototypeRecord, PrototypeTimeBlock } from "./prototype-model";

export const WEEK_PREVIEW_LIMIT = 5;
export type WeekDayEntry = { record: PrototypeRecord; timing: string; sortMinute: number };

const TYPE_LABELS: Record<PrototypeRecord["type"], string> = {
  task: "Task", event: "Event", bill: "Bill", habit: "Routine", note: "Note",
};

function minuteOfDay(time?: string): number | null {
  if (!time || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function timeRange(startTime: string, duration?: number): string {
  const start = minuteOfDay(startTime);
  if (start === null) return "Time not set";
  if (duration === undefined || !Number.isFinite(duration) || duration <= 0) return startTime;
  const total = start + Math.round(duration);
  const end = total % 1440;
  const clock = `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
  return `${startTime}–${clock}${total >= 1440 ? ` (+${Math.floor(total / 1440)}d)` : ""}`;
}

/** Presentation only: preserve the parent day projection and each canonical record ID. */
export function getWeekDayEntries(
  records: readonly PrototypeRecord[],
  date: PrototypeDateKey,
  blocks: readonly PrototypeTimeBlock[] = [],
): WeekDayEntry[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    if (record.status === "inbox" || record.status === "archived" || seen.has(record.id)) return false;
    seen.add(record.id);
    return true;
  }).map((record) => {
    const recordBlocks = blocks.filter((block) => block.itemId === record.id && block.date === date && minuteOfDay(block.startTime) !== null)
      .slice().sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (record.type === "task" && recordBlocks.length) {
      return {
        record,
        sortMinute: minuteOfDay(recordBlocks[0].startTime)!,
        timing: recordBlocks.map((block) => timeRange(block.startTime, block.durationMinutes)).join(" · "),
      };
    }
    const start = record.type === "event" ? minuteOfDay(record.startTime) : null;
    if (start !== null) return { record, sortMinute: start, timing: timeRange(record.startTime!, record.durationMinutes) };
    const details = record.type === "bill"
      ? record.status === "done" ? "Paid" : `Due ${formatPrototypeDate(record.dueDate ?? record.date, { month: "short", day: "numeric" })}`
      : record.type === "event" ? "Time not set"
      : record.durationMinutes !== undefined && Number.isFinite(record.durationMinutes) && record.durationMinutes > 0
        ? `${formatPrototypeDuration(record.durationMinutes)} estimate` : "Not scheduled";
    return { record, sortMinute: Number.POSITIVE_INFINITY, timing: `${TYPE_LABELS[record.type]} · ${details}` };
  }).sort((a, b) => a.sortMinute === b.sortMinute ? 0 : a.sortMinute - b.sortMinute);
}

export function getWeekDayPreview(entries: readonly WeekDayEntry[]) {
  return { visible: entries.slice(0, WEEK_PREVIEW_LIMIT), remaining: Math.max(0, entries.length - WEEK_PREVIEW_LIMIT), total: entries.length };
}
