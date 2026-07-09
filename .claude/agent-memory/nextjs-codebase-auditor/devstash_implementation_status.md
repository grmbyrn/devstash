---
name: devstash-implementation-status
description: What is actually built vs. not-yet-built in DevStash as of 2026-07-09 — prevents flagging unbuilt features as issues
metadata:
  type: project
---

As of 2026-07-09 (audited on `main`, latest commit `9f8445c`), DevStash's implemented surface is a **read-only dashboard** for a single seeded demo user. Confirmed by direct inspection (no listing tool was available in that session; paths were guessed from `context/current-feature.md` history and verified by reading each file):

- No auth: no `next-auth` dependency in `package.json`, no `src/lib/auth.ts`, no `middleware.ts`. All server-side data fetchers (`src/lib/db/collections.ts`, `src/lib/db/items.ts`) hardcode a `DEMO_USER_EMAIL = "demo@devstash.io"` constant instead of reading a session.
- No Server Actions: no `src/actions/` directory exists.
- No API routes: no `src/app/api/` directory exists.
- No R2 upload, no OpenAI/AI endpoints, no Stripe: no `src/lib/r2.ts`, `src/lib/openai.ts`, `src/app/api/upload`, `src/app/api/ai/*`.
- No `/items/[type]` or `/collections/[id]` pages exist yet, even though the sidebar (`src/components/dashboard/sidebar-content.tsx`) and `CollectionCard` already render `<Link>`s to those routes. This is expected incremental scaffolding, not a bug — don't flag as broken links unless the user says those routes were supposed to ship.
- The dashboard header's search `Input` and "New item" `Button` are static placeholders with no `onChange`/`onClick` wired — expected, not a defect.
- `src/app/page.tsx` (the root `/` route, outside the dashboard) is a one-line placeholder (`<h1>Devstash</h1>`) — not in scope for the dashboard feature work, don't flag.

**How to apply:** Do NOT report missing auth, missing Server Actions/API routes, missing file upload, missing AI, or 404s on `/items/[type]` and `/collections/[id]` as findings — all consistent with [[devstash-roadmap-not-yet-built]] per `context/current-feature.md`. Re-verify this list against current `package.json`/directory contents each audit since features land incrementally (most recent shipped feature per history: "Add Pro Badge to Sidebar", 2026-07-08/09).
