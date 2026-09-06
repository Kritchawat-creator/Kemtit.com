import { Skeleton } from "@/components/ui/skeleton";

type Props = { rows?: number; variant?: "hero" | "list" };

/**
 * Skeleton รูปทรงเดียวกับ widget จริง (Design §8.6 + Claude Design 3f): hero = การ์ดจาง + วงกลมหน้าปัด · list = การ์ดขาว + แถวงาน
 * ไม่ pulse ตลอดเวลา (globals.css ปิด animation เมื่อ reduced-motion)
 */
export function WidgetSkeleton({ rows = 4, variant = "list" }: Props) {
  if (variant === "hero") {
    return (
      <div className="rounded-2xl bg-bg-subtle p-5" aria-hidden="true">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="flex justify-center py-3">
          <Skeleton className="size-[196px] rounded-full" />
        </div>
        <div className="flex items-end justify-between">
          <div className="space-y-2">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <Skeleton className="h-7 w-24" />
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl bg-bg-surface px-5 pt-4 pb-2 shadow-md" aria-hidden="true">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="mt-2 divide-y divide-border">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex min-h-14 items-center gap-3">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-4 w-40" />
            <span className="flex-1" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
