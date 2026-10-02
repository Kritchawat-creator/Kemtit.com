import "server-only";

import { listCalendarEvents } from "@/core/calendar-events/queries";
import { getDayPlan } from "@/core/tasks/queries";
import { type ISODate } from "@/lib/date";

import { calculateDayAvailability, intervalFromISO } from "./availability";
import { getPlanningPreferences, getTimeBlocksForDate } from "./queries";
import { buildRescueProposal, type RescueTaskInput } from "./rescue";

export async function getRescueProposal(date: ISODate) {
  const [plan, timeBlocks, events, preferences] = await Promise.all([
    getDayPlan(date),
    getTimeBlocksForDate(date),
    listCalendarEvents(date, date),
    getPlanningPreferences(),
  ]);
  const openItems = [...plan.overdue, ...plan.due];
  const blockByTask = new Map<string, (typeof timeBlocks)[number]>();
  for (const block of timeBlocks) {
    if (block.task_id && !blockByTask.has(block.task_id)) blockByTask.set(block.task_id, block);
  }

  const availability = calculateDayAvailability({
    date,
    timezone: preferences.timezone,
    workingWindows: preferences.workingWindows,
    breakWindows: preferences.breakWindows,
    events: events.map((event) => ({
      eventDate: event.event_date,
      allDay: event.all_day,
      startTime: event.start_time,
      endTime: event.end_time,
      blocksTime: event.blocks_time,
    })),
    timeBlocks: timeBlocks.map((block) => ({
      id: block.id,
      startAt: block.start_at,
      endAt: block.end_at,
      taskId: block.task_id,
    })),
    tasks: [...new Map(openItems.map((item) => [item.task.id, item.task])).values()].map(
      (task) => ({ id: task.id, estimatedMinutes: task.estimated_minutes }),
    ),
  });

  const tasks: RescueTaskInput[] = openItems.map((item) => {
    const block = blockByTask.get(item.task.id);
    const currentBlock = block
      ? {
          ...intervalFromISO(block.start_at, block.end_at),
          id: block.id,
          version: block.version,
          isLocked: block.is_locked,
          conflicting: availability.conflictingBlockIds.includes(block.id),
        }
      : undefined;
    return {
      id: item.task.id,
      title: item.task.title,
      estimatedMinutes: item.task.estimated_minutes ?? null,
      priority: item.task.priority ?? "normal",
      deadline: item.task.deadline ?? null,
      plannedDate: item.task.planned_date ?? item.task.due_date ?? null,
      updatedAt: item.task.updated_at,
      recurring: Boolean(item.task.recurrence_rule),
      currentBlock,
    };
  });

  return {
    date,
    availability,
    proposal: buildRescueProposal({
      targetDate: date,
      tasks,
      freeIntervals: availability.freeIntervals,
    }),
  };
}
