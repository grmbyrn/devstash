import { Check, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { WindowDots } from "@/components/ui/editor-chrome";

import { AiTags } from "./ai-tags";
import { AI_CAPABILITIES, AI_TAGS } from "./content";
import { Container } from "./layout";
import { Reveal } from "./reveal";

const keyword = "text-purple-400";
const fn = "text-blue-400";

/** A hand-highlighted sample, so the mockup needs no highlighter on the client. */
function CodeSample() {
  return (
    <pre className="overflow-x-auto px-5 py-4.5 font-mono text-[0.8rem] leading-[1.7] text-zinc-300">
      <code>
        <span className={keyword}>import</span> {"{ useEffect, useState }"}{" "}
        <span className={keyword}>from</span> <span className="text-green-300">&quot;react&quot;</span>;
        {"\n\n"}
        <span className={keyword}>export function</span> <span className={fn}>useDebounce</span>
        {"<T>(value: T, delay = "}
        <span className="text-amber-400">300</span>
        {") {\n  "}
        <span className={keyword}>const</span> {"[debounced, setDebounced] = "}
        <span className={fn}>useState</span>
        {"(value);\n\n  "}
        <span className={fn}>useEffect</span>
        {"(() => {\n    "}
        <span className={keyword}>const</span> {"id = "}
        <span className={fn}>setTimeout</span>
        {"(() => "}
        <span className={fn}>setDebounced</span>
        {"(value), delay);\n    "}
        <span className={keyword}>return</span> {"() => "}
        <span className={fn}>clearTimeout</span>
        {"(id);\n  }, [value, delay]);\n\n  "}
        <span className={keyword}>return</span>
        {" debounced;\n}"}
      </code>
    </pre>
  );
}

export function AiSection() {
  return (
    <section className="border-y border-border bg-card py-18 sm:py-24">
      <Container className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14">
        <Reveal>
          <Badge className="border-brand/35 bg-brand/15 text-brand">
            <Sparkles aria-hidden />
            Pro Feature
          </Badge>
          <h2 className="mt-4.5 text-3xl font-bold tracking-tight sm:text-4xl">
            Let AI do the organizing
          </h2>
          <p className="mt-3.5 text-lg text-muted-foreground">
            Save an item and DevStash handles the busywork, so your hub stays tidy without you
            thinking about it.
          </p>
          <ul className="mt-7 grid gap-3.5">
            {AI_CAPABILITIES.map(({ title, description }) => (
              <li key={title} className="flex gap-3 text-muted-foreground">
                <span className="mt-0.5 grid size-5.5 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-500">
                  <Check className="size-3.5" strokeWidth={3} aria-hidden />
                </span>
                <span>
                  <strong className="font-semibold text-foreground">{title}</strong> — {description}
                </span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal className="overflow-hidden rounded-2xl border border-input bg-background shadow-2xl shadow-black/50">
          <div className="flex items-center gap-3.5 border-b border-border bg-secondary/60 px-3.5 py-2.5">
            <WindowDots />
            <span className="font-mono text-xs text-muted-foreground">useDebounce.ts</span>
          </div>
          <CodeSample />
          <AiTags tags={AI_TAGS} />
        </Reveal>
      </Container>
    </section>
  );
}
