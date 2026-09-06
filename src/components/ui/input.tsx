import * as React from "react";
import { cn } from "cn";

/** Input (Claude Design 2a): สูง 48px มุม 10px ขอบ 1.5px — โฟกัสเปลี่ยนขอบเป็น brand-500 ไม่มีเงา */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-sm border-[1.5px] border-border bg-bg-surface px-3.5 py-1 text-base text-text-primary transition-[color,border-color,box-shadow] outline-none selection:bg-brand-500 selection:text-neutral-0 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-text-muted disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-brand-500 focus-visible:ring-[3px] focus-visible:ring-brand-500/15",
        "aria-invalid:border-danger-500 aria-invalid:ring-danger-500/15",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
