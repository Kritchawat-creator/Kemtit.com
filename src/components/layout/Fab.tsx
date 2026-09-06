"use client";

import { usePathname } from "next/navigation";

import { QuickAddMenu } from "./QuickAddMenu";

const HIDDEN_ON = ["/settings"];

/** FAB สีพีช 56px ลอยเหนือ bottom nav 12px (Claude Design 2a) — ซ่อนบนหน้าตั้งค่าที่ไม่มีอะไรให้เพิ่มและปุ่มจะทับสวิตช์ */
export function Fab() {
  const pathname = usePathname();
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;
  return (
    <div className="fixed right-5 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 lg:hidden">
      <QuickAddMenu variant="fab" />
    </div>
  );
}
