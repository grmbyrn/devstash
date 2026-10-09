import Link from "next/link";

import { Button } from "@/components/ui/button";

import { primaryCta } from "./content";
import { Container } from "./layout";
import { Reveal } from "./reveal";

export function Cta({ signedIn }: { signedIn: boolean }) {
  const cta = primaryCta(signedIn);

  return (
    <section className="py-18 sm:py-24">
      <Container>
        <Reveal className="rounded-3xl border border-border bg-card bg-[radial-gradient(60%_80%_at_50%_0%,rgb(139_92_246/0.22),transparent_70%)] px-5 py-12 text-center sm:px-8 sm:py-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to Organize Your Knowledge?
          </h2>
          <p className="mx-auto mt-3.5 max-w-lg text-lg text-muted-foreground">
            Join developers who stopped losing their best snippets, prompts and commands.
          </p>
          <Button asChild size="lg" className="mt-7">
            <Link href={cta.href}>{cta.label}</Link>
          </Button>
        </Reveal>
      </Container>
    </section>
  );
}
