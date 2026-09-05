"use client";

import { useTranslations } from "next-intl";
import type * as React from "react";
import { cn } from "cn";

import { useFormField } from "./form";

type ErrorKey = Parameters<ReturnType<typeof useTranslations<"errors">>>[0];

/**
 * FormMessage ที่แปลข้อความผ่าน th.json (errors.*) — Zod schema ใน core ใส่ error เป็น key ไม่ใช่ข้อความไทย
 * ประกาศผ่าน aria-live ให้ screen reader อ่าน (Design §10)
 */
export function FormMessageI18n({ className, ...props }: React.ComponentProps<"p">) {
  const { error, formMessageId } = useFormField();
  const t = useTranslations("errors");
  if (!error) return null;

  const key = String(error.message ?? "generic") as ErrorKey;
  const text = t.has(key) ? t(key) : t("generic");

  return (
    <p
      id={formMessageId}
      role="alert"
      aria-live="polite"
      className={cn("text-small text-danger-800", className)}
      {...props}
    >
      {text}
    </p>
  );
}
