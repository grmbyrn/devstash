---
name: devstash-implementation-status
description: What is actually built vs. not-yet-built in DevStash as of 2026-07-09 — prevents flagging unbuilt features as issues
metadata:
  type: project
---

As of 2026-07-09 (audited on `main`, latest commit `9f8445c`), DevStash's implemented surface is a **read-only dashboard** for a single seeded demo user.

- No auth: no `next-auth` dependency in `package.json`, no `src/lib/auth.ts`, no `middleware.ts`. All server-side data fetchers (`src/lib/db/collections.ts`, `src/lib/db/items.ts`) hardcode a `DEMO_USER_EMAIL = "demo@devstash.io"` constant instead of reading a session.
- No Server Actions (`src/actions/` doesn't exist), no API routes (`src/app/api/` doesn't exist), no R2 upload, no OpenAI/AI endpoints, no Stripe.
- `/items/[type]` and `/collections/[id]` pages don't exist yet even though the sidebar and `CollectionCard` already `<Link>` to them — expected incremental scaffolding, not a bug.
- Dashboard header's search `Input` and "New item" `Button` are static placeholders, no handlers wired — expected.
- Root `/` route (`src/app/page.tsx`) is a one-line placeholder, unrelated to the dashboard feature.

**How to apply:** Don't report missing auth/actions/api/upload/AI or 404s on those two route families as findings. Re-verify against current `package.json`/files each audit since features land incrementally.
