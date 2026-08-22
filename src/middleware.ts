import { defineMiddleware } from "astro:middleware";
import { auth } from "./lib/auth.js";
import { hasLibraryAccess, isAdmin } from "./lib/entitlements.js";

const BLOCKED_AUTH_PATHS = ["/api/auth/sign-up/email"];

// These routes are prerendered at build time and carry no auth-dependent
// content. Astro warns (and, worse, forces a DB open) when middleware
// touches request headers / session state for a prerendered route, so they
// must never reach the session lookup below.
const STATIC_PUBLIC_PATHS = new Set(["/robots.txt", "/sitemap.xml", "/meta/version.json"]);

export const onRequest = defineMiddleware(async (ctx, next) => {
  const { pathname } = ctx.url;

  if (STATIC_PUBLIC_PATHS.has(pathname)) {
    return next();
  }

  if (BLOCKED_AUTH_PATHS.some((p) => pathname === p)) {
    return new Response(JSON.stringify({ error: "Public sign-up is disabled." }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  const session = await auth.api.getSession({ headers: ctx.request.headers });
  ctx.locals.user = session?.user
    ? { id: session.user.id, email: session.user.email, name: session.user.name, role: session.user.role ?? "user" }
    : null;

  const isApi = pathname.startsWith("/api/");
  const isLibrary = pathname.startsWith("/library") || pathname === "/account";
  const isAdminRoute = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (isAdminRoute) {
    if (!isAdmin(ctx.locals.user)) {
      if (isApi) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
      return ctx.redirect(`/login?next=${encodeURIComponent(pathname)}`);
    }
  } else if (isLibrary) {
    if (!hasLibraryAccess(ctx.locals.user)) {
      if (isApi) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      return ctx.redirect(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }

  const response = await next();
  if (isLibrary || isAdminRoute) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "private, no-store");
  }
  return response;
});
