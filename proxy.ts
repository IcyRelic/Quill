import { NextResponse, type NextRequest } from "next/server";

/**
 * Tells admin screens which address was asked for, so signing in can return there (for example to an app's
 * approval screen, /admin/connect?code=...). Layouts can't read the URL themselves.
 */
export function proxy(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-quill-path", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: "/admin/:path*" };
