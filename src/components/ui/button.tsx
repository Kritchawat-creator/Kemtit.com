import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

/**
 * ปุ่มทรง pill (Claude Design 2a component sheet): primary brand-500 · outline ขาวขอบ brand-200 ตัวหนังสือ brand-600
 * ghost โปร่ง · destructive danger-500 · สูง 48px บนมือถือ (แตะง่าย) และ 40px บน desktop
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-base font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500/15 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/15 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-brand-500 text-neutral-0 hover:bg-brand-600 active:bg-brand-700",
        destructive:
          "bg-danger-500 text-neutral-0 hover:bg-danger-800 focus-visible:ring-danger-500/30",
        outline:
          "border border-border bg-bg-surface text-text-primary shadow-xs hover:border-border-strong hover:bg-bg-subtle",
        secondary: "border border-border bg-bg-subtle text-text-primary hover:bg-neutral-200",
        ghost: "text-text-secondary hover:bg-bg-subtle hover:text-text-primary",
        link: "text-brand-600 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 has-[>svg]:px-3.5 md:h-10",
        xs: "h-8 gap-1 px-2.5 text-xs has-[>svg]:px-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-10 gap-1.5 px-3.5 text-sm has-[>svg]:px-3 md:h-9",
        lg: "h-12 px-5 has-[>svg]:px-4.5",
        icon: "size-11 md:size-10",
        "icon-xs": "size-8 [&_svg:not([class*='size-'])]:size-3",
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
