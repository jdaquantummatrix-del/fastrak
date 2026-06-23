import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession, getSessionSecret } from "@/lib/auth";

// S12 Auth gate. Runs on the Edge runtime before every matched request and
// redirects anyone without a valid session cookie to /login. The session
// helper is Web-Crypto based precisely so it can run here (the Edge runtime has
// no Node `crypto`). See docs/adr/0004-auth-model.md for the eventual model.
//
// Allowed through WITHOUT a session:
//   - /login (and its Server Action POST) — otherwise you could never log in
//   - /favicon.ico and other static files (handled by the matcher below)
// Everything else requires a valid signed cookie.

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always let the login route through, or the user could never authenticate.
  if (pathname === "/login") return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value ?? "";
  const session = await verifySession(token, getSessionSecret());
  if (session) {
    // Forward the path so the root layout can enforce per-module access (the
    // layout can't see the URL otherwise). Only set for authenticated requests.
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-pathname", pathname);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Not authenticated -> send to /login, remembering where they were headed so
  // we can return them there after a successful sign-in.
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

// Run on all paths EXCEPT Next internals and static assets, so unauthenticated
// users still get CSS/JS/images (and so the login page can render its styles).
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2)$).*)"
  ]
};
