"use client";

import { ChevronDown, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";

import { signOut } from "@/core/auth/actions";
import type { WorkMode } from "@/core/profile/work-modes";
import { avatarLetter } from "@/lib/format";
import { LetterAvatar } from "@/components/domain/AvatarSlot";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
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

type Props = {
  displayName: string | null;
  email: string | null;
  avatarUrl?: string | null;
  /** เฉพาะ variant "chip" — โชว์ WorkMode ต่อท้ายชื่อในแถบ */
  workMode?: WorkMode | null;
  /** avatar = ปุ่มวงกลม 40px · chip = แถบมีชื่อ+WorkMode บน desktop */
  variant?: "avatar" | "chip";
};

export function UserMenu({ displayName, email, avatarUrl, workMode, variant = "avatar" }: Props) {
  const t = useTranslations();
  const label = displayName?.trim() || email || "";
  const letter = avatarLetter(displayName, email);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "chip" ? (
          <button
            type="button"
            aria-label={t("a11y.userMenu")}
            className="flex h-11 items-center gap-2.5 rounded-lg border border-border bg-bg-surface py-1 pr-3.5 pl-1 shadow-xs transition-colors hover:bg-bg-subtle"
          >
            {avatarUrl ? (
              <Avatar className="size-9 shrink-0 border-2 border-neutral-0 shadow-sm">
                <AvatarImage src={avatarUrl} alt="" className="object-cover" />
                <AvatarFallback className="bg-brand-100 text-small font-semibold text-brand-800">
                  {letter}
                </AvatarFallback>
              </Avatar>
            ) : (
              <LetterAvatar
                letter={letter}
                className="size-9 shrink-0 border-2 border-neutral-0 shadow-sm"
              />
            )}
            <span className="max-w-40 min-w-0 text-left">
              <span className="block truncate text-small font-semibold text-text-primary">
                {label}
              </span>
              {workMode ? (
                <span className="block truncate text-caption font-medium text-accent-900">
                  {t(`workModes.${workMode}`)}
                </span>
              ) : null}
            </span>
            <ChevronDown
              className="size-4 shrink-0 text-text-secondary"
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </button>
        ) : (
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
              <LetterAvatar
                letter={letter}
                className="size-10 border-2 border-neutral-0 shadow-sm"
              />
            )}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-56">
        <DropdownMenuLabel className="truncate text-small font-normal text-text-secondary">
          {label}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <p className="mb-1.5 text-caption font-medium text-text-secondary">
            {t("settings.language.label")}
          </p>
          <LanguageSwitcher compact />
        </div>
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