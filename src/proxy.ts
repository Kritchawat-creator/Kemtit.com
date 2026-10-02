import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getClientEnv } from "@/lib/env";
import { authFailureContext, isUnauthenticatedAuthError } from "@/core/auth/session-errors";

/**
 * Next 16 proxy (แทน middleware): refresh session cookie ของ Supabase ทุก request
 * และกันคนที่ยังไม่ login ออกจากหน้าในแอป — การ gate onboarding อยู่ที่ (app)/layout.tsx
 */
const PUBLIC_PATHS = new Set(["/login", "/auth/callback"]);

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

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet)
            response.cookies.set(name, value, options);
        },
      },
    },
  );

  const { pathname } = request.nextUrl;

  // ห้ามมีโค้ดระหว่าง createServerClient กับ getClaims — ตามคำแนะนำของ @supabase/ssr
  let isAuthenticated = false;
  try {
    const result = await supabase.auth.getClaims();
    if (result.error) {
      if (isUnauthenticatedAuthError(result.error)) {
        isAuthenticated = false;
      } else {
        console.error("[auth] proxy claim check failed", authFailureContext(result.error));
        // A protected page's server-side getMe() still verifies the user with Auth.
        // Let that authoritative check render the safe recovery UI during outages.
        return response;
      }
    } else {
      isAuthenticated = Boolean(result.data?.claims);
    }
  } catch (error) {
    if (isUnauthenticatedAuthError(error)) {
      isAuthenticated = false;
    } else {
      console.error("[auth] proxy claim check failed", authFailureContext(error));
      // Avoid treating a transient Auth/JWKS outage as a sign-out. App routes
      // remain guarded by getMe() and database RLS.
      return response;
    }
  }
  if (!isAuthenticated && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    return NextResponse.redirect(url);
  }

  if (isAuthenticated && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/today";
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
