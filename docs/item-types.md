# Item Types

Reference for the 7 system item types in DevStash — their metadata, purpose, the
`Item` fields each one actually uses, and how they differ at display time.

> Researched 2026-07-30 from [prisma/schema.prisma](prisma/schema.prisma),
> [prisma/seed.ts](prisma/seed.ts), [context/project-overview.md](context/project-overview.md),
> the dashboard components, and a live read of the Neon **development** branch.
>
> **Documentation only** — no source files were changed.

---

## Table of Contents

1. [At a glance](#at-a-glance)
2. [The `ItemType` model](#the-itemtype-model)
3. [Per-type reference](#per-type-reference)
4. [Content classification: text vs file vs URL](#content-classification-text-vs-file-vs-url)
5. [Shared properties](#shared-properties)
6. [Display differences](#display-differences)
7. [Where types are defined in code](#where-types-are-defined-in-code)
8. [Live data snapshot](#live-data-snapshot)
9. [Gaps & inconsistencies found](#gaps--inconsistencies-found)

---

## At a glance

| Type | Icon (Lucide) | Color | Kind | Pro-gated | Primary content field |
|------|---------------|-------|------|-----------|----------------------|
| **Snippet** | `Code` | `#3b82f6` blue | Text | No | `content` + `language` |
| **Prompt** | `Sparkles` | `#8b5cf6` purple | Text | No | `content` |
| **Command** | `Terminal` | `#f97316` orange | Text | No | `content` |
| **Note** | `StickyNote` | `#fde047` yellow | Text | No | `content` |
| **Link** | `Link` | `#10b981` emerald | URL | No | `url` |
| **File** | `File` | `#6b7280` gray | File | **Yes** | `fileUrl` + `fileName` + `fileSize` |
| **Image** | `Image` | `#ec4899` pink | File | **Yes** | `fileUrl` + `fileName` + `fileSize` |

Canonical display order (used by the sidebar and the profile breakdown) is
`snippet → prompt → command → note → link → file → image`, defined by
`SYSTEM_TYPE_ORDER` in [src/lib/db/items.ts:101](src/lib/db/items.ts#L101).

> ⚠️ The **seed** array in [prisma/seed.ts:10-18](prisma/seed.ts#L10-L18) lists them in a
> different order (`… note, file, image, link`). Order there is irrelevant — `ItemType`
> has no `createdAt`, which is exactly why `SYSTEM_TYPE_ORDER` exists as a separate list.

---

## The `ItemType` model

Types are **rows, not an enum** — a type is data, so users can eventually add their own.

```prisma
model ItemType {
  id       String  @id @default(cuid())
  name     String  // "snippet", "prompt", … lowercase singular
  icon     String  // Lucide icon component name, e.g. "Code"
  color    String  // hex string, e.g. "#3b82f6"
  isSystem Boolean @default(false)
  userId   String? // null for system types; set for future custom types

  @@unique([name, userId])
}
```

- **System types** have `isSystem = true` and `userId = null`. They're seeded and
  idempotently re-synced (icon/color updated in place) by [prisma/seed.ts:281-295](prisma/seed.ts#L281-L295).
- **Custom types** (`isSystem = false`, `userId` set) are scaffolded but **not built** in v1.
- `@@unique([name, userId])` prevents duplicate names per user; system types are unique
  globally because their `userId` is `null`.
- `Item.itemType` has **no** `onDelete: Cascade` (unlike every other `Item` relation) —
  deleting a type in use would be blocked by the FK, which protects the seeded set.

---

## Per-type reference

### Snippet

| | |
|---|---|
| **Icon / color** | `Code` — `#3b82f6` (blue) |
| **Kind** | Text |
| **URL path** | `/items/snippets` |
| **Pro** | No |

Reusable code — hooks, helpers, config blocks, Dockerfiles. The only type that
meaningfully uses `language`, which drives syntax highlighting.

**Fields used:** `title`, `content` (the code), `language`, `description`,
plus the [shared properties](#shared-properties). `contentType = TEXT`.

---

### Prompt

| | |
|---|---|
| **Icon / color** | `Sparkles` — `#8b5cf6` (purple) |
| **Kind** | Text |
| **URL path** | `/items/prompts` |
| **Pro** | No |

LLM prompts and system messages. Seeded examples use `{{PLACEHOLDER}}` tokens
(e.g. `{{DIFF}}`, `{{CODE}}`) for the caller to substitute — a convention in the
seed data, not an enforced feature.

**Fields used:** `title`, `content` (the prompt body), `description`.
`language` is unused. `contentType = TEXT`.

Target of the **Prompt Optimizer** AI feature (Pro).

---

### Command

| | |
|---|---|
| **Icon / color** | `Terminal` — `#f97316` (orange) |
| **Kind** | Text |
| **URL path** | `/items/commands` |
| **Pro** | No |

Shell one-liners — `git reset --soft HEAD~1`, `docker system prune -f`.
Distinguished from Snippet by intent (run it) rather than by schema; content is
typically a single line.

**Fields used:** `title`, `content` (the command), `description`.
`language` is left null in practice even though shell highlighting would be valid.
`contentType = TEXT`.

---

### Note

| | |
|---|---|
| **Icon / color** | `StickyNote` — `#fde047` (yellow) |
| **Kind** | Text |
| **URL path** | `/items/notes` |
| **Pro** | No |

Freeform Markdown — documentation notes, course material, explanations.
The most open-ended text type: no `language`, no `url`.

**Fields used:** `title`, `content` (Markdown), `description`. `contentType = TEXT`.

> Not represented in the seed data — zero note items exist in the dev database.

---

### Link

| | |
|---|---|
| **Icon / color** | `Link` — `#10b981` (emerald) |
| **Kind** | URL |
| **URL path** | `/items/links` |
| **Pro** | No |

Bookmarked docs and references. The **only** type whose payload lives in `url`
rather than `content` or `fileUrl`.

**Fields used:** `title`, `url`, `description`. `content` stays **null**.

> **Important:** links still carry `contentType = TEXT`, not a third enum value —
> confirmed in the dev DB (6 link items, all `TEXT`, all `content IS NULL`,
> all `url IS NOT NULL`). See [the classification section](#content-classification-text-vs-file-vs-url).

Planned feature: link previews (unbuilt).

---

### File ⭐ Pro

| | |
|---|---|
| **Icon / color** | `File` — `#6b7280` (gray) |
| **Kind** | File upload |
| **URL path** | `/items/files` |
| **Pro** | **Yes** (in production; all types are open in dev) |

Arbitrary uploads stored in Cloudflare R2, with the object URL in `fileUrl`.

**Fields used:** `title`, `fileUrl`, `fileName` (original name), `fileSize` (bytes),
`description`. `content` stays null. `contentType = FILE`.

> Not yet implemented — no upload route, no R2 client, and zero file items exist.
> The type row is seeded and the sidebar entry carries a **PRO** badge.

---

### Image ⭐ Pro

| | |
|---|---|
| **Icon / color** | `Image` — `#ec4899` (pink) |
| **Kind** | File upload |
| **URL path** | `/items/images` |
| **Pro** | **Yes** (in production) |

Same storage mechanics as File; separated so images can render as thumbnails
instead of as a download link.

**Fields used:** identical to File — `fileUrl`, `fileName`, `fileSize`.
`contentType = FILE`.

> Also unimplemented; zero image items exist.

---

## Content classification: text vs file vs URL

There are **three conceptual kinds** of item but only **two** `ContentType` enum values:

```prisma
enum ContentType { TEXT | FILE }
```

| Conceptual kind | Types | `contentType` | Payload field | Null in practice |
|---|---|---|---|---|
| **Text** | snippet, prompt, command, note | `TEXT` | `content` | `url`, `fileUrl`, `fileName`, `fileSize` |
| **URL** | link | `TEXT` | `url` | `content`, `fileUrl`, `fileName`, `fileSize` |
| **File** | file, image | `FILE` | `fileUrl` (+ `fileName`, `fileSize`) | `content`, `url` |

**Consequences of link sharing `TEXT` with the true text types:**

- `contentType` alone can't tell you where the payload is — you need
  `itemType.name` (or a null-check) to distinguish a link from a note.
- Consumers use a **fallback chain** rather than branching on `contentType`.
  [item-card.tsx:9](src/components/dashboard/item-card.tsx#L9):
  ```ts
  const preview = item.content?.trim() ?? item.url ?? item.description ?? "";
  ```
- No DB constraint enforces the "right" field for a type. A link with `content`
  set, or a snippet with `contentType = FILE`, is schema-valid. Validation is
  application-level only (and the item create/edit path isn't built yet).

---

## Shared properties

Every item carries these regardless of type — from [prisma/schema.prisma:83-112](prisma/schema.prisma#L83-L112):

| Field | Type | Notes |
|---|---|---|
| `id` | `String` cuid | |
| `title` | `String` | Required for every type |
| `description` | `String?` | Optional one-liner; renders under the title / as preview fallback |
| `contentType` | `ContentType` | `TEXT` or `FILE` — **required**, no default |
| `isFavorite` | `Boolean` | Default `false`; ⭐ on cards, feeds the stat cards |
| `isPinned` | `Boolean` | Default `false`; drives the dashboard Pinned section |
| `lastUsedAt` | `DateTime?` | Powers "Recent"; null until an item is opened |
| `createdAt` / `updatedAt` | `DateTime` | `updatedAt` is the recency tiebreaker |
| `userId` | `String` | Owner; `onDelete: Cascade` |
| `itemTypeId` | `String` | The type; **no** cascade |
| `tags` | `TagsOnItems[]` | Many-to-many against a **global** `Tag` table |
| `collections` | `ItemCollection[]` | Many-to-many; one item can live in many collections |

**Type-specific (nullable) fields** — all present on every row, just unused by most types:
`content`, `url`, `fileUrl`, `fileName`, `fileSize`, `language`.

This is a **single-table / sparse-column** design: one `Item` table for all 7 types
with nullable columns per kind, rather than per-type tables or a JSON blob. Adding a
custom type needs no migration.

**Indexes** are all type-agnostic — `[userId]`, `[itemTypeId]`, `[userId, updatedAt]`,
`[userId, lastUsedAt]`.

---

## Display differences

### What varies by type

| Surface | How the type drives it |
|---|---|
| **Card left border** | 3px border tinted with `type.color` — [item-card.tsx:14](src/components/dashboard/item-card.tsx#L14) |
| **Card icon chip** | `ItemTypeIcon` resolves `type.icon` (the string) to a Lucide component, tinted `type.color` |
| **Card preview** | `content` → `url` → `description` fallback; so links show a raw URL, text types show a code-ish excerpt |
| **Sidebar row** | Icon + `Types` label + color; links to `/items/{name}s` |
| **PRO badge** | `PRO_TYPES = new Set(["file", "image"])` — [sidebar-content.tsx:26](src/components/dashboard/sidebar-content.tsx#L26); hidden in the collapsed rail |
| **Collection accent** | Card top bar + sidebar dot use the collection's **most-used** type's color — [collections.ts:75-76](src/lib/db/collections.ts#L75-L76) |
| **Collection type chips** | One icon per distinct type in the collection, most-used first |
| **Profile breakdown** | Every system type listed with its count, including zeros — [profile.ts:39-42](src/lib/db/profile.ts#L39-L42) |

### What does *not* vary by type (yet)

- **The card body is identical for all 7 types.** The preview is a `<pre>` with
  `line-clamp-3` regardless of whether it's a snippet, prompt, or link.
- **No syntax highlighting is implemented.** `language` is stored and returned in
  `ItemWithMeta` but nothing renders it — the plan is `shiki`/`highlight.js`.
- **No image thumbnails, no file-size formatting, no link previews.**
- **No per-type layout branching anywhere in the codebase.** The only branch on a
  type *name* is the `PRO_TYPES` set.

### Icon resolution

`ItemType.icon` is a **string** matched against a hardcoded map in
[item-type-icon.tsx:12-20](src/components/dashboard/item-type-icon.tsx#L12-L20),
covering exactly the 7 seeded icons and falling back to `Code` for anything unknown.
A future custom type could pick any Lucide name, but it would render as `Code`
unless that map is expanded.

---

## Where types are defined in code

The 7 types (name + icon + color) are declared in **four** places — worth knowing
before changing one:

| Location | Role | Authoritative? |
|---|---|---|
| [prisma/seed.ts:10-18](prisma/seed.ts#L10-L18) `SYSTEM_TYPES` | Writes the DB rows; re-syncs icon/color on every seed | **Yes** — the source of truth |
| [src/lib/db/items.ts:101-109](src/lib/db/items.ts#L101-L109) `SYSTEM_TYPE_ORDER` | Display order only (names) | Order only |
| [item-type-icon.tsx:12-20](src/components/dashboard/item-type-icon.tsx#L12-L20) `ICON_MAP` | String → Lucide component | Rendering only |
| [src/lib/mock-data.ts:66-122](src/lib/mock-data.ts#L66-L122) `itemTypes` | Legacy mock, includes `urlPath` | **No** — dead for types |
| [context/project-overview.md](context/project-overview.md) | Spec table | Documentation |

At runtime, types are always **read from the DB** via `getSystemItemTypes()`
([items.ts:112](src/lib/db/items.ts#L112)). Nothing in `src/app` or `src/components`
imports type definitions from `mock-data.ts` any more — but the file still exports
an `itemTypes` array (with `urlPath`, a field that exists nowhere else) that will
drift silently.

---

## Live data snapshot

Neon **development** branch (`br-fancy-sound-aqsr7pn4`), read 2026-07-30 — all 7
system types exist with `isSystem = true`, `userId = null`, matching the seed exactly.

| Type | Items | `contentType` | with `content` | with `url` | with `language` | with `fileUrl` |
|---|---|---|---|---|---|---|
| snippet | 4 | 4 TEXT | 4 | 0 | **4** | 0 |
| prompt | 3 | 3 TEXT | 3 | 0 | 0 | 0 |
| command | 5 | 5 TEXT | 5 | 0 | 0 | 0 |
| note | **0** | — | — | — | — | — |
| link | 6 | 6 TEXT | **0** | **6** | 0 | 0 |
| file | **0** | — | — | — | — | — |
| image | **0** | — | — | — | — | — |
| **Total** | **18** | 18 TEXT, 0 FILE | 12 | 6 | 4 | 0 |

Languages in use: `typescript` (3), `dockerfile` (1) — snippets only.

This confirms the field-usage table above empirically: **`language` is snippet-only,
`url` is link-only, and no item has ever used the FILE branch of the schema.**

---

## Gaps & inconsistencies found

Observations from this pass. None were changed — listing them so they're not
rediscovered later.

1. **`/items/[type]` routes don't exist.** The sidebar links every type to
   `/items/{name}s` ([sidebar-content.tsx:62](src/components/dashboard/sidebar-content.tsx#L62))
   but `src/app` has no `items/` directory — all 7 links 404 today. Same for
   `/collections` and `/collections/[id]`.
2. **Link items are `contentType = TEXT`.** Reasonable (they're not files), but it
   means the enum doesn't classify the three real kinds. Any code that branches on
   `contentType` to find the payload will read links wrong.
3. **Nothing enforces the type ↔ field contract.** No DB check constraint and no Zod
   schema ties `itemType.name = "link"` to "must have `url`, must not have `content`".
   Worth adding when the item create/edit path is built.
4. **`language` is stored but never rendered.** Syntax highlighting is specced
   (`shiki` / `highlight.js`) and unimplemented; commands don't set `language` at all
   even though `bash`/`shell` would apply.
5. **Pro gating is UI-only.** `PRO_TYPES` puts a badge in the sidebar; there is no
   server-side check preventing a file/image item from being created, because the
   creation path doesn't exist yet. The overview requires server-side gating.
6. **`mock-data.ts` still exports a stale `itemTypes` array** with a `urlPath` field
   that has no counterpart in the schema or the DB. Unused for types now, but it's a
   second definition that can drift.
7. **Note / File / Image have no seed coverage**, so those three types are entirely
   unexercised in the running app.
