import { QuickAddMenu } from "./QuickAddMenu";

/** FAB มือถือ ลอยเหนือ bottom nav (Design §8.1) */
export function Fab() {
  return (
    <div className="fixed right-4 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 lg:hidden">
      <QuickAddMenu variant="fab" />
    </div>
  );
}
