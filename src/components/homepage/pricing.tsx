import Link from "next/link";
import { Check, X } from "lucide-react";

import { Container } from "@/components/site/container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { BillingProvider, BillingSwitch, PlanPriceDisplay } from "./billing";
import { PLANS, type Plan } from "./content";
import { SectionHeading } from "./layout";
import { Reveal } from "./reveal";

function PlanCard({ name, description, price, cta, features, highlighted }: Plan) {
  return (
    <article
      className={cn(
        "relative flex h-full flex-col rounded-2xl border bg-card p-6 sm:p-8",
        highlighted
          ? "border-brand/60 bg-[radial-gradient(80%_60%_at_50%_0%,rgb(139_92_246/0.16),transparent_70%)] shadow-2xl shadow-brand/20"
          : "border-border",
      )}
    >
      {highlighted && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 border-0 bg-brand-gradient font-bold text-white">
          Most Popular
        </Badge>
      )}
      <h3 className="text-xl font-semibold">{name}</h3>
      {/* Two lines reserved side by side, so both prices sit at the same height. */}
      <p className="mt-1.5 text-sm text-muted-foreground sm:min-h-10">{description}</p>
      <PlanPriceDisplay price={price} />
      <Button asChild variant={highlighted ? "default" : "outline"} className="w-full">
        <Link href={cta.href}>{cta.label}</Link>
      </Button>
      <ul className="mt-7 grid gap-3 text-[0.93rem]">
        {features.map(({ label, included }) => (
          <li
            key={label}
            className={cn("flex items-start gap-2.5", !included && "text-muted-foreground line-through")}
          >
            {included ? (
              <Check className="mt-1 size-4 shrink-0 text-emerald-500" strokeWidth={3} aria-label="Included" />
            ) : (
              <X className="mt-1 size-4 shrink-0" strokeWidth={3} aria-label="Not included" />
            )}
            {label}
          </li>
        ))}
      </ul>
    </article>
  );
}

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-16 py-18 sm:py-24">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="Pricing"
            title="Start free, upgrade when you need more"
            className="mb-10"
          />
        </Reveal>
        <BillingProvider>
          <Reveal className="mb-10">
            <BillingSwitch />
          </Reveal>
          <div className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-2">
            {PLANS.map((plan, i) => (
              <Reveal key={plan.name} delay={i === 0 ? 0 : 1}>
                <PlanCard {...plan} />
              </Reveal>
            ))}
          </div>
        </BillingProvider>
      </Container>
    </section>
  );
}
