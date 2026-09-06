"use client";

import { usePathname } from "next/navigation";

import { QuickAddMenu } from "./QuickAddMenu";

const HIDDEN_ON = ["/settings"];

/** FAB มือถือ ลอยเหนือ bottom nav (Design §8.1) — ซ่อนบนหน้าตั้งค่าที่ไม่มีอะไรให้เพิ่มและปุ่มจะทับสวิตช์ด้านขวา */
export function Fab() {
  const pathname = usePathname();
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;
  return (
    <div className="fixed right-4 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 lg:hidden">
      <QuickAddMenu variant="fab" />
    </div>
  );
}
