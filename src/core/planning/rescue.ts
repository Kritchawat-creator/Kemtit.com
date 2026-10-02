import { DEFAULT_TASK_MINUTES } from "./capacity";
import { intervalMinutes, mergeIntervals, type Interval } from "./availability";

export type RescuePriority = "high" | "normal" | "low";

export type RescueCurrentBlock = {
  id: string;
  start: number;
  end: number;
  version: number;
  isLocked: boolean;
  conflicting?: boolean;
};

export type RescueTaskInput = {
  id: string;
  title: string;
  estimatedMinutes: number | null;
  priority: RescuePriority;
  deadline: string | null;
  plannedDate: string | null;
  updatedAt: string;
  recurring: boolean;
  currentBlock?: RescueCurrentBlock;
};

export type RescueProposalAction = "keep" | "move" | "unplaced" | "at_risk";

export type RescueProposalItem = {
  taskId: string;
  title: string;
  action: RescueProposalAction;
  reason: string;
  targetDate: string;
  startAt: string | null;
  endAt: string | null;
  blockId: string | null;
  expectedBlockVersion: number | null;
  expectedTaskUpdatedAt: string;
};

export type RescueProposal = {
  targetDate: string;
  proposalVersion: string;
  items: RescueProposalItem[];
  overCapacityMinutes: number;
};

function priorityRank(priority: RescuePriority): number {
  return priority === "high" ? 0 : priority === "normal" ? 1 : 2;
}

function sameInterval(left: Interval | undefined, right: Interval | undefined): boolean {
  return Boolean(left && right && left.start === right.start && left.end === right.end);
}

function toISOString(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

/** Small deterministic hash used as a stale-preview token; no randomness or provider call involved. */
function versionOf(value: unknown): string {
  const encoded = JSON.stringify(value);
  let hash = 2_166_136_261;
  for (let index = 0; index < encoded.length; index += 1) {
    hash ^= encoded.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `rescue-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function insertSlot(slots: Interval[], slot: Interval): void {
  const next: Interval[] = [];
  for (const candidate of slots) {
    if (candidate.end <= slot.start || candidate.start >= slot.end) {
      next.push(candidate);
      continue;
    }
    if (candidate.start < slot.start) next.push({ start: candidate.start, end: slot.start });
    if (candidate.end > slot.end) next.push({ start: slot.end, end: candidate.end });
  }
  slots.splice(0, slots.length, ...mergeIntervals(next));
}

/**
 * Create a reviewable, deterministic rescue proposal. It never writes data and never splits a task.
 * Locked blocks remain fixed; deadlines are retained and marked at risk instead of being changed.
 */
export function buildRescueProposal(input: {
  targetDate: string;
  tasks: readonly RescueTaskInput[];
  freeIntervals: readonly Interval[];
}): RescueProposal {
  const sortedTasks = [...input.tasks].sort(
    (left, right) =>
      Number(Boolean(right.currentBlock?.isLocked)) - Number(Boolean(left.currentBlock?.isLocked)) ||
      priorityRank(left.priority) - priorityRank(right.priority) ||
      (left.deadline ?? "9999-12-31").localeCompare(right.deadline ?? "9999-12-31") ||
      left.id.localeCompare(right.id),
  );
  const reusableBlocks = sortedTasks.flatMap((task) => {
    const block = task.currentBlock;
    return block && !block.isLocked && !block.conflicting
      ? [{ start: block.start, end: block.end }]
      : [];
  });
  const initialSlots = mergeIntervals([...input.freeIntervals, ...reusableBlocks]);
  const slots = [...initialSlots];
  const items: RescueProposalItem[] = [];

  for (const task of sortedTasks) {
    const block = task.currentBlock;
    if (block?.isLocked) {
      items.push({
        taskId: task.id,
        title: task.title,
        action: "keep",
        reason: "locked",
        targetDate: input.targetDate,
        startAt: toISOString(block.start),
        endAt: toISOString(block.end),
        blockId: block.id,
        expectedBlockVersion: block.version,
        expectedTaskUpdatedAt: task.updatedAt,
      });
      continue;
    }
    if (task.recurring && !block) {
      items.push({
        taskId: task.id,
        title: task.title,
        action: "unplaced",
        reason: "recurringOccurrenceRequired",
        targetDate: input.targetDate,
        startAt: null,
        endAt: null,
        blockId: null,
        expectedBlockVersion: null,
        expectedTaskUpdatedAt: task.updatedAt,
      });
      continue;
    }

    const duration = (task.estimatedMinutes ?? DEFAULT_TASK_MINUTES) * 60_000;
    const slotIndex = slots.findIndex((slot) => intervalMinutes(slot) * 60_000 >= duration);
    if (slotIndex < 0) {
      items.push({
        taskId: task.id,
        title: task.title,
        action: "unplaced",
        reason: "noContiguousWindow",
        targetDate: input.targetDate,
        startAt: null,
        endAt: null,
        blockId: block?.id ?? null,
        expectedBlockVersion: block?.version ?? null,
        expectedTaskUpdatedAt: task.updatedAt,
      });
      continue;
    }

    const slot = slots[slotIndex];
    const placement = { start: slot.start, end: slot.start + duration };
    insertSlot(slots, placement);
    const current = block ? { start: block.start, end: block.end } : undefined;
    const deadlineRisk = Boolean(task.deadline && input.targetDate > task.deadline);
    items.push({
      taskId: task.id,
      title: task.title,
      action: deadlineRisk ? "at_risk" : sameInterval(current, placement) ? "keep" : "move",
      reason: deadlineRisk
        ? "targetAfterDeadline"
        : sameInterval(current, placement)
          ? "alreadyFits"
          : "movedToFreeWindow",
      targetDate: input.targetDate,
      startAt: toISOString(placement.start),
      endAt: toISOString(placement.end),
      blockId: block?.id ?? null,
      expectedBlockVersion: block?.version ?? null,
      expectedTaskUpdatedAt: task.updatedAt,
    });
  }

  const unplacedMinutes = items.reduce((total, item) => {
    if (item.action !== "unplaced") return total;
    const task = sortedTasks.find((candidate) => candidate.id === item.taskId);
    return total + (task?.estimatedMinutes ?? DEFAULT_TASK_MINUTES);
  }, 0);

  return {
    targetDate: input.targetDate,
    proposalVersion: versionOf({
      targetDate: input.targetDate,
      freeIntervals: input.freeIntervals,
      tasks: sortedTasks.map((task) => ({
        id: task.id,
        updatedAt: task.updatedAt,
        blockId: task.currentBlock?.id ?? null,
        blockVersion: task.currentBlock?.version ?? null,
      })),
    }),
    items,
    overCapacityMinutes: unplacedMinutes,
  };
}
