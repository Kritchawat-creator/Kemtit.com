"use client";

import { Pencil, RotateCcw, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setTimeBlockStatus, updateTimeBlock } from "@/core/planning/actions";
import type { Database } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TimeBlock = Database["public"]["Tables"]["time_blocks"]["Row"];

type Props = Pick<TimeBlock, "id" | "title" | "start_at" | "end_at" | "version" | "status">;

function toBangkokInput(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date(value))
    .replace(" ", "T");
}

function toBangkokIso(value: string) {
  return new Date(`${value}:00+07:00`).toISOString();
}

export function TimeBlockActions({ id, title: initialTitle, start_at, end_at, version: initialVersion, status: initialStatus }: Props) {
  const t = useTranslations();
  const [title, setTitle] = useState(initialTitle);
  const [startAt, setStartAt] = useState(toBangkokInput(start_at));
  const [endAt, setEndAt] = useState(toBangkokInput(end_at));
  const [version, setVersion] = useState(initialVersion);
  const [status, setStatus] = useState<"active" | "cancelled">(
    initialStatus === "cancelled" ? "cancelled" : "active",
  );
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await updateTimeBlock({
        id,
        title: title.trim(),
        startAt: toBangkokIso(startAt),
        endAt: toBangkokIso(endAt),
        expectedVersion: version,
      });
      if (!result.ok) {
        toast.error(
          result.error === "timeBlockConflict"
            ? t("errors.timeBlockConflict")
            : t("errors.generic"),
        );
        return;
      }
      setVersion((current) => current + 1);
      setEditing(false);
      toast.success(t("planning.timeBlockUpdated"));
    });
  }

  function changeStatus(nextStatus: "active" | "cancelled") {
    startTransition(async () => {
      const result = await setTimeBlockStatus({ id, expectedVersion: version, status: nextStatus });
      if (!result.ok) {
        toast.error(
          result.error === "timeBlockConflict"
            ? t("errors.timeBlockConflict")
            : t("errors.generic"),
        );
        return;
      }
      setVersion((current) => current + 1);
      setStatus(nextStatus);
      setEditing(false);
      toast.success(
        nextStatus === "cancelled"
          ? t("planning.timeBlockCancelled")
          : t("planning.timeBlockRestored"),
      );
    });
  }

  if (status === "cancelled") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => changeStatus("active")}
        disabled={pending}
      >
        <RotateCcw aria-hidden="true" />
        {t("planning.restoreTimeBlock")}
      </Button>
    );
  }

  return (
    <div className="mt-2">
      {editing ? (
        <div className="grid gap-2 rounded-lg border border-border bg-bg-surface p-3 sm:grid-cols-2">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} aria-label={t("planning.timeBlockTitle")} />
          <Input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} aria-label={t("planning.starts")} />
          <Input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} aria-label={t("planning.ends")} />
          <div className="flex gap-2 sm:col-span-2">
            <Button type="button" size="sm" onClick={save} disabled={pending || !title.trim()}>
              {t("common.save")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={pending}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)} disabled={pending}>
            <Pencil aria-hidden="true" />
            {t("planning.editTimeBlock")}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => changeStatus("cancelled")} disabled={pending}>
            <X aria-hidden="true" />
            {t("planning.cancelTimeBlock")}
          </Button>
        </div>
      )}
    </div>
  );
}
