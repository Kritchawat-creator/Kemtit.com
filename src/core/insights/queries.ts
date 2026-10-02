import "server-only";

import { DOMAINS, type Domain } from "@/core/domain/domains";
import { getFinanceBudget, getFinanceMonthSummary, listFinanceBills } from "@/core/finance/queries";
import { listGoalsWithProgress } from "@/core/goals/queries";
import { getActiveHabits, getHabitWeekStats } from "@/core/habits/queries";
import { getTimeBlockStatsForRange } from "@/core/planning/queries";
import { getRangeTasks, getStreak, getWeekTaskStats } from "@/core/tasks/queries";
import {
  endOfMonthISO,
  endOfWeekISO,
  startOfMonthISO,
  startOfWeekISO,
  type ISODate,
} from "@/lib/date";

export type DomainActivity = {
  domain: Domain;
  items: number;
};

export type InsightsSnapshot = {
  ranges: {
    weekStart: ISODate;
    weekEnd: ISODate;
    monthStart: ISODate;
    monthEnd: ISODate;
  };
  productivity: {
    tasksDone: number;
    tasksTotal: number;
    completionRate: number;
    streakDays: number;
  };
  time: {
    blocks: number;
    minutes: number;
  };
  finance: {
    income: number;
    expense: number;
    balance: number;
    budget: number | null;
    budgetRemaining: number | null;
    dueBills: number;
    paidBills: number;
  };
  goals: {
    active: number;
    completed: number;
    averageProgress: number;
  };
  routine: {
    habits: number;
    done: number;
    target: number;
    todayDone: number;
    todayTotal: number;
  };
  lifeBalance: DomainActivity[];
};

export async function getInsightsSnapshot(today: ISODate): Promise<InsightsSnapshot> {
  const weekStart = startOfWeekISO(today);
  const weekEnd = endOfWeekISO(today);
  const monthStart = startOfMonthISO(today);
  const monthEnd = endOfMonthISO(today);

  const [
    taskStats,
    streakDays,
    timeStats,
    habitStats,
    habitsToday,
    financeSummary,
    budget,
    bills,
    goals,
    weekTasks,
  ] = await Promise.all([
    getWeekTaskStats(today),
    getStreak(today),
    getTimeBlockStatsForRange(weekStart, weekEnd),
    getHabitWeekStats(weekStart, weekEnd),
    getActiveHabits(today),
    getFinanceMonthSummary(monthStart, monthEnd),
    getFinanceBudget(monthStart),
    listFinanceBills(monthStart, monthEnd),
    listGoalsWithProgress(),
    getRangeTasks(weekStart, weekEnd),
  ]);

  const activeGoals = goals.filter((goal) => goal.status === "active");
  const completedGoals = goals.filter((goal) => goal.status === "completed");
  const averageProgress =
    activeGoals.length === 0
      ? 0
      : activeGoals.reduce((sum, goal) => sum + goal.progress.percent, 0) / activeGoals.length;

  const domainCounts = new Map<Domain, number>(DOMAINS.map((domain) => [domain, 0]));
  for (const goal of activeGoals) {
    domainCounts.set(goal.domain, (domainCounts.get(goal.domain) ?? 0) + 1);
  }
  for (const task of weekTasks.tasks) {
    domainCounts.set(task.domain, (domainCounts.get(task.domain) ?? 0) + 1);
  }
  for (const habit of habitsToday) {
    const domain = habit.domain as Domain;
    domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
  }

  const dueBills = bills.filter((bill) => bill.status === "due").length;
  const paidBills = bills.filter((bill) => bill.status === "paid").length;
  const budgetAmount = budget ? Number(budget.amount) : null;

  return {
    ranges: { weekStart, weekEnd, monthStart, monthEnd },
    productivity: {
      tasksDone: taskStats.done,
      tasksTotal: taskStats.total,
      completionRate: taskStats.total > 0 ? taskStats.done / taskStats.total : 0,
      streakDays,
    },
    time: timeStats,
    finance: {
      income: financeSummary.income,
      expense: financeSummary.expense,
      balance: financeSummary.balance,
      budget: budgetAmount,
      budgetRemaining:
        budgetAmount == null ? null : Math.max(0, budgetAmount - financeSummary.expense),
      dueBills,
      paidBills,
    },
    goals: {
      active: activeGoals.length,
      completed: completedGoals.length,
      averageProgress,
    },
    routine: {
      habits: habitStats.habits,
      done: habitStats.done,
      target: habitStats.target,
      todayDone: habitsToday.filter((habit) => habit.done).length,
      todayTotal: habitsToday.length,
    },
    lifeBalance: DOMAINS.map((domain) => ({
      domain,
      items: domainCounts.get(domain) ?? 0,
    })),
  };
}
