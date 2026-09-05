/**
 * Persona ids และสถานะเปิดใช้ — core รู้แค่ id (ไม่รู้จัก modules/*)
 * POC เปิดเฉพาะ seller (POC Decisions); ที่เหลือแสดงเป็น "เร็ว ๆ นี้" (Q7)
 */
export const PERSONA_IDS = ["seller", "creator", "student", "office"] as const;
export type PersonaId = (typeof PERSONA_IDS)[number];

export const ENABLED_PERSONAS: readonly PersonaId[] = ["seller"];

export function isPersonaEnabled(id: PersonaId): boolean {
  return ENABLED_PERSONAS.includes(id);
}
