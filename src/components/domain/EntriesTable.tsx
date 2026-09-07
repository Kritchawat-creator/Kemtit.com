"use client";

import { NotebookPen, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { deleteEntry } from "@/core/entries/actions";
import {
  entryCode,
  entryStatus,
  type Channel,
  type EntryGoalOption,
  type GoalEntryWithGoal,
} from "@/core/entries/schema";
import { goalUnit } from "@/core/goals/schema";
import type { ISODate } from "@/lib/date";
import { formatThaiDate, formatValueParts } from "@/lib/format";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

import { EntryForm } from "./EntryForm";

const UNDO_MS = 5000; // Design §8.5: undo toast แทน confirm

type Props = {
  rows: GoalEntryWithGoal[];
  today: ISODate;
  goalOptions: EntryGoalOption[];
  /** compact = การ์ด "บันทึกยอดล่าสุด" บน dashboard (ไม่มีคอลัมน์ช่องทาง) */
  compact?: boolean;
  /** แสดงชื่อเป้าใต้ชื่อรายการ (หน้า /entries ที่รวมทุกเป้า) */
  showGoal?: boolean;
  emptyState?: React.ReactNode;
};

const TH =
  "border-b border-border px-3 py-2.5 text-left text-caption font-semibold whitespace-nowrap text-text-secondary";
const TD = "border-b border-border px-3 py-3 text-small whitespace-nowrap align-middle";
const ICON_BUTTON =
  "relative flex size-8 shrink-0 items-center justify-center rounded-sm transition-colors after:absolute after:-inset-1.5 after:content-['']";

/**
 * ตารางบันทึกยอด (Claude Design turn 7 D-10): รหัส · วันที่ · รายการ · ช่องทาง · จำนวน · สถานะ · จัดการ
 * แก้ = ResponsiveDialog + EntryForm · ลบ = ซ่อนทันที + undo toast 5 วิ แล้วค่อยยิง action (แพตเทิร์นเดียวกับ TaskList)
 * ปุ่มไอคอน 32px ตามดีไซน์ แต่ขยายพื้นที่กดเป็น 44px ด้วย pseudo-element (Design §7 touch target)
 */
export function EntriesTable({
  rows,
  today,
  goalOptions,
  compact = false,
  showGoal = false,
  emptyState,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [prevRows, setPrevRows] = useState(rows);
  if (rows !== prevRows) {
    setPrevRows(rows);
    setHidden({});
  }
  const [editingId, setEditingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const visible = rows.filter((row) => !hidden[row.id]);
  const editing = visible.find((row) => row.id === editingId) ?? null;

  function remove(row: GoalEntryWithGoal) {
    const code = entryCode(row.entry_no);
    setEditingId(null);
    setHidden((prev) => ({ ...prev, [row.id]: true }));
    const timer = setTimeout(() => {
      timers.current.delete(row.id);
      startTransition(async () => {
        const result = await deleteEntry({ id: row.id });
        if (!result.ok) {
          setHidden((prev) => ({ ...prev, [row.id]: false }));
          toast.error(t("errors.generic"));
          return;
        }
        router.refresh();
      });
    }, UNDO_MS);
    timers.current.set(row.id, timer);
    toast(t("entries.toasts.deleted", { code }), {
      duration: UNDO_MS,
      action: {
        label: t("common.undo"),
        onClick: () => {
          const pending = timers.current.get(row.id);
          if (pending) clearTimeout(pending);
          timers.current.delete(row.id);
          setHidden((prev) => ({ ...prev, [row.id]: false }));
          toast.success(t("entries.toasts.restored", { code }));
        },
      },
    });
  }

  if (visible.length === 0) return <>{emptyState ?? null}</>;

  return (
    <>
      <div className="-mx-3 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={TH}>{t("entries.table.code")}</th>
              <th className={TH}>{t("entries.table.date")}</th>
              <th className={cn(TH, "w-full")}>{t("entries.table.note")}</th>
              {!compact ? <th className={TH}>{t("entries.table.channel")}</th> : null}
              <th className={cn(TH, "text-right")}>{t("entries.table.amount")}</th>
              <th className={TH}>{t("entries.table.status")}</th>
              <th className={cn(TH, "text-right")}>{t("entries.table.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const unit = row.goal ? goalUnit(row.goal) : null;
              const parts = formatValueParts(row.amount, unit);
              const status = entryStatus(row.entry_date, today);
              const isAdjustment = row.note === null;
              return (
                <tr key={row.id}>
                  <td className={cn(TD, "font-medium text-text-secondary")}>
                    {entryCode(row.entry_no)}
                  </td>
                  <td className={cn(TD, "text-text-primary")}>
                    {formatThaiDate(row.entry_date, "weekday")}
                  </td>
                  <td className={cn(TD, "w-full text-text-primary")}>
                    <span className="flex items-center gap-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-brand-50 text-brand-600">
                        <NotebookPen className="size-4" strokeWidth={1.5} aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate">
                          {row.note ?? t("entries.adjustment")}
                        </span>
                        {showGoal && row.goal ? (
                          <span className="block truncate text-caption text-text-secondary">
                            {row.goal.title}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </td>
                  {!compact ? (
                    <td className={cn(TD, "text-text-secondary")}>
                      {row.channel
                        ? t(`entries.channels.${row.channel as Channel}`)
                        : t("entries.noChannel")}
                    </td>
                  ) : null}
                  <td className={cn(TD, "text-right text-text-primary")}>
                    <span className="font-semibold">
                      {isAdjustment && row.amount > 0 ? "+" : ""}
                      {parts.value}
                    </span>
                    {parts.unit ? (
                      <span className="text-caption text-text-secondary"> {parts.unit}</span>
                    ) : null}
                  </td>
                  <td className={TD}>
                    <span
                      className={cn(
                        "inline-flex h-6 items-center rounded-full px-2.5 text-caption font-medium",
                        status === "today"
                          ? "bg-brand-50 text-brand-800"
                          : "bg-success-50 text-success-800",
                      )}
                    >
                      {t(`entries.status.${status}`)}
                    </span>
                  </td>
                  <td className={TD}>
                    <span className="flex justify-end gap-1">
                      <button
                        type="button"
                        aria-label={t("common.edit")}
                        onClick={() => setEditingId(row.id)}
                        className={cn(ICON_BUTTON, "bg-brand-50 text-brand-600 hover:bg-brand-100")}
                      >
                        <Pencil className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={t("common.delete")}
                        onClick={() => remove(row)}
                        className={cn(
                          ICON_BUTTON,
                          "hover:bg-danger-100 bg-danger-50 text-danger-800",
                        )}
                      >
                        <Trash2 className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                      </button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ResponsiveDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditingId(null)}
        title={t("common.edit")}
      >
        {editing ? (
          <EntryForm
            mode="edit"
            entryId={editing.id}
            goalOptions={
              editing.goal
                ? goalOptions.filter((option) => option.id === editing.goal?.id)
                : goalOptions
            }
            initial={{
              goalId: editing.goal_id,
              entryDate: editing.entry_date,
              amount: Number(editing.amount),
              note: editing.note ?? "",
              channel: editing.channel,
            }}
            onDone={() => setEditingId(null)}
            onDelete={() => remove(editing)}
          />
        ) : null}
      </ResponsiveDialog>
    </>
  );
}
