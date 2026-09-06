import { cn } from "cn";

/** Skeleton สี neutral-200 มุม 10px (Claude Design 3f/3j) — ต้องเห็นบนพื้น brand-50 และการ์ดขาว */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-sm bg-neutral-200", className)}
      {...props}
    />
  );
}

export { Skeleton };
