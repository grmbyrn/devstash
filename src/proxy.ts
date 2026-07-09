import { auth } from "@/auth";

/**
 * Route protection for the dashboard. Unauthenticated requests are redirected
 * to NextAuth's default sign-in page (no custom `pages.signIn` is configured).
 */
export const proxy = auth((req) => {
  if (!req.auth) {
    const signInUrl = new URL("/api/auth/signin", req.nextUrl.origin);
    return Response.redirect(signInUrl);
  }
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
