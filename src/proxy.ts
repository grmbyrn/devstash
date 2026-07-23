import { auth } from "@/auth";

/**
 * Route protection for the dashboard. Unauthenticated requests are redirected
 * to the custom sign-in page (`pages.signIn` in `auth.config.ts`), carrying the
 * original path as `callbackUrl` so sign-in can return the user there.
 */
export const proxy = auth((req) => {
  if (!req.auth) {
    const signInUrl = new URL("/sign-in", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return Response.redirect(signInUrl);
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/profile/:path*"],
};
