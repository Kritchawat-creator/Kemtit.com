"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";

import { signOut } from "@/core/auth/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = { displayName: string | null; email: string | null };

/** avatar พีช 40px ขอบขาว + เงา (Claude Design 2a) → เมนูผู้ใช้ (ออกจากระบบ) */
export function UserMenu({ displayName, email }: Props) {
  const t = useTranslations();
  const label = displayName?.trim() || email || "";
  const initial = (label[0] ?? "?").toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("a11y.userMenu")}
          className="size-10 rounded-full p-0 hover:bg-transparent"
        >
          <Avatar className="size-10 border-2 border-neutral-0 shadow-sm">
            <AvatarFallback className="bg-accent-100 text-base font-semibold text-accent-900">
              {initial}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-56">
        <DropdownMenuLabel className="truncate text-small font-normal text-text-secondary">
          {label}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <form action={signOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut aria-hidden="true" />
              {t("common.signOut")}
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
