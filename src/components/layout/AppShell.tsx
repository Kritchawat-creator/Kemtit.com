import type * as React from "react";

import type { Me } from "@/core/profile/queries";

import { BottomNav } from "./BottomNav";
import { Fab } from "./Fab";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

type Props = { me: Me; children: React.ReactNode };

/**
 * โครงหน้าหลักของแอป (Design §7): มือถือ = top bar + เนื้อหา + bottom nav + FAB · desktop = sidebar + top bar
 * เนื้อหาเว้นที่ด้านล่างให้ bottom nav/FAB (pb-28) และ container กว้างสุด 7xl บน desktop
 */
export function AppShell({ me, children }: Props) {
  return (
    <div className="min-h-dvh bg-bg-page">
      <Sidebar />
      <div className="lg:pl-64">
        <TopBar
          persona={me.profile.active_persona}
          displayName={me.profile.display_name}
          email={me.email}
        />
        <main className="mx-auto w-full max-w-7xl px-4 pt-6 pb-28 lg:px-8 lg:pb-10">
          {children}
        </main>
      </div>
      <BottomNav />
      <Fab />
    </div>
  );
}
