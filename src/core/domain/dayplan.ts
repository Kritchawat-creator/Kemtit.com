import { isBeforeISO, type ISODate } from "@/lib/date";

import { occursOn, parseRRule } from "./recurrence";

/**
 * ประกอบ "งานของวัน" จาก task ดิบ + ประวัติ task_completions (pure — ทดสอบได้ไม่ต้องมี DB)
 * - task เดี่ยว: แสดงในวันที่ครบกำหนด; ถ้าเลยกำหนดและยังไม่เสร็จ → กลุ่ม "ค้าง" (เฉพาะเมื่อดูวันนี้)
 * - task ซ้ำ: แสดงทุกวันที่ rule ตรง ตั้งแต่ due_date (anchor); เสร็จเมื่อมีแถวใน task_completions ของวันนั้น
 *   occurrence ที่ผ่านไปแล้วไม่ถือว่า "ค้าง" (routine ไม่ทบ)
 */
export type PlanTask = {
  id: string;
  title: string;
  domain: string;
  due_date: string;
  recurrence_rule: string | null;
  completed_at: string | null;
  goal_id: string | null;
  goal?: { id: string; title: string } | null;
};

export type PlanCompletion = { task_id: string; completed_on: string };

export type DayTaskItem<T extends PlanTask = PlanTask> = {
  /** key เฉพาะต่อ occurrence */
  key: string;
  task: T;
  date: ISODate;
  done: boolean;
  overdue: boolean;
  recurring: boolean;
};

export type DayPlan<T extends PlanTask = PlanTask> = {
  date: ISODate;
  overdue: DayTaskItem<T>[];
  due: DayTaskItem<T>[];
  done: DayTaskItem<T>[];
};

export function itemsForDate<T extends PlanTask>(
  tasks: T[],
  completions: PlanCompletion[],
  date: ISODate,
): DayTaskItem<T>[] {
  const completedOn = new Set(completions.filter((c) => c.completed_on === date).map((c) => c.task_id));
  const items: DayTaskItem<T>[] = [];
  for (const task of tasks) {
    const rule = parseRRule(task.recurrence_rule);
    if (rule) {
      if (occursOn(rule, task.due_date, date)) {
        items.push({ key: `${task.id}:${date}`, task, date, done: completedOn.has(task.id), overdue: false, recurring: true });
      }
    } else if (task.due_date === date) {
      items.push({ key: task.id, task, date, done: task.completed_at !== null, overdue: false, recurring: false });
    }
  }
  return items;
}

/** งานเดี่ยวที่เลยกำหนดและยังไม่เสร็จ (ก่อนวัน today) */
export function overdueItems<T extends PlanTask>(tasks: T[], today: ISODate): DayTaskItem<T>[] {
  return tasks
    .filter((t) => t.recurrence_rule === null && t.completed_at === null && isBeforeISO(t.due_date, today))
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .map((task) => ({ key: task.id, task, date: task.due_date, done: false, overdue: true, recurring: false }));
}

export function buildDayPlan<T extends PlanTask>(
  tasks: T[],
  completions: PlanCompletion[],
  date: ISODate,
  today: ISODate,
): DayPlan<T> {
  const items = itemsForDate(tasks, completions, date);
  return {
    date,
    overdue: date === today ? overdueItems(tasks, today) : [],
    due: items.filter((i) => !i.done),
    done: items.filter((i) => i.done),
  };
}

/** งานทั้งหมดของ goal หนึ่ง (หน้า detail): task ซ้ำแสดงสถานะของวันนี้ */
export function goalTaskItems<T extends PlanTask>(tasks: T[], completions: PlanCompletion[], today: ISODate): DayTaskItem<T>[] {
  const completedToday = new Set(completions.filter((c) => c.completed_on === today).map((c) => c.task_id));
  return tasks.map((task) => {
    const recurring = task.recurrence_rule !== null;
    const done = recurring ? completedToday.has(task.id) : task.completed_at !== null;
    return {
      key: recurring ? `${task.id}:${today}` : task.id,
      task,
      date: recurring ? today : task.due_date,
      done,
      overdue: !recurring && !done && isBeforeISO(task.due_date, today),
      recurring,
    };
  });
}
