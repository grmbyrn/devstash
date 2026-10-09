import { Container } from "./container";
import { SECTION_LINKS } from "./links";
import { Logo } from "./logo";
import { NavbarActions } from "./navbar-actions";
import { NavbarShell } from "./navbar-shell";

/** The public site's top nav, shared by the homepage and the auth pages. */
export function Navbar({ signedIn }: { signedIn: boolean }) {
  return (
    <NavbarShell>
      <Container className="flex h-full items-center gap-8">
        <Logo />
        <nav aria-label="Primary" className="hidden gap-6 text-sm text-muted-foreground sm:flex">
          {/* Plain anchors: the browser scrolls to the hash, which Next's client
              navigation doesn't when arriving from another route. */}
          {SECTION_LINKS.map(({ href, label }) => (
            <a key={href} href={href} className="transition-colors hover:text-foreground">
              {label}
            </a>
          ))}
        </nav>
        <NavbarActions signedIn={signedIn} />
      </Container>
    </NavbarShell>
  );
}
