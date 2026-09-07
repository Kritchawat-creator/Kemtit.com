"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { createTask } from "@/core/tasks/actions";
import type { ISODate } from "@/lib/date";
import { Button } from "@/components/ui/button";

type Props = { today: ISODate; className?: string };

/**
 * บรรทัดท้ายลิสต์ "งานวันนี้" (Claude Design turn 6 ④): พิมพ์ชื่องานแล้ว Enter ได้เลย ไม่ต้องเปิดฟอร์ม
 * ค่าอื่นใช้ค่าเริ่มต้น (ครบกำหนดวันนี้ · ด้าน "งาน" · ไม่ทำซ้ำ · ไม่ผูกเป้า) — แก้เพิ่มได้จากรายละเอียดงาน
 */
export function QuickTaskInput({ today, className }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const result = await createTask({
        title: trimmed,
        dueDate: today,
        domain: "work",
        recurrence: "none",
        weekdays: [],
        goalId: null,
      });
      if (!result.ok) {
        toast.error(t("errors.generic"));
        return;
      }
      toast.success(t("tasks.toasts.created"));
      setTitle("");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={submit}
      className={cn("mt-auto flex items-center gap-2 border-t border-border pt-3", className)}
      noValidate
    >
      <span
        aria-hidden="true"
        className="flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-brand-200 text-brand-600"
      >
        <Plus className="size-3" strokeWidth={1.5} />
      </span>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label={t("widgets.todayTasks.add")}
        placeholder={t("widgets.todayTasks.quickPlaceholder")}
        className="h-10 min-w-0 flex-1 bg-transparent text-base text-text-primary outline-none placeholder:text-text-muted"
      />
      <Button type="submit" variant="secondary" size="sm" disabled={pending || !title.trim()}>
        {pending ? t("common.saving") : t("common.add")}
      </Button>
    </form>
  );
}
