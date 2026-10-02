"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, zodFail, type ActionResult } from "@/core/shared/result";
import { createServerSupabase } from "@/lib/supabase/server";

import { calendarEventSchema, deleteCalendarEventSchema } from "./schema";

function revalidateCalendar() {
  revalidatePath("/calendar");
  revalidatePath("/calendar/events");
  revalidatePath("/today");
  revalidatePath("/insights");
}

export async function createCalendarEvent(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = calendarEventSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      user_id: user.id,
      title: parsed.data.title,
      event_date: parsed.data.eventDate,
      all_day: parsed.data.allDay,
      blocks_time: parsed.data.blocksTime,
      start_time: parsed.data.allDay ? null : (parsed.data.startTime ?? null),
      end_time: parsed.data.allDay ? null : (parsed.data.endTime ?? null),
      notes: parsed.data.notes ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[calendar-events] create failed", { code: error?.code });
    return fail("generic");
  }

  revalidateCalendar();
  return ok({ id: data.id });
}

export async function deleteCalendarEvent(input: unknown): Promise<ActionResult> {
  const parsed = deleteCalendarEventSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { data, error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .eq("data_origin", "USER")
    .select("id")
    .maybeSingle();

  if (error) return fail("generic");
  if (!data) return fail("notFound");

  revalidateCalendar();
  return ok(null);
}

export async function updateCalendarEvent(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsedId = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsedId.success) return zodFail(parsedId.error);

  const parsedEvent = calendarEventSchema.safeParse(input);
  if (!parsedEvent.success) return zodFail(parsedEvent.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { data, error } = await supabase
    .from("calendar_events")
    .update({
      title: parsedEvent.data.title,
      event_date: parsedEvent.data.eventDate,
      all_day: parsedEvent.data.allDay,
      blocks_time: parsedEvent.data.blocksTime,
      start_time: parsedEvent.data.allDay ? null : (parsedEvent.data.startTime ?? null),
      end_time: parsedEvent.data.allDay ? null : (parsedEvent.data.endTime ?? null),
      ...(parsedEvent.data.notes === undefined ? {} : { notes: parsedEvent.data.notes }),
    })
    .eq("id", parsedId.data.id)
    .eq("user_id", user.id)
    .eq("data_origin", "USER")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[calendar-events] update failed", { code: error.code });
    return fail("generic");
  }
  if (!data) return fail("notFound");

  revalidateCalendar();
  return ok({ id: data.id });
}
