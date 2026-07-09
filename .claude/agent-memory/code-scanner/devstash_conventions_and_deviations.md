---
name: devstash-conventions-and-deviations
description: Confirmed real conventions and recurring standards deviations in DevStash's implemented code, to judge severity consistently across audits
metadata:
  type: project
---

Confirmed as of 2026-07-09 re-audit (branch `fix/audit-quick-wins`, prior audit on `main` commit `9f8445c`):

- Prisma 7 uses the `prisma-client` generator with custom output `src/generated/prisma` (gitignored via `/src/generated` — confirmed by reading `.gitignore`). Datasource `url` lives in `prisma.config.ts`, not `schema.prisma`. Intentional Prisma 7 structure, not a misconfig.
- `.env*` is gitignored — confirmed directly. Never flag env exposure without a concrete leak.
- No `src/types/` directory exists despite `context/coding-standards.md` prescribing `src/types/[feature].ts`. Shared interfaces live inline in `src/lib/db/collections.ts` / `src/lib/db/items.ts`, and `src/lib/mock-data.ts` has its own parallel types. Recurring Low/Medium finding until fixed.
- `src/components/dashboard/sidebar-content.tsx` bundles 4 components in one ~233-line file (`SidebarContent`, `Section`, `NavItem`, `UserFooter`) — deviates from one-component-per-file convention. Still true as of this re-audit; re-check size each audit.
- Dynamic accent colors via `style={{ backgroundColor: ... }}` (from DB `ItemType.color`) in `CollectionCard`, `ItemCard`, `sidebar-content.tsx` are a justified, deliberate exception to "no inline styles" — colors are runtime data, not expressible as static Tailwind classes. Do not flag.
- `getRecentCollections()` (`src/lib/db/collections.ts`) fetches ALL items per collection unbounded, just to tally the most-common item type in JS. Fine at free-tier scale (50 items/3 collections) but won't scale for Pro (unlimited). Still present as of 2026-07-09 re-audit — recurring Medium perf finding, NOT fixed by the "Fix #1" cache dedup change (that fix only deduped the two redundant *calls*, not the per-collection unbounded item fetch inside the query itself).
- `src/lib/mock-data.ts` `currentUser.email` is `"demo@devstash.com"` (`.com`) but the real seeded/DB demo user is `demo@devstash.io` (`.io`, see `DEMO_USER_EMAIL` in `src/lib/constants.ts` and `prisma/seed.ts`). Sidebar `UserFooter` renders the mock email, so the footer displays a domain that doesn't match the real demo account. Cosmetic, Low severity, pre-existing.
- **RESOLVED as of `fix/audit-quick-wins` branch**: `getRecentCollections()` is now wrapped in React `cache()` (import from `"react"`) and both callers (`src/app/dashboard/layout.tsx`, `src/app/dashboard/page.tsx`) pass the same explicit `RECENT_COLLECTIONS_LIMIT` (6, from `src/lib/constants.ts`) as the argument, so the dedup actually works (previously they used different literal limits — 5 vs 6 — which defeated any memoization). Layout slices `.slice(0, 5)` client-side for the sidebar subset; verified this yields the same top-5 as before. No caller currently invokes `getRecentCollections()` with no args (which would produce a different cache key — `undefined` vs `6` — since `cache()` keys off the raw arguments passed, not the resolved default parameter value). This is a latent footgun for any *future* caller, not a current bug — note it if a third caller is ever added.
- **RESOLVED as of `fix/audit-quick-wins` branch**: `DEMO_USER_EMAIL` is now a single export in `src/lib/constants.ts`, imported by both `src/lib/db/collections.ts` and `src/lib/db/items.ts` — no more independent duplicate declarations in those two files. `prisma/seed.ts` still hardcodes the literal `"demo@devstash.io"` twice (upsert `where` + `create` data) instead of importing the constant — out of scope of the stated fix, pre-existing, Low severity (seed.ts runs outside the `@/*` path-alias-resolved Next.js app but could still `import` via a relative path `../src/lib/constants`).

See also [[devstash-implementation-status]].
