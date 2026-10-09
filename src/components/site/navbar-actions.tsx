"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";

/**
 * The nav's account buttons. Client-side only to read the path, so a button
 * pointing at the page you're already on is left out.
 */
export function NavbarActions({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const showSignIn = pathname !== "/sign-in";
  const showGetStarted = pathname !== "/register";

  return (
    <div className="ml-auto flex items-center gap-2">
      {signedIn ? (
        <Button asChild>
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      ) : (
        <>
          {showSignIn && (
            // Narrow screens keep one button, so Sign In yields to Get Started.
            <Button asChild variant="ghost" className={showGetStarted ? "hidden sm:inline-flex" : undefined}>
              <Link href="/sign-in">Sign In</Link>
            </Button>
          )}
          {showGetStarted && (
            <Button asChild>
              <Link href="/register">Get Started</Link>
            </Button>
          )}
        </>
      )}
    </div>
  );
}
