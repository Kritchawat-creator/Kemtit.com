"use client";

import { Check, ChevronDown, ChevronUp, Pencil, Trash2 } from "@/components/icons/ui-icons";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  addSubtask,
  deleteSubtask,
  listTaskSubtasks,
  reorderSubtasks,
  toggleSubtask,
  updateSubtask,
  type TaskSubtask,
} from "@/core/tasks/subtasks";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

export function TaskSubtaskList({ taskId }: { taskId: string }) {
  const t = useTranslations();
  const [items, setItems] = useState<TaskSubtask[]>([]);
  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    void listTaskSubtasks({ taskId }).then((result) => {
      if (active && result.ok) setItems(result.data);
    });
    return () => {
      active = false;
    };
  }, [taskId]);

  function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      const result = await addSubtask({ taskId, title });
      if (!result.ok) {
        toast.error(t("errors.generic"));
        return;
      }
      setItems((current) => [...current, result.data]);
      setTitle("");
    });
  }

  function toggle(item: TaskSubtask, done: boolean) {
    startTransition(async () => {
      const result = await toggleSubtask({ id: item.id, done });
      if (!result.ok) {
        toast.error(t("errors.generic"));
        return;
      }
      setItems((current) => current.map((candidate) => (candidate.id === item.id ? result.data : candidate)));
    });
  }

  function saveEdit(item: TaskSubtask) {
    if (!editingTitle.trim()) return;
    startTransition(async () => {
      const result = await updateSubtask({ id: item.id, title: editingTitle });
      if (!result.ok) {
        toast.error(t("errors.generic"));
        return;
      }
      setItems((current) => current.map((candidate) => (candidate.id === item.id ? result.data : candidate)));
      setEditingId(null);
    });
  }

  function remove(item: TaskSubtask) {
    startTransition(async () => {
      const result = await deleteSubtask({ id: item.id });
      if (!result.ok) {
        toast.error(t("errors.generic"));
        return;
      }
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
    });
  }

  function move(item: TaskSubtask, direction: -1 | 1) {
    const index = items.findIndex((candidate) => candidate.id === item.id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(nextIndex, 0, moved);
    setItems(next.map((candidate, position) => ({ ...candidate, position })));
    startTransition(async () => {
      const result = await reorderSubtasks({ taskId, ids: next.map((candidate) => candidate.id) });
      if (!result.ok) {
        toast.error(t("errors.generic"));
        const refreshed = await listTaskSubtasks({ taskId });
        if (refreshed.ok) setItems(refreshed.data);
      }
    });
  }

  return (
    <section className="space-y-3" aria-labelledby="task-subtasks-heading">
      <h3 id="task-subtasks-heading" className="text-h3 text-text-primary">
        {t("tasks.subtasks.heading")}
      </h3>
      {items.length === 0 ? (
        <p className="text-small text-text-secondary">{t("tasks.subtasks.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={item.id} className="flex items-center gap-2 rounded-md bg-bg-subtle px-2 py-2">
              <Checkbox
                checked={item.completed_at !== null}
                onCheckedChange={(checked) => toggle(item, checked === true)}
                aria-label={item.title}
              />
              {editingId === item.id ? (
                <Input
                  value={editingTitle}
                  onChange={(event) => setEditingTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") saveEdit(item);
                    if (event.key === "Escape") setEditingId(null);
                  }}
                  className="h-9 flex-1"
                  aria-label={t("tasks.subtasks.edit")}
                />
              ) : (
                <span
                  className={`min-w-0 flex-1 text-small ${item.completed_at ? "text-text-muted line-through" : "text-text-primary"}`}
                >
                  {item.title}
                </span>
              )}
              {editingId === item.id ? (
                <Button size="sm" variant="outline" onClick={() => saveEdit(item)} disabled={pending}>
                  {t("tasks.subtasks.save")}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  aria-label={t("tasks.subtasks.edit")}
                  onClick={() => {
                    setEditingId(item.id);
                    setEditingTitle(item.title);
                  }}
                >
                  <Pencil aria-hidden="true" />
                </Button>
              )}
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={t("tasks.subtasks.moveUp")}
                onClick={() => move(item, -1)}
                disabled={pending || index === 0}
              >
                <ChevronUp aria-hidden="true" />
              </Button>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={t("tasks.subtasks.moveDown")}
                onClick={() => move(item, 1)}
                disabled={pending || index === items.length - 1}
              >
                <ChevronDown aria-hidden="true" />
              </Button>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={t("tasks.subtasks.delete")}
                onClick={() => remove(item)}
                disabled={pending}
              >
                <Trash2 aria-hidden="true" />
              </Button>
              <Check className="sr-only" aria-hidden="true" />
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="flex gap-2" noValidate>
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t("tasks.subtasks.placeholder")}
          aria-label={t("tasks.subtasks.placeholder")}
          className="h-10"
        />
        <Button type="submit" size="sm" variant="outline" disabled={pending || !title.trim()}>
          {t("tasks.subtasks.add")}
        </Button>
      </form>
    </section>
  );
}
