import type { WorkMode } from "@/core/profile/work-modes";

import { MobileNavigationDrawer } from "./MobileNavigationDrawer";
import { NotificationsMenu } from "./NotificationsMenu";
import { QuickAddMenu } from "./QuickAddMenu";
import { UserMenu } from "./UserMenu";

type Props = {
  workMode: WorkMode | null;
  displayName: string | null;
  email: string | null;
  avatarUrl?: string | null;
  overdue: number;
  lineLinked: boolean;
};

/**
 * Prototype-aligned application top bar:
 * command-style Universal Quick Capture on the left, utility actions on the right.
 */
export function TopBar({ workMode, displayName, email, avatarUrl, overdue, lineLinked }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg-surface/95 backdrop-blur">
      <div className="flex min-h-[58px] w-full min-w-0 items-center gap-[5px] px-2 min-[381px]:gap-2 min-[381px]:px-3 min-[761px]:min-h-[66px] min-[761px]:gap-3 min-[761px]:px-6">
        <MobileNavigationDrawer workMode={workMode} />
        <div className="min-w-0 flex-1">
          <QuickAddMenu
            variant="command"
            className="w-full max-w-[600px]"
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden sm:inline-flex">
            <NotificationsMenu overdue={overdue} lineLinked={lineLinked} />
          </span>
          <span className="min-[1151px]:hidden">
            <UserMenu
              displayName={displayName}
              email={email}
              avatarUrl={avatarUrl ?? null}
            />
          </span>
          <span className="hidden min-[1151px]:inline-flex">
            <UserMenu
              variant="chip"
              workMode={workMode}
              displayName={displayName}
              email={email}
              avatarUrl={avatarUrl ?? null}
            />
          </span>
        </div>
      </div>
    </header>
  );
}
