"use client";

import * as React from "react";
import { cn } from "cn";
import { Switch as SwitchPrimitive } from "radix-ui";

/** สวิตช์ 48×28 (Claude Design 2a): เปิด = brand-500 · ปิด = neutral-300 · ปุ่มขาว 22px */
function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default";
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch inline-flex shrink-0 items-center rounded-full border-0 p-[3px] transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500/30 disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-7 data-[size=default]:w-12 data-[size=sm]:h-5 data-[size=sm]:w-9 data-[state=checked]:bg-brand-500 data-[state=unchecked]:bg-border-strong",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-neutral-0 shadow-xs ring-0 transition-transform group-data-[size=default]/switch:size-[22px] group-data-[size=sm]/switch:size-3.5 group-data-[size=default]/switch:data-[state=checked]:translate-x-5 group-data-[size=sm]/switch:data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
