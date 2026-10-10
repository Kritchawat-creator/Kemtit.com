import type { ISODate } from "@/lib/date";

export type HabitHistoryState = "done" | "noRecord" | "notStarted" | "future";

export type HabitHistoryInput = {
  id: string;
  title: string;
  cadence: "daily" | "weekly";
  target_per_week: number;
  created_on: ISODate;
};

export type HabitHistoryRow = Omit<HabitHistoryInput, "created_on"> & {
  days: { date: ISODate; state: HabitHistoryState }[];
};

/** Classify only what the completion records prove; weekly targets are not daily promises. */
export function habitHistoryState(
  createdOn: ISODate,
  date: ISODate,
  today: ISODate,
  completed: boolean,
): HabitHistoryState {
  if (date > today) return "future";
  if (date < createdOn) return "notStarted";
  return completed ? "done" : "noRecord";
}

export function buildHabitHistory(
  habits: HabitHistoryInput[],
  days: ISODate[],
  today: ISODate,
  completions: ReadonlySet<string>,
): HabitHistoryRow[] {
  return habits.map((habit) => ({
    id: habit.id,
    title: habit.title,
    cadence: habit.cadence,
    target_per_week: habit.target_per_week,
    days: days.map((date) => ({
      date,
      state: habitHistoryState(
        habit.created_on,
        date,
        today,
        completions.has(`${habit.id}:${date}`),
      ),
    })),
  }));
}
