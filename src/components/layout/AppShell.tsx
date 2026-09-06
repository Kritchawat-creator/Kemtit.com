import type * as React from "react";

import type { Me } from "@/core/profile/queries";

import { BottomNav } from "./BottomNav";
import { Fab } from "./Fab";
import { ShellFrame } from "./ShellFrame";
import { TopBar } from "./TopBar";

type Props = { me: Me; children: React.ReactNode };

/**
 * โครงหน้าหลักของแอป (Design §7 + Claude Design 2a/turn 4)
 * มือถือ = แถว persona/avatar + เนื้อหาบนพื้น brand-50 + bottom nav มน + FAB พีช
 * desktop = sidebar พับได้ (ShellFrame) + persona/avatar ลอยมุมขวาบน + เนื้อหากว้างสุด 1200px กึ่งกลาง
 */
export function AppShell({ me, children }: Props) {
  return (
    <ShellFrame>
      <TopBar
        persona={me.profile.active_persona}
        displayName={me.profile.display_name}
        email={me.email}
        avatarUrl={me.avatarUrl}
      />
      <main className="mx-auto w-full max-w-[1200px] px-5 pt-3 pb-32 lg:px-8 lg:pt-0 lg:pb-10">
        {children}
      </main>
      <BottomNav />
      <Fab />
    </ShellFrame>
  );
}
