import { Store } from "lucide-react";

import type { PersonaId } from "@/core/profile/personas";

/**
 * Seller persona — POC มีเฉพาะ metadata + template (ไม่มี widget/ตารางเฉพาะ ตาม POC Decisions 3)
 * ชื่อ/คำอธิบายอยู่ใน th.json ใต้ personas.seller
 */
export const sellerPersona = {
  id: "seller" as const satisfies PersonaId,
  icon: Store,
};
