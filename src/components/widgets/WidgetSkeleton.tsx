import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton รูปทรงเดียวกับ widget จริง (Design §8.6) — ไม่ pulse ตลอดเวลา (globals.css ปิด animation เมื่อ reduced-motion) */
export function WidgetSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="rounded-lg border border-border bg-bg-surface p-4 md:p-5" aria-hidden="true">
      <Skeleton className="mb-4 h-6 w-40" />
      <div className="flex items-center gap-5">
        <Skeleton className="size-28 rounded-full" />
        <div className="flex-1 space-y-2">
          {Array.from({ length: rows }, (_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
