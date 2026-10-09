import Link from "next/link";

import { Container } from "@/components/site/container";
import { Logo } from "@/components/site/logo";

import { footerColumns } from "./content";

export function Footer({ signedIn }: { signedIn: boolean }) {
  return (
    <footer className="border-t border-border bg-card pt-14 pb-8">
      <Container className="flex flex-wrap justify-between gap-12">
        <div>
          <Logo />
          <p className="mt-3 text-sm text-muted-foreground">One hub for all your dev knowledge.</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-16 gap-y-8">
          {footerColumns(signedIn).map(({ title, links }) => (
            <div key={title}>
              <h2 className="mb-3.5 text-sm font-semibold">{title}</h2>
              <ul className="grid gap-2 text-sm text-muted-foreground">
                {links.map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className="transition-colors hover:text-foreground">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </Container>
      <Container className="mt-12">
        <p className="border-t border-border pt-6 text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} DevStash. All rights reserved.
        </p>
      </Container>
    </footer>
  );
}
