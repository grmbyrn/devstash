import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ItemTypeIcon } from "@/components/dashboard/item-type-icon";
import { Button } from "@/components/ui/button";
import { typeLabel } from "@/lib/item-types";
import { SYSTEM_TYPES, systemType } from "@/lib/system-types";

import { ChaosField } from "./chaos-field";
import { PREVIEW_ITEMS, primaryCta } from "./content";
import { accentStyle, Container } from "./layout";
import { Reveal } from "./reveal";

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <figure className="m-0 rounded-2xl border border-border bg-linear-to-b from-secondary/60 to-card p-3.5 shadow-2xl shadow-black/40">
      <figcaption className="mx-1 mt-0.5 mb-3 text-sm font-semibold text-muted-foreground">
        {label}
      </figcaption>
      {children}
    </figure>
  );
}

function TransformArrow() {
  return (
    <div aria-hidden className="grid place-items-center max-md:rotate-90">
      <div className="grid size-14 place-items-center rounded-full bg-brand-gradient text-white motion-safe:animate-arrow-pulse">
        <ArrowRight className="size-6" />
      </div>
    </div>
  );
}

/** A miniature of the real dashboard: type sidebar plus accent-bordered cards. */
function DashboardPreview() {
  return (
    <div
      aria-hidden
      className="grid h-70 grid-cols-[100px_minmax(0,1fr)] overflow-hidden rounded-lg border border-border bg-background text-[0.72rem] sm:grid-cols-[112px_minmax(0,1fr)] md:h-80"
    >
      <aside className="border-r border-border bg-card px-2 py-3">
        <p className="flex items-center gap-1.5 px-1.5 pb-3 font-bold">
          <span className="size-2.5 rounded-[3px] bg-brand-gradient" />
          DevStash
        </p>
        <ul className="grid gap-0.5">
          {SYSTEM_TYPES.map((type, i) => (
            <li
              key={type.name}
              className={
                i === 0
                  ? "flex items-center gap-1.5 rounded-md bg-secondary px-1.5 py-1 text-foreground"
                  : "flex items-center gap-1.5 rounded-md px-1.5 py-1 text-muted-foreground"
              }
            >
              <span style={{ color: type.color }}>
                <ItemTypeIcon name={type.icon} className="size-3" />
              </span>
              {typeLabel(type.name)}
            </li>
          ))}
        </ul>
      </aside>
      <div className="min-w-0 p-3">
        <p className="mb-3 flex h-6.5 items-center gap-1.5 rounded-md border border-border bg-card px-2 text-muted-foreground">
          <span className="size-2 rounded-full border-[1.5px] border-muted-foreground" />
          Search everything…
        </p>
        <div className="grid grid-cols-2 gap-2">
          {PREVIEW_ITEMS.map(({ title, type }) => (
            <div
              key={title}
              style={accentStyle(systemType(type).color)}
              className="grid gap-1.5 rounded-lg border border-border border-t-[3px] border-t-(--accent) bg-card p-2.5 transition-transform hover:-translate-y-0.5"
            >
              <b className="truncate font-semibold">{title}</b>
              <i className="h-1 rounded-sm bg-secondary" />
              <i className="h-1 w-3/5 rounded-sm bg-secondary" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Hero({ signedIn }: { signedIn: boolean }) {
  const cta = primaryCta(signedIn);

  return (
    <section className="relative overflow-hidden pt-[calc(4rem+3rem)] pb-16 sm:pt-[calc(4rem+4.5rem)] sm:pb-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[-10%] top-[-20%] h-155 bg-[radial-gradient(40%_50%_at_30%_30%,rgb(59_130_246/0.16),transparent_70%),radial-gradient(35%_45%_at_72%_25%,rgb(236_72_153/0.12),transparent_70%)]"
      />
      <Container className="relative">
        <div className="mx-auto mb-11 max-w-3xl text-center sm:mb-16">
          <h1 className="text-[clamp(2.4rem,6vw,4.25rem)] leading-[1.1] font-extrabold tracking-tighter">
            Stop Losing Your
            <br />
            <span className="bg-brand-gradient bg-clip-text text-transparent">Developer Knowledge</span>
          </h1>
          <p className="mx-auto mt-5.5 max-w-xl text-lg text-muted-foreground">
            Your snippets live in VS Code, your prompts in chat history, your commands in a{" "}
            <code className="rounded bg-secondary px-1.5 font-mono text-foreground">.txt</code> file
            and your links in a hundred browser tabs. DevStash brings them together in one fast,
            searchable, AI-enhanced hub.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href={cta.href}>{cta.label}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#features">See Features</a>
            </Button>
          </div>
        </div>

        <Reveal className="grid items-center gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-6">
          <Panel label="Your knowledge today...">
            <ChaosField />
          </Panel>
          <TransformArrow />
          <Panel label="...with DevStash">
            <DashboardPreview />
          </Panel>
        </Reveal>
      </Container>
    </section>
  );
}
