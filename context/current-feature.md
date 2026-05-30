# Current feature

<!-- Feature name and short description -->

## Status

<!-- Not started | In progress | Completed -->

## Goals

<!-- Goals and requirements -->

## Notes

<!-- Any extra notes -->

## History

<!-- Keep this updated. Earliest to latest -->

- 2026-05-19 — **Dashboard UI — Phase 1** (Completed). Initial dashboard scaffold: shadcn/ui setup (`utils.ts`, `button`, `input`), dark mode default in root layout, `/dashboard` route with top bar (search + new-item button) and placeholder sidebar/main areas. Shipped on branch `feat/dashboard-phase-1`. Spec: @context/features/dashboard-phase-1-spec.md.
- 2026-05-30 — **Dashboard UI — Phase 2** (Completed). Sidebar built out: `SidebarProvider` context (desktop collapse + mobile drawer state), desktop rail collapsing 240px ↔ 64px, mobile Sheet drawer via new `@radix-ui/react-dialog` dep, `SidebarTrigger` in the header. Sections: Types (links to `/items/[type]` from mock data), Favorites (filtered by `isFavorite`), Recent (top 5 by `updatedAt`), user footer with initials/name/email. Spec: @context/features/dashboard-phase-2-spec.md.
