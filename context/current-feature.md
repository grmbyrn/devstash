# Current feature

**Prisma + Neon PostgreSQL Setup.** Stand up the database layer: Prisma 7 ORM against a Neon (serverless) PostgreSQL instance, with an initial schema covering the core data models and NextAuth tables.

## Status

In progress. Spec: @context/features/database-spec.md.

## Goals

- Provision Neon PostgreSQL with a `development` branch wired to `DATABASE_URL` (production branch kept separate).
- Install and configure Prisma 7 — read the upgrade guide first since v7 has breaking changes vs v5/v6.
- Author an initial `schema.prisma` based on the data models in @context/project-overview.md (User, Item, ItemType, Collection, ItemCollection, Tag, TagsOnItems).
- Include NextAuth models: `Account`, `Session`, `VerificationToken`.
- Add appropriate indexes and `onDelete: Cascade` rules per the spec.
- Create the first migration via `prisma migrate dev` — never `db push`.
- Seed system item types (snippet, prompt, command, note, link, file, image) via `prisma/seed.ts`.

## Notes

- **Always** create explicit migrations. Never `prisma db push` unless the user specifically asks.
- Prisma 7 upgrade guide: https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7
- Prisma Postgres quickstart: https://www.prisma.io/docs/getting-started/prisma-orm/quickstart/prisma-postgres
- Schema will evolve — this is the initial cut, not the final shape.

## History

<!-- Keep this updated. Earliest to latest -->

- 2026-05-19 — **Dashboard UI — Phase 1** (Completed). Initial dashboard scaffold: shadcn/ui setup (`utils.ts`, `button`, `input`), dark mode default in root layout, `/dashboard` route with top bar (search + new-item button) and placeholder sidebar/main areas. Shipped on branch `feat/dashboard-phase-1`. Spec: @context/features/dashboard-phase-1-spec.md.
- 2026-05-30 — **Dashboard UI — Phase 2** (Completed). Sidebar built out: `SidebarProvider` context (desktop collapse + mobile drawer state), desktop rail collapsing 240px ↔ 64px, mobile Sheet drawer via new `@radix-ui/react-dialog` dep, `SidebarTrigger` in the header. Sections: Types (links to `/items/[type]` from mock data), Favorites (filtered by `isFavorite`), Recent (top 5 by `updatedAt`), user footer with initials/name/email. Spec: @context/features/dashboard-phase-2-spec.md.
- 2026-06-11 — **Dashboard UI — Phase 3** (Completed). Main dashboard content area: 4 stats cards (total/favorite items + collections), recent collections, pinned items, and 10 most-recent items, all derived from `src/lib/mock-data.ts`. Spec: @context/features/dashboard-phase-3-spec.md.
