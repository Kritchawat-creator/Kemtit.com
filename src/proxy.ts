import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getClientEnv } from "@/lib/env";

/**
 * Next 16 proxy (แทน middleware): refresh session cookie ของ Supabase ทุก request
 * และกันคนที่ยังไม่ login ออกจากหน้าในแอป — การ gate onboarding อยู่ที่ (app)/layout.tsx
 */
const PUBLIC_PATHS = new Set(["/login"]);

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/api/") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js"
  );
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = getClientEnv();

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // ห้ามมีโค้ดระหว่าง createServerClient กับ getClaims — ตามคำแนะนำของ @supabase/ssr
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims);
  const { pathname } = request.nextUrl;

  if (!isAuthenticated && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    return NextResponse.redirect(url);
  }

  if (isAuthenticated && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // ทุกหน้า ยกเว้น asset ของ Next และไฟล์ static
    "/((?!_next/static|_next/image|icon\\.svg|favicon\\.ico|icons/|.*\\.(?:png|svg|jpg|jpeg|webp|ico|woff2?)$).*)",
  ],
};
