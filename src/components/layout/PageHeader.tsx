import type * as React from "react";
import { cn } from "cn";

type Props = {
  title: string;
  /** บรรทัดเล็กเหนือหัวข้อ เช่น "สวัสดีตอนเช้า ปุ๊ก" (Claude Design 2a) */
  eyebrow?: string;
  description?: string;
  /** สิ่งที่อยู่ขวาสุด ชิดฐานหัวข้อ เช่น pill วันที่ / ปุ่ม */
  actions?: React.ReactNode;
  className?: string;
};

/** หัวหน้า: H1 สี brand-800 ชิดล่างกับ actions ด้านขวา (Claude Design 2a header ทุกหน้า) */
export function PageHeader({ title, eyebrow, description, actions, className }: Props) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="text-small text-text-secondary">{eyebrow}</p> : null}
        <h1 className="text-h1 text-brand-800">{title}</h1>
        {description ? (
          <p className="mt-0.5 text-small text-text-secondary">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0 pb-1">{actions}</div> : null}
    </div>
  );
}
