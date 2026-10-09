import Link from "next/link";

import { Button } from "@/components/ui/button";

import { SECTION_LINKS } from "./content";
import { Container, Logo } from "./layout";
import { NavbarShell } from "./navbar-shell";

export function Navbar({ signedIn }: { signedIn: boolean }) {
  return (
    <NavbarShell>
      <Container className="flex h-full items-center gap-8">
        <Logo />
        <nav aria-label="Primary" className="hidden gap-6 text-sm text-muted-foreground sm:flex">
          {SECTION_LINKS.map(({ href, label }) => (
            <a key={href} href={href} className="transition-colors hover:text-foreground">
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {signedIn ? (
            <Button asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link href="/sign-in">Sign In</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Get Started</Link>
              </Button>
            </>
          )}
        </div>
      </Container>
    </NavbarShell>
  );
}
