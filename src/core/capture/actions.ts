"use server";

import { z } from "zod";

import { createCalendarEvent } from "@/core/calendar-events/actions";
import { DOMAINS } from "@/core/domain/domains";
import { createFinanceBill, createFinanceTransaction } from "@/core/finance/actions";
import { createGoal } from "@/core/goals/actions";
import { createHabit } from "@/core/habits/actions";
import { createNote } from "@/core/notes/actions";
import { fail, zodFail, type ActionResult } from "@/core/shared/result";
import { createTask } from "@/core/tasks/actions";
import { isISODate } from "@/lib/date";
import { createServerSupabase } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const isoDate = z.string().refine(isISODate, { error: "invalidDate" });
const title = z.string().trim().min(1, { error: "required" }).max(200, { error: "tooLong" });
const requestId = z.uuid({ error: "validation" });

const confirmCaptureSchema = z.discriminatedUnion("kind", [
  z.object({
    requestId,
    kind: z.literal("task"),
    title,
    domain: z.enum(DOMAINS),
    dueDate: isoDate,
    estimatedMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  }),
  z.object({
    requestId,
    kind: z.literal("goal"),
    title: title.max(120, { error: "tooLong" }),
    domain: z.enum(DOMAINS),
    periodStart: isoDate,
  }),
  z.object({
    requestId,
    kind: z.literal("habit"),
    title: title.max(160, { error: "tooLong" }),
    domain: z.enum(DOMAINS),
    cadence: z.enum(["daily", "weekly"]),
    targetPerWeek: z.number().int().min(1).max(7),
  }),
  z.object({
    requestId,
    kind: z.literal("event"),
    title,
    eventDate: isoDate,
  }),
  z.object({
    requestId,
    kind: z.literal("bill"),
    title,
    amount: z.number().min(0).nullable(),
    dueDate: isoDate,
    recurrence: z.enum(["none", "monthly"]).default("none"),
  }),
  z.object({
    requestId,
    kind: z.literal("expense"),
    title,
    amount: z.number({ error: "positive" }).positive({ error: "positive" }),
    occurredOn: isoDate,
  }),
  z.object({
    requestId,
    kind: z.literal("note"),
    title,
  }),
]);

type CapturedKind = "task" | "goal" | "habit" | "event" | "bill" | "expense" | "note";

type CompletionRow = {
  status: string;
  entity_type: string | null;
  entity_id: string | null;
};

function isCapturedKind(value: string | null): value is CapturedKind {
  return (
    value === "task" ||
    value === "goal" ||
    value === "habit" ||
    value === "event" ||
    value === "bill" ||
    value === "expense" ||
    value === "note"
  );
}

function completedResult(
  row: CompletionRow | null,
): ActionResult<{ kind: CapturedKind; id: string }> | null {
  if (row?.status === "completed" && isCapturedKind(row.entity_type) && row.entity_id) {
    return { ok: true, data: { kind: row.entity_type, id: row.entity_id } };
  }
  return null;
}

function revalidateCapturedPaths(kind: CapturedKind) {
  const paths: Record<CapturedKind, string[]> = {
    task: ["/today", "/calendar", "/goals", "/tasks", "/inbox"],
    goal: ["/goals", "/today", "/dashboard"],
    habit: ["/life", "/today", "/insights"],
    event: ["/calendar", "/today"],
    bill: ["/finance", "/today", "/calendar"],
    expense: ["/finance", "/insights"],
    note: ["/inbox", "/insights"],
  };

  for (const path of paths[kind]) revalidatePath(path);
}

function completedAndRevalidated(
  row: CompletionRow | null,
): ActionResult<{ kind: CapturedKind; id: string }> | null {
  const completed = completedResult(row);
  if (completed?.ok) revalidateCapturedPaths(completed.data.kind);
  return completed;
}

export async function confirmQuickCapture(
  input: unknown,
): Promise<ActionResult<{ kind: CapturedKind; id: string }>> {
  const parsed = confirmCaptureSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { data: existing, error: readError } = await supabase
    .from("capture_confirmations")
    .select("status, entity_type, entity_id")
    .eq("request_id", parsed.data.requestId)
    .maybeSingle();

  if (readError) return fail("generic");

  const existingCompleted = completedAndRevalidated(existing);
  if (existingCompleted) return existingCompleted;

  if (existing?.status === "pending" && existing.entity_type && existing.entity_id) {
    const { data: recovered, error: recoveryError } = await supabase
      .from("capture_confirmations")
      .update({ status: "completed" })
      .eq("request_id", parsed.data.requestId)
      .eq("status", "pending")
      .eq("entity_id", existing.entity_id)
      .select("status, entity_type, entity_id")
      .maybeSingle();

    if (recoveryError) return fail("generic");
    return completedAndRevalidated(recovered) ?? fail("capturePending");
  }

  if (existing?.status === "pending") return fail("capturePending");

  const { data: claim, error: claimError } = await supabase
    .from("capture_confirmations")
    .insert({
      user_id: user.id,
      request_id: parsed.data.requestId,
      status: "pending",
    })
    .select("id")
    .maybeSingle();

  if (claimError || !claim) {
    const { data: concurrent } = await supabase
      .from("capture_confirmations")
      .select("status, entity_type, entity_id")
      .eq("request_id", parsed.data.requestId)
      .maybeSingle();

    const concurrentCompleted = completedAndRevalidated(concurrent);
    if (concurrentCompleted) return concurrentCompleted;
    return fail("capturePending");
  }

  let created: ActionResult<{ id: string }>;
  const entityType: CapturedKind = parsed.data.kind;

  if (parsed.data.kind === "task") {
    created = await createTask({
      title: parsed.data.title,
      dueDate: parsed.data.dueDate,
      domain: parsed.data.domain,
      recurrence: "none",
      weekdays: [],
      goalId: null,
      projectId: null,
      priority: "normal",
      estimatedMinutes: parsed.data.estimatedMinutes ?? null,
      notes: null,
    });
  } else if (parsed.data.kind === "habit") {
    created = await createHabit({
      title: parsed.data.title,
      domain: parsed.data.domain,
      cadence: parsed.data.cadence,
      targetPerWeek: parsed.data.targetPerWeek,
      goalId: null,
      estimatedMinutes: null,
    });
  } else if (parsed.data.kind === "goal") {
    created = await createGoal({
      title: parsed.data.title,
      periodType: "month",
      periodStart: parsed.data.periodStart,
      domain: parsed.data.domain,
      goalKind: "execution",
      parentId: null,
    });
  } else if (parsed.data.kind === "event") {
    created = await createCalendarEvent({
      title: parsed.data.title,
      eventDate: parsed.data.eventDate,
      allDay: true,
      startTime: null,
      endTime: null,
      notes: null,
    });
  } else if (parsed.data.kind === "bill") {
    created = await createFinanceBill({
      title: parsed.data.title,
      amount: parsed.data.amount,
      dueDate: parsed.data.dueDate,
      recurrence: parsed.data.recurrence,
      notes: null,
    });
  } else if (parsed.data.kind === "expense") {
    created = await createFinanceTransaction({
      transactionType: "expense",
      title: parsed.data.title,
      amount: parsed.data.amount,
      occurredOn: parsed.data.occurredOn,
      category: null,
      notes: null,
    });
  } else {
    created = await createNote({
      title: parsed.data.title,
      body: null,
    });
  }

  if (!created.ok) {
    await supabase
      .from("capture_confirmations")
      .delete()
      .eq("request_id", parsed.data.requestId)
      .eq("status", "pending")
      .is("entity_id", null);
    return created;
  }

  const { data: staged, error: stageError } = await supabase
    .from("capture_confirmations")
    .update({
      entity_type: entityType,
      entity_id: created.data.id,
    })
    .eq("request_id", parsed.data.requestId)
    .eq("status", "pending")
    .is("entity_id", null)
    .select("id")
    .maybeSingle();

  if (stageError || !staged) {
    console.error("[capture] failed to stage canonical entity", {
      code: stageError?.code,
      requestId: parsed.data.requestId,
      entityType,
      entityId: created.data.id,
    });
    return fail("generic");
  }

  const { data: finalized, error: finalizeError } = await supabase
    .from("capture_confirmations")
    .update({ status: "completed" })
    .eq("request_id", parsed.data.requestId)
    .eq("status", "pending")
    .eq("entity_id", created.data.id)
    .select("status, entity_type, entity_id")
    .maybeSingle();

  if (finalizeError) {
    console.error("[capture] failed to finalize confirmation", {
      code: finalizeError.code,
      requestId: parsed.data.requestId,
      entityType,
      entityId: created.data.id,
    });
    return fail("generic");
  }

  return completedAndRevalidated(finalized) ?? fail("generic");
}
