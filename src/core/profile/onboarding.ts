/** รับ string เพื่อใช้กับผล select บางคอลัมน์จาก DB ได้ตรง ๆ — เช็คแค่ว่ามีค่าหรือไม่ */
export type ProfileGate = { active_persona: string | null; onboarding_completed_at: string | null };

export const ROUTES = {
  login: "/login",
  persona: "/onboarding/persona",
  firstGoal: "/onboarding/first-goal",
  dashboard: "/dashboard",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

/**
 * หน้าถัดไปที่ user ควรอยู่ตามสถานะ onboarding (Design §8.3: OTP → persona → goal แรก → dashboard)
 * ใช้ทั้งหลัง verify OTP, ใน (app)/layout และในหน้า onboarding เอง
 */
export function nextRouteFor(profile: ProfileGate | null | undefined): AppRoute {
  if (!profile) return ROUTES.login;
  if (!profile.active_persona) return ROUTES.persona;
  if (!profile.onboarding_completed_at) return ROUTES.firstGoal;
  return ROUTES.dashboard;
}

/** อนุญาต redirect เฉพาะ path ภายในแอป กัน open redirect */
export function safeInternalPath(path: string | null | undefined): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/api/")) return null;
  return path;
}
