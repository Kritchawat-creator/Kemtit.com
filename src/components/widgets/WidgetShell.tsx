import type * as React from "react";
import { cn } from "cn";

type Props = {
  title: string;
  description?: string;
  /** ลิงก์/ปุ่มมุมขวาบน */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

/**
 * กรอบ widget (Design §6.2) — POC layout คงที่: ยังไม่ render drag handle/เมนู (MVP จะเติมใน slot นี้)
 * ระดับ flat: border ไม่มีเงา (Design §5.3)
 */
export function WidgetShell({ title, description, action, children, className }: Props) {
  return (
    <section
      aria-label={title}
      className={cn("flex flex-col rounded-lg border border-border bg-bg-surface p-4 md:p-5", className)}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-h2 text-text-primary">{title}</h2>
          {description ? <p className="mt-0.5 text-small text-text-secondary">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}
