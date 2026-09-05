import { redirect } from "next/navigation";

import { ROUTES } from "@/core/profile/onboarding";

/** หน้าแรก = แดชบอร์ด (proxy.ts จะพาไป /login ถ้ายังไม่เข้าสู่ระบบ) */
export default function HomePage() {
  redirect(ROUTES.dashboard);
}
