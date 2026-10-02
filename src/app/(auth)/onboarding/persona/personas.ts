import { Briefcase, GraduationCap, Laptop, type LucideIcon } from "lucide-react";

import { ROLE_CODES, type RoleCode } from "@/core/profile/roles";
import type { WorkMode } from "@/core/profile/work-modes";
import { sellerPersona } from "@/modules/seller/persona";

export type RoleOption = { id: RoleCode; icon: LucideIcon };

const ROLE_ICONS: Record<RoleCode, LucideIcon> = {
  employee: Briefcase,
  seller: sellerPersona.icon,
  student: GraduationCap,
  freelancer: Laptop,
};

export const ROLE_OPTIONS: RoleOption[] = ROLE_CODES.map((id) => ({
  id,
  icon: ROLE_ICONS[id],
}));

/** Legacy export kept until remaining V2 work-mode settings are migrated. */
export type WorkModeOption = { id: WorkMode; icon: LucideIcon };
export const WORK_MODE_OPTIONS: WorkModeOption[] = [
  { id: "seller", icon: sellerPersona.icon },
  { id: "professional", icon: Briefcase },
];
