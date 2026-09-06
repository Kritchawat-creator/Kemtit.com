"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Toast โทนสว่างตาม token (Claude Design 3o): สำเร็จ = success-50, ผิดพลาด = danger-50, ทั่วไป/undo = brand-50
 * ปุ่ม action เป็น pill ขาวตัวหนังสือ brand-600 · เงาม่วงแทนเงาดำ · มุม 14px
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      richColors
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: "!border-0 !shadow-toast !font-sans !text-base !font-medium !py-3 !pl-4 !pr-3",
          title: "!text-base !font-medium",
          description: "!text-small !opacity-80",
          actionButton:
            "!h-8 !rounded-full !bg-bg-surface !px-3 !text-sm !font-medium !text-brand-600 hover:!bg-brand-100",
          cancelButton: "!h-8 !rounded-full !bg-transparent !px-3 !text-sm !font-medium",
          closeButton: "!border-0 !bg-bg-surface !text-text-secondary !shadow-xs",
        },
      }}
      style={
        {
          "--normal-bg": "var(--color-brand-50)",
          "--normal-text": "var(--color-brand-800)",
          "--normal-border": "transparent",
          "--success-bg": "var(--color-success-50)",
          "--success-text": "var(--color-success-800)",
          "--success-border": "transparent",
          "--error-bg": "var(--color-danger-50)",
          "--error-text": "var(--color-danger-800)",
          "--error-border": "transparent",
          "--warning-bg": "var(--color-warning-50)",
          "--warning-text": "var(--color-warning-800)",
          "--warning-border": "transparent",
          "--info-bg": "var(--color-brand-50)",
          "--info-text": "var(--color-brand-800)",
          "--info-border": "transparent",
          "--border-radius": "var(--radius-md)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
