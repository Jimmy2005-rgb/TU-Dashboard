import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, expectedSessionToken, isAuthEnabled } from "@/lib/auth";

/**
 * Password-gates every page and API route when APP_PASSWORD is set.
 * The webhook route is excluded: it authenticates with WEBHOOK_SECRET instead.
 */
export async function middleware(req: NextRequest) {
  if (!isAuthEnabled()) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token && token === (await expectedSessionToken())) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|login|api/auth|api/webhooks).*)"],
};
