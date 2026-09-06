"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";

import { signOut } from "@/core/auth/actions";
import { avatarLetter } from "@/lib/format";
import { LetterAvatar } from "@/components/domain/AvatarSlot";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = { displayName: string | null; email: string | null; avatarUrl?: string | null };

/**
 * avatar 40px ขอบขาว + เงา: ตัวอักษรแรกของชื่อบน brand-100/brand-800 (Design §6A) — รูปโปรไฟล์เมื่ออัปโหลด (MVP, flag uploads)
 * → เมนูผู้ใช้ (ออกจากระบบ)
 */
export function UserMenu({ displayName, email, avatarUrl }: Props) {
  const t = useTranslations();
  const label = displayName?.trim() || email || "";
  const letter = avatarLetter(displayName, email);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("a11y.userMenu")}
          className="size-10 rounded-full p-0 hover:bg-transparent"
        >
          {avatarUrl ? (
            <Avatar className="size-10 border-2 border-neutral-0 shadow-sm">
              <AvatarImage src={avatarUrl} alt="" className="object-cover" />
              <AvatarFallback className="bg-brand-100 text-base font-semibold text-brand-800">
                {letter}
              </AvatarFallback>
            </Avatar>
          ) : (
            <LetterAvatar letter={letter} className="size-10 border-2 border-neutral-0 shadow-sm" />
          )}
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
