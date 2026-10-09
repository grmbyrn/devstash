import { ItemTypeIcon } from "@/components/dashboard/item-type-icon";
import { Container } from "@/components/site/container";
import { systemType } from "@/lib/system-types";

import { FEATURES, type Feature } from "./content";
import { accentStyle, SectionHeading } from "./layout";
import { Reveal } from "./reveal";

function FeatureCard({ title, description, type, Icon }: Feature) {
  const { color, icon } = systemType(type);

  return (
    <article
      style={accentStyle(color)}
      className="relative h-full overflow-hidden rounded-2xl border border-border bg-card p-6 transition duration-200 before:absolute before:inset-x-0 before:top-0 before:h-0.75 before:bg-(--accent) hover:-translate-y-1 hover:border-(--accent)/45 hover:shadow-xl hover:shadow-(--accent)/15 sm:p-7"
    >
      <div className="mb-4.5 grid size-11 place-items-center rounded-xl bg-(--accent)/15 text-(--accent)">
        {Icon ? <Icon className="size-5.5" /> : <ItemTypeIcon name={icon} className="size-5.5" />}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-[0.95rem] text-muted-foreground">{description}</p>
    </article>
  );
}

export function Features() {
  return (
    <section id="features" className="scroll-mt-16 py-18 sm:py-24">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="Features"
            title="Everything you reach for, in one place"
            description="Seven item types, color-coded and searchable, so the thing you need is always a keystroke away."
          />
        </Reveal>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delay={(i % 3) as 0 | 1 | 2}>
              <FeatureCard {...feature} />
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
