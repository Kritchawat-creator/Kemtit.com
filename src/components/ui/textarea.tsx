import * as React from "react";
import { cn } from "cn";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-sm border-[1.5px] border-border bg-bg-surface px-3.5 py-2.5 text-base text-text-primary transition-[color,border-color,box-shadow] outline-none placeholder:text-text-muted disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-brand-500 focus-visible:ring-[3px] focus-visible:ring-brand-500/15",
        "aria-invalid:border-danger-500 aria-invalid:ring-danger-500/15",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
