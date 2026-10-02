import type * as React from "react";

import { getDayPlan } from "@/core/tasks/queries";
import type { Me } from "@/core/profile/queries";
import { workModeFromProfile } from "@/core/profile/work-modes";
import { todayBkk } from "@/lib/date";

import { BottomNav } from "./BottomNav";
import { ShellFrame } from "./ShellFrame";
import { TopBar } from "./TopBar";

type Props = { me: Me; children: React.ReactNode };

/**
 * Prototype-aligned application shell.
 * Desktop uses the 268px grouped sidebar + command topbar.
 * Tablet/mobile hide the sidebar and use the navigation drawer; mobile also keeps
 * the floating Today / Plan / Capture / Insights / More execution dock.
 * Shell data is calculated once here and reused by navigation utilities.
 */
export async function AppShell({ me, children }: Props) {
  const today = todayBkk();
  const plan = await getDayPlan(today);
  const openTasks = plan.overdue.length + plan.due.length;
  const overdue = plan.overdue.length;
  const lineLinked = Boolean(me.profile.line_user_id);
  const tier = me.profile.subscription_tier;
  const workMode = workModeFromProfile(me.profile.work_mode, me.profile.active_persona);

  return (
    <ShellFrame
      shell={{ openTasks, tier }}
      profile={{
        displayName: me.profile.display_name,
        email: me.email,
        workMode,
        avatarUrl: me.avatarUrl,
      }}
    >
      <TopBar
        workMode={workMode}
        displayName={me.profile.display_name}
        email={me.email}
        avatarUrl={me.avatarUrl}
        overdue={overdue}
        lineLinked={lineLinked}
      />
      <main className="w-full min-w-0 px-3 pt-3 pb-32 min-[381px]:px-4 min-[381px]:pt-4 min-[761px]:px-6 min-[761px]:pt-6 md:pb-10">
        {children}
      </main>
      <BottomNav workMode={workMode} />
    </ShellFrame>
  );
}
