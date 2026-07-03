import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

/**
 * Next 16 edge middleware (Phase 9b). Composes two disjoint concerns:
 *  1. Steward auth for /stewards/* (unprefixed — cookie gate, unchanged).
 *  2. next-intl locale routing for the public site (he at "/", en at "/en/*").
 * API and RSS routes are excluded by the matcher below.
 */
const intlMiddleware = createMiddleware(routing);

const PUBLIC_STEWARD_ROUTES = new Set(["/stewards/login"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Steward portal stays unprefixed and is NOT locale-routed.
  if (pathname === "/stewards" || pathname.startsWith("/stewards/")) {
    if (PUBLIC_STEWARD_ROUTES.has(pathname)) return NextResponse.next();
    const token = request.cookies.get("steward_session")?.value;
    if (token) return NextResponse.next();
    const loginUrl = new URL("/stewards/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Everything else the matcher lets through is public → locale routing.
  return intlMiddleware(request);
}

export const config = {
  // Run on app routes; skip API, RSS, Next internals, and any file with an
  // extension (e.g. /news/rss.xml, images, favicons) so those stay unprefixed.
  matcher: ["/((?!api|rss|_next|_vercel|.*\\..*).*)"],
};
