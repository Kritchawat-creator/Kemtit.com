import type * as React from "react";

import { getDayPlan } from "@/core/tasks/queries";
import type { Me } from "@/core/profile/queries";
import { todayBkk } from "@/lib/date";

import { BottomNav } from "./BottomNav";
import { Fab } from "./Fab";
import { ShellFrame } from "./ShellFrame";
import { TopBar } from "./TopBar";

type Props = { me: Me; children: React.ReactNode };

/**
 * โครงหน้าหลักของแอป (Design §7 + Claude Design 2a/turn 4/7)
 * มือถือ = แถว persona/avatar + เนื้อหาบนพื้น brand-50 + bottom nav มน + FAB พีช
 * desktop = sidebar 2 กลุ่ม + การ์ด Pro (ShellFrame) + top bar ค้นหา/แจ้งเตือน/user chip + เนื้อหากว้างสุด 1200px กึ่งกลาง
 * คำนวณ "shell data" (งานค้าง/เชื่อม LINE แล้วหรือยัง/แพ็กเกจ) จุดเดียวที่นี่ผ่าน getDayPlan ที่ cache() ไว้แล้ว (§2.9)
 * แล้วส่งต่อให้ Sidebar/TopBar (§3.2) — getDayPlan(today) จึงถูกเรียกซ้ำในหน้าเดิม (เช่น dashboard) แต่ cache()
 * dedupe ให้เหลือ query เดียวต่อ request
 */
export async function AppShell({ me, children }: Props) {
  const today = todayBkk();
  const plan = await getDayPlan(today);
  const openTasks = plan.overdue.length + plan.due.length;
  const overdue = plan.overdue.length;
  const lineLinked = Boolean(me.profile.line_user_id);
  const tier = me.profile.subscription_tier;

  return (
    <ShellFrame
      shell={{ openTasks, tier }}
      profile={{
        displayName: me.profile.display_name,
        email: me.email,
        persona: me.profile.active_persona,
        avatarUrl: me.avatarUrl,
      }}
    >
      <TopBar
        persona={me.profile.active_persona}
        displayName={me.profile.display_name}
        email={me.email}
        avatarUrl={me.avatarUrl}
        overdue={overdue}
        lineLinked={lineLinked}
      />
      <main className="mx-auto w-full max-w-[1200px] px-5 pt-3 pb-32 lg:px-8 lg:pt-0 lg:pb-10">
        {children}
      </main>
      <BottomNav />
      <Fab />
    </ShellFrame>
  );
}
