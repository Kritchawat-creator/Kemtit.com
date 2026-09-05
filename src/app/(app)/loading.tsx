import { Skeleton } from "@/components/ui/skeleton";
import { WidgetSkeleton } from "@/components/widgets/WidgetSkeleton";

/** Loading state ของทุกหน้าในแอป — รูปทรงเดียวกับ content (Design §8.6) */
export default function Loading() {
  return (
    <div aria-busy="true">
      <Skeleton className="mb-6 h-8 w-48" />
      <div className="grid gap-4 lg:grid-cols-2">
        <WidgetSkeleton />
        <WidgetSkeleton />
      </div>
    </div>
  );
}
