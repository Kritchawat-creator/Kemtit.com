import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

/**
 * ปุ่มทรง pill (Claude Design 2a component sheet): primary brand-500 · outline ขาวขอบ brand-200 ตัวหนังสือ brand-600
 * ghost โปร่ง · destructive danger-500 · สูง 48px บนมือถือ (แตะง่าย) และ 40px บน desktop
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-base font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500/30 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-brand-500 text-neutral-0 hover:bg-brand-600 active:bg-brand-700",
        destructive:
          "bg-danger-500 text-neutral-0 hover:bg-danger-800 focus-visible:ring-danger-500/30",
        outline:
          "border-[1.5px] border-brand-200 bg-bg-surface text-brand-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800",
        secondary: "bg-brand-50 text-brand-800 hover:bg-brand-100",
        ghost: "text-brand-600 hover:bg-brand-50 hover:text-brand-800",
        link: "text-brand-600 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 px-6 has-[>svg]:px-5 md:h-10 md:px-5",
        xs: "h-7 gap-1 px-2.5 text-xs has-[>svg]:px-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-10 gap-1.5 px-4 text-sm has-[>svg]:px-3 md:h-9",
        lg: "h-12 px-6 has-[>svg]:px-5",
        icon: "size-11 md:size-10",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-10 md:size-9",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
