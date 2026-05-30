# Current feature

**Dashboard UI — Phase 3.** Build out the main dashboard area to the right of the sidebar: stats, recent collections, pinned items, and recent items.

## Status

In progress. Spec: @context/features/dashboard-phase-3-spec.md.

## Goals

- 4 stats cards at the top: total items, total collections, favorite items, favorite collections
- Recent collections section
- Pinned items section
- 10 most recent items

## Notes

- Use [src/lib/mock-data.ts](src/lib/mock-data.ts) directly for now (no DB yet).
- Reference screenshot: [context/screenshots/dashboard-ui-main.png](context/screenshots/dashboard-ui-main.png).
- Stats cards are not in the screenshot — derive them from the mock data.

## History

<!-- Keep this updated. Earliest to latest -->

- 2026-05-19 — **Dashboard UI — Phase 1** (Completed). Initial dashboard scaffold: shadcn/ui setup (`utils.ts`, `button`, `input`), dark mode default in root layout, `/dashboard` route with top bar (search + new-item button) and placeholder sidebar/main areas. Shipped on branch `feat/dashboard-phase-1`. Spec: @context/features/dashboard-phase-1-spec.md.
- 2026-05-30 — **Dashboard UI — Phase 2** (Completed). Sidebar built out: `SidebarProvider` context (desktop collapse + mobile drawer state), desktop rail collapsing 240px ↔ 64px, mobile Sheet drawer via new `@radix-ui/react-dialog` dep, `SidebarTrigger` in the header. Sections: Types (links to `/items/[type]` from mock data), Favorites (filtered by `isFavorite`), Recent (top 5 by `updatedAt`), user footer with initials/name/email. Spec: @context/features/dashboard-phase-2-spec.md.
