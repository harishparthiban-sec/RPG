import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/dashboard", "/character", "/shop", "/settings"];
const AUTH_PAGES = ["/login", "/signup"];

function hasLocalSession(request: NextRequest): boolean {
  const token = request.cookies.get("liferpg_session")?.value;
  return Boolean(token && token.length > 20);
}

function supabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return (
    url.startsWith("https://") &&
    !url.includes("placeholder") &&
    key.length > 40
  );
}

// Guards /app routes. In Supabase mode it also refreshes auth cookies;
// in local mode it checks the app's own session cookie.
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));

  let authed: boolean;

  if (supabaseConfigured()) {
    const { createServerClient } = await import("@supabase/ssr");
    let response = NextResponse.next({ request });
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    authed = Boolean(user);

    if (isProtected && !authed) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    if (AUTH_PAGES.includes(pathname) && authed) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return response;
  }

  // ── Local mode: cookie-presence check (deep verification happens in APIs). ──
  authed = hasLocalSession(request);

  if (isProtected && !authed) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (AUTH_PAGES.includes(pathname) && authed) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/character/:path*",
    "/shop/:path*",
    "/settings/:path*",
    "/login",
    "/signup",
  ],
};
