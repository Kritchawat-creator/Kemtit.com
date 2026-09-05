import { Briefcase, Clapperboard, GraduationCap, type LucideIcon } from "lucide-react";

import { isPersonaEnabled, PERSONA_IDS, type PersonaId } from "@/core/profile/personas";
import { sellerPersona } from "@/modules/seller/persona";

/**
 * Composition root ของ persona (app/ เป็นชั้นเดียวที่ import ทั้ง core และ modules)
 * persona ที่ยังไม่มี module ใช้ icon placeholder และแสดง "เร็ว ๆ นี้"
 */
export type PersonaOption = { id: PersonaId; icon: LucideIcon; enabled: boolean };

const ICONS: Record<PersonaId, LucideIcon> = {
  seller: sellerPersona.icon,
  creator: Clapperboard,
  student: GraduationCap,
  office: Briefcase,
};

export const PERSONA_OPTIONS: PersonaOption[] = PERSONA_IDS.map((id) => ({
  id,
  icon: ICONS[id],
  enabled: isPersonaEnabled(id),
}));
