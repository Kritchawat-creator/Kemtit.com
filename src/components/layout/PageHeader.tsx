import { getTranslations } from "next-intl/server";
import type * as React from "react";
import { cn } from "cn";

type Props = {
  title: string;
  titleId?: string;
  titleAddon?: React.ReactNode;
  eyebrow?: string;
  description?: string;
  meta?: string;
  breadcrumb?: string;
  actions?: React.ReactNode;
  toolbarStart?: React.ReactNode;
  toolbarEnd?: React.ReactNode;
  className?: string;
};

/**
 * Prototype-aligned screen header:
 * eyebrow → large title → supporting copy, with compact date/meta and one toolbar row.
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
  const t = await getTranslations();

  return (
    <header className={cn("mb-6 min-w-0", className)}>
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 min-[761px]:gap-4 min-[1151px]:items-end">
        <div className="min-w-0 flex-1 basis-[280px]">
          {eyebrow ? (
            <p className="mb-3 text-caption font-semibold tracking-[.04em] break-words text-text-secondary">
              {eyebrow}
            </p>
          ) : null}

          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <h1
              id={titleId}
              className="min-w-0 max-w-full text-[clamp(28px,3vw,38px)] leading-[1.08] font-semibold tracking-[-0.04em] break-words text-text-primary"
            >
              {title}
            </h1>
            {titleAddon}
          </div>

          {description ? (
            <p className="mt-2 max-w-3xl text-small leading-relaxed break-words text-text-secondary">
              {description}
            </p>
          ) : null}

          {breadcrumb ? (
            <p className="mt-2 hidden min-w-0 flex-wrap items-center gap-1.5 text-caption break-words text-text-secondary min-[1151px]:flex">
              <span>{t("app.nameLatin")}</span>
              <span aria-hidden="true">›</span>
              <span className="min-w-0 font-medium text-text-primary">{breadcrumb}</span>
              {meta ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="min-w-0">{meta}</span>
                </>
              ) : null}
            </p>
          ) : null}
        </div>

        {!breadcrumb && meta ? (
          <p className="hidden min-w-0 max-w-full rounded-md border border-border bg-bg-surface px-3 py-1.5 text-caption font-medium break-words text-text-secondary shadow-xs min-[1151px]:block">
            {meta}
          </p>
        ) : null}

        {actions ? (
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 min-[1151px]:hidden">{actions}</div>
        ) : null}
      </div>

      {toolbarStart || toolbarEnd ? (
        <div
          className={cn(
            "mt-4 min-w-0",
            toolbarEnd && "grid grid-cols-12 items-center gap-3 min-[1151px]:gap-4",
          )}
        >
          {toolbarStart ? (
            <div
              className={cn(
                "min-w-0",
                toolbarEnd ? "col-span-12 min-[1151px]:col-span-5" : "max-w-xl",
              )}
            >
              {toolbarStart}
            </div>
          ) : null}

          {toolbarEnd ? (
            <div
              className={cn(
                "col-span-12 flex min-w-0 flex-wrap items-center justify-start gap-2 min-[1151px]:justify-end",
                toolbarStart ? "min-[1151px]:col-span-7" : "min-[1151px]:col-span-12",
              )}
            >
              {toolbarEnd}
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
