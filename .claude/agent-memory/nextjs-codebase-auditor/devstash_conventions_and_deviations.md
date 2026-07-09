---
name: devstash-conventions-and-deviations
description: Confirmed real conventions and recurring standards deviations in DevStash's implemented code, to judge severity consistently across audits
metadata:
  type: project
---

Confirmed as of 2026-07-09 audit (branch `main`, commit `9f8445c`):

- Prisma 7 uses the newer `prisma-client` generator with a **custom output path** `src/generated/prisma` (not the default `@prisma/client` import location). This path IS in `.gitignore` (`/src/generated`), correctly. Datasource `url` is NOT in `schema.prisma` — it lives in `prisma.config.ts` via `process.env.DATABASE_URL`. This is intentional Prisma 7 structure, not a misconfiguration.
- `.env*` is gitignored (confirmed by reading `.gitignore` directly) — never flag env exposure without a concrete leak to a tracked file or client bundle.
- **Recurring real deviation:** there is no `src/types/` directory at all, despite `context/coding-standards.md` prescribing `Types: src/types/[feature].ts`. All shared interfaces (`CollectionWithMeta`, `ItemWithMeta`, `ItemTypeSummary`, `SidebarCollection`, etc.) are defined inline inside `src/lib/db/collections.ts` and `src/lib/db/items.ts`, and `src/lib/mock-data.ts` duplicates its own parallel type set. Worth flagging (Medium) each audit until fixed, since it's a consistent structural violation, not a one-off.
- **Recurring pattern:** `DEMO_USER_EMAIL = "demo@devstash.io"` is hardcoded independently in both `src/lib/db/collections.ts` and `src/lib/db/items.ts` (duplicated literal, no shared constants file). Low-severity but worth a one-line mention until consolidated.
- `src/components/dashboard/sidebar-content.tsx` bundles 4 components in one file (`SidebarContent`, `Section`, `NavItem`, `UserFooter`, ~233 lines) — a real deviation from the "one component per file" convention in `coding-standards.md`. Worth a Medium componentization note; re-check line count/scope each time since this file is actively growing (Pro badge, favorites, recents all added incrementally per `current-feature.md` history).
- Dynamic per-item/collection accent colors (`style={{ backgroundColor: type.color }}` etc.) are a deliberate, justified exception to the "no inline styles" rule — colors come from DB data (`ItemType.color` hex strings) and can't be expressed as static Tailwind classes. Do not flag this as a "no inline styles" violation; it's the same pattern in `CollectionCard`, `ItemCard`, and `sidebar-content.tsx`.
- `getRecentCollections()` in `src/lib/db/collections.ts` fetches ALL items per collection (unbounded nested `include`) purely to tally the most-common item type in JS. Fine at current free-tier scale (50 items/3 collections) but will not scale for Pro users (unlimited items/collections) — flag as Medium performance until it's replaced with a DB-side aggregation (e.g. `groupBy`).
- `getRecentCollections()` is called twice per dashboard page load with different limits — once in `src/app/dashboard/layout.tsx` (limit 5, for the sidebar) and again in `src/app/dashboard/page.tsx` (limit 6, for the main grid) — two independent full round trips with the same expensive per-collection tally. Different limits mean simple memoization via matching args won't dedupe it; would need a shared fetch/slice restructure. Recurring Medium perf finding until addressed.

See also [[devstash-implementation-status]].
