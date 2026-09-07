import { getTranslations } from "next-intl/server";
import type * as React from "react";
import { cn } from "cn";

type Props = {
  title: string;
  titleId?: string;
  /** สิ่งที่วางต่อท้ายหัวข้อ เช่น DomainTag */
  titleAddon?: React.ReactNode;
  /** บรรทัดเล็กเหนือหัวข้อบนมือถือ / ข้อความรองต่อท้ายหัวข้อบน desktop เช่น "สวัสดีตอนเช้า ปุ๊ก" */
  eyebrow?: string;
  description?: string;
  /** ข้อมูลรองที่แสดงเฉพาะ desktop (มือถือใช้ `actions` แทน) เช่น เดือนปัจจุบัน */
  meta?: string;
  /**
   * Claude Design turn 7: บรรทัด "Kemtit › {breadcrumb}" ใต้หัวข้อบน desktop เท่านั้น (เมื่อมีค่า จะดึง
   * `meta` มาต่อท้ายบรรทัดนี้แทนที่จะแสดงแยก) — ไม่ส่ง prop นี้ = แสดงผลเหมือนเดิมทุกจุด (impact HIGH 5 หน้า)
   */
  breadcrumb?: string;
  /** มุมขวาของหัวข้อบนมือถือเท่านั้น (desktop มุมขวาเป็น persona/avatar) */
  actions?: React.ReactNode;
  /** toolbar (Claude Design turn 4): ตัวควบคุมซ้าย — มือถือเต็มความกว้างใต้หัวข้อ · desktop 4 คอลัมน์ */
  toolbarStart?: React.ReactNode;
  /** ปุ่มการกระทำชิดขวาของ toolbar — desktop เท่านั้น (มือถือใช้ FAB) */
  toolbarEnd?: React.ReactNode;
  className?: string;
};

/**
 * หัวหน้า: มือถือ = H1 brand-800 ชิดล่างกับ actions ขวา · desktop = header 72px (H1 + ข้อมูลรองบน baseline เดียว)
 * ตามด้วย toolbar grid 12 คอลัมน์ (ซ้าย 4 · ขวา 8) เมื่อมี
 */
export async function PageHeader({
  title,
  titleId,
  titleAddon,
  eyebrow,
  description,
  meta,
  breadcrumb,
  actions,
  toolbarStart,
  toolbarEnd,
  className,
}: Props) {
  // ใช้เฉพาะบรรทัด breadcrumb ("Kemtit › ...") — เรียกไม่มีเงื่อนไขกันปัญหา narrow ชนิดข้าม branch
  const t = await getTranslations();
  return (
    <div className={cn("mb-4 lg:mb-3", className)}>
      <div className="flex items-end justify-between gap-3 lg:min-h-[72px] lg:items-center lg:pr-[520px] xl:pr-[600px]">
        <div className="min-w-0 lg:flex lg:flex-wrap lg:items-baseline lg:gap-x-3">
          {eyebrow ? <p className="text-small text-text-secondary lg:order-2">{eyebrow}</p> : null}
          <div className="flex min-w-0 items-center gap-2 lg:order-1">
            <h1
              id={titleId}
              className={cn("min-w-0 truncate text-h1 text-brand-800", breadcrumb && "lg:text-h2")}
            >
              {title}
            </h1>
            {titleAddon}
          </div>
          {description ? (
            <p className="mt-0.5 text-small text-text-secondary lg:order-3 lg:mt-0">
              {description}
            </p>
          ) : null}
          {breadcrumb ? (
            <p className="hidden w-full items-center gap-1.5 text-caption text-text-secondary lg:order-5 lg:flex">
              <span>{t("app.nameLatin")}</span>
              <span aria-hidden="true">›</span>
              <span className="text-brand-800">{breadcrumb}</span>
              {meta ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{meta}</span>
                </>
              ) : null}
            </p>
          ) : meta ? (
            <p className="hidden text-small text-text-secondary lg:order-4 lg:block">{meta}</p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0 pb-1 lg:hidden">{actions}</div> : null}
      </div>
      {toolbarStart || toolbarEnd ? (
        <div className="mt-3 grid grid-cols-12 items-center gap-3 lg:mt-1 lg:min-h-12 lg:gap-6">
          <div className="col-span-12 lg:col-span-4">{toolbarStart}</div>
          {toolbarEnd ? (
            <div className="hidden lg:col-span-8 lg:flex lg:items-center lg:justify-end lg:gap-3">
              {toolbarEnd}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
