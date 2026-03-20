import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_STEWARD_ROUTES = new Set(["/stewards/login"]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/stewards")) return NextResponse.next();
  if (PUBLIC_STEWARD_ROUTES.has(pathname)) return NextResponse.next();

  const token = request.cookies.get("steward_session")?.value;
  if (token) return NextResponse.next();

  const loginUrl = new URL("/stewards/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/stewards/:path*"],
};
