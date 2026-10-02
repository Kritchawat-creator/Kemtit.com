import type { Database } from "@/types/database";
import { toBkkDate, type ISODate } from "@/lib/date";

type CalendarEvent = Pick<
  Database["public"]["Tables"]["calendar_events"]["Row"],
  "id" | "title" | "event_date" | "all_day" | "start_time" | "end_time"
>;
type CalendarBill = Pick<
  Database["public"]["Tables"]["finance_bills"]["Row"],
  "id" | "title" | "due_date" | "status" | "amount"
>;
type CalendarTimeBlock = Pick<
  Database["public"]["Tables"]["time_blocks"]["Row"],
  "id" | "title" | "start_at" | "end_at"
>;

export type CalendarDayContext = {
  events: CalendarEvent[];
  bills: CalendarBill[];
  timeBlocks: CalendarTimeBlock[];
};

export type CalendarContextByDay = Record<ISODate, CalendarDayContext>;

/** Group canonical event, bill, and time-block records by their calendar date. */
export function calendarContextByDay(
  events: CalendarEvent[],
  bills: CalendarBill[],
  timeBlocks: CalendarTimeBlock[],
): CalendarContextByDay {
  const result: CalendarContextByDay = {};
  const getDay = (date: ISODate) => (result[date] ??= { events: [], bills: [], timeBlocks: [] });

  for (const event of events) getDay(event.event_date).events.push(event);
  for (const bill of bills) getDay(bill.due_date).bills.push(bill);
  for (const block of timeBlocks) getDay(toBkkDate(block.start_at)).timeBlocks.push(block);

  return result;
}
