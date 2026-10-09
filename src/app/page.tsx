import type { Metadata } from "next";

import { auth } from "@/auth";
import { AiSection } from "@/components/homepage/ai-section";
import { Cta } from "@/components/homepage/cta";
import { Features } from "@/components/homepage/features";
import { Footer } from "@/components/homepage/footer";
import { Hero } from "@/components/homepage/hero";
import { Navbar } from "@/components/homepage/navbar";
import { Pricing } from "@/components/homepage/pricing";

export const metadata: Metadata = {
  title: "DevStash — Your Developer Knowledge Hub",
  description:
    "One fast, searchable, AI-enhanced hub for your snippets, prompts, commands, notes, files, images and links.",
};

export default async function HomePage() {
  // Read once here; every link that depends on it takes the flag as a prop.
  const session = await auth();
  const signedIn = Boolean(session?.user);

  return (
    <div data-page="home" className="flex flex-1 flex-col overflow-x-clip">
      <Navbar signedIn={signedIn} />
      <main className="flex-1">
        <Hero signedIn={signedIn} />
        <Features />
        <AiSection />
        <Pricing />
        <Cta signedIn={signedIn} />
      </main>
      <Footer signedIn={signedIn} />
    </div>
  );
}
