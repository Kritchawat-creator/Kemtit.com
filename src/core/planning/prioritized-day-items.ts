type TaskItem<TTask extends { id: string }> = {
  task: TTask;
};

export function splitPrioritizedDayItems<T extends TaskItem<{ id: string }>>(
  items: readonly T[],
  priorityTaskIds: readonly string[],
  limit = 3,
): { prioritized: T[]; remaining: T[] } {
  const priorityRank = new Map(
    [...new Set(priorityTaskIds)]
      .slice(0, Math.max(0, limit))
      .map((taskId, index) => [taskId, index]),
  );

  const prioritized = items
    .filter((item) => priorityRank.has(item.task.id))
    .sort((left, right) => priorityRank.get(left.task.id)! - priorityRank.get(right.task.id)!);

  return {
    prioritized,
    remaining: items.filter((item) => !priorityRank.has(item.task.id)),
  };
}

/** Reorder visible priorities while keeping saved priorities from other scopes in place. */
export function reorderVisiblePriorityIds(
  priorityTaskIds: readonly string[],
  visiblePriorityTaskIds: readonly string[],
  nextVisiblePriorityTaskIds: readonly string[],
): string[] {
  if (
    visiblePriorityTaskIds.length !== nextVisiblePriorityTaskIds.length ||
    new Set(visiblePriorityTaskIds).size !== visiblePriorityTaskIds.length ||
    new Set(nextVisiblePriorityTaskIds).size !== nextVisiblePriorityTaskIds.length ||
    visiblePriorityTaskIds.some((id) => !nextVisiblePriorityTaskIds.includes(id))
  ) {
    return [...priorityTaskIds];
  }

  const visibleIds = new Set(visiblePriorityTaskIds);
  let nextIndex = 0;
  return priorityTaskIds.map((id) =>
    visibleIds.has(id) ? nextVisiblePriorityTaskIds[nextIndex++] : id,
  );
}
