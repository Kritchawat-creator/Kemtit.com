import type * as React from "react";
import { cn } from "cn";

type Props = {
  title: string;
  description?: string;
  /** ลิงก์/ปุ่ม/pill มุมขวาบน */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

/**
 * กรอบ widget (Design §6.2 + Claude Design 2a): การ์ดขาวมุม 24px เงาม่วงนุ่ม ไม่มีเส้นขอบ · หัวข้อ h2 สี brand-800
 * POC layout คงที่: ยังไม่ render drag handle/เมนู (MVP จะเติมใน slot นี้)
 */
export function WidgetShell({ title, description, action, children, className }: Props) {
  return (
    <section
      aria-label={title}
      className={cn("flex flex-col rounded-xl bg-bg-surface px-5 pt-4 pb-3 shadow-md", className)}
    >
      <header className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-h2 text-brand-800">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-caption text-text-secondary">{description}</p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2 pt-0.5">{action}</div> : null}
      </header>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}
