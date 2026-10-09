# Homepage

## Overview

Turn the static mockup in `prototypes/homepage/` into the real marketing homepage at `/`, replacing the placeholder `src/app/page.tsx`. Keep the mockup's layout, sections, copy and animations, rebuilt with the app's stack: Next.js server components, Tailwind v4 and shadcn/ui.

## Requirements

- Build the page at `src/app/page.tsx` as a **server component** with page `metadata`. Port every mockup section: navbar, hero text, chaos → arrow → dashboard preview, features, AI section, pricing, CTA and footer.
- Split each section into its own component under `src/components/homepage/`. Sections are server components by default. Only the interactive pieces are `"use client"` islands:
  - `ChaosField`: the `requestAnimationFrame` icon animation (drift, wall bounce, rotation/scale pulse, cursor repel, including the wall-aware repel fix), paused while offscreen.
  - `NavbarShell`: becomes more opaque on scroll. It wraps server-rendered nav content.
  - `Reveal`: fades children in on scroll via IntersectionObserver. It wraps server-rendered content, so sections stay server components.
  - `AiTags`: tags appear one by one when scrolled into view.
  - `PricingToggle`: monthly ↔ yearly ($8/month ↔ $72/year). It owns only the billing state and the Pro price. Plan details stay server-rendered.
- Style everything with **Tailwind utilities and the existing theme tokens** in `src/app/globals.css` (`bg-background`, `bg-card`, `border-border`, `text-muted-foreground`, …). Add the gradient and keyframes (arrow pulse, reveal) via `@theme` in `globals.css`. Do not copy `styles.css`, and add no `tailwind.config.*`.
- Use shadcn/ui where it fits: `Button` (with `asChild` around `Link`) for every CTA and `Badge` for "Pro Feature", "Most Popular" and "Save 25%". Use lucide-react for non-brand icons. Brand icons (Notion, Slack, VS Code) become small inline SVG components; reuse the existing `src/components/auth/github-icon.tsx` for GitHub.
- Keep it DRY. Repeated content (feature cards, pricing plans and their feature lists, footer link columns, dashboard-preview items, chaos icons) lives in typed arrays in one content module and is rendered with `.map()`. Don't hand-write repeated JSX blocks.
- Use the **app's item type colors and icons**, not the mockup's palette (the mockup's Prompt amber, Command cyan, Note green and Link indigo differ from the app). Move the system type definitions (`name`, `icon`, `color`) out of `prisma/seed.ts` into a shared constant in `src/lib/`. Have both the seed and the homepage import it, and render type icons with the existing `ItemTypeIcon`.
- Preserve the mockup's accessibility behaviour:
  - `prefers-reduced-motion` gives a static scatter, no pulse and no fades.
  - Content stays visible before hydration / without JS.
  - The pricing toggle is a `role="switch"` with `aria-checked`.
- Responsive as in the mockup: on mobile the hero stacks vertically, the arrow rotates 90° to point down, and grids drop to one column. No horizontal overflow at 390px.
- The copyright year is computed on the server.

## Links & Buttons

| Element | Destination |
| --- | --- |
| Logo | `/` |
| Nav "Features" / "Pricing", footer equivalents | `#features` / `#pricing` (smooth scroll, offset for the fixed nav) |
| Nav "Sign In" | `/sign-in` |
| "Get Started", "Get Started Free", Free plan button, CTA button | `/register` |
| "Upgrade to Pro" | `/register` (no Stripe yet) |
| Signed-in user | Navbar shows a single "Dashboard" button → `/dashboard` in place of Sign In / Get Started, and hero/CTA buttons go to `/dashboard` |

- Read the session with `auth()` in the page and pass the signed-in flag down. Don't call it in multiple components.
- Drop footer links with no destination (Changelog, Documentation, Blog, Support, About, Privacy, Terms) rather than linking to `#`. Keep only Features and Pricing until those pages exist.

## Notes

- `/` stays outside the `(dashboard)` and `(auth)` groups and outside the `src/proxy.ts` matcher, since it's public.
- The page renders dynamically because it reads the session. That is expected.
- No database queries on this page. All content is static.
- Components are out of unit-test scope. Unit-test the shared item-type constant only if it gains logic, and confirm the seed still produces the same 7 types. Verify in the browser at desktop and mobile widths (signed in and signed out), then run lint, tests and build.
- Leave `prototypes/homepage/` in place as the design reference. Do not delete it.
