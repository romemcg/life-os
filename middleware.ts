import { NextResponse, type NextRequest } from "next/server";

// Optional passcode. Set LIFEOS_PASSCODE to require HTTP Basic auth (any username).
export function middleware(req: NextRequest) {
  const pass = process.env.LIFEOS_PASSCODE;
  if (!pass) return NextResponse.next();
  const h = req.headers.get("authorization") || "";
  if (h.startsWith("Basic ")) {
    try {
      const [, pw] = atob(h.slice(6)).split(":");
      if (pw === pass) return NextResponse.next();
    } catch {}
  }
  return new NextResponse("Authentication required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="LIFE OS"' } });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
