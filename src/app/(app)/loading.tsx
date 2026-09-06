import { Skeleton } from "@/components/ui/skeleton";
import { WidgetSkeleton } from "@/components/widgets/WidgetSkeleton";

/** Loading state ของทุกหน้าในแอป — รูปทรงเดียวกับ content (Design §8.6 + Claude Design 3f) */
export default function Loading() {
  return (
    <div aria-busy="true">
      <div className="mb-4 flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="h-7 w-44" />
        </div>
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <WidgetSkeleton variant="hero" />
        <WidgetSkeleton />
      </div>
    </div>
  );
}
