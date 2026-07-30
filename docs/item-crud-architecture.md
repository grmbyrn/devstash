# Item CRUD Architecture

A design for one unified create/read/update/delete system serving all 7 item types,
rather than seven parallel implementations.

> **Design document — nothing here is built yet.** Written 2026-07-30 against
> [context/project-overview.md](context/project-overview.md),
> [context/coding-standards.md](context/coding-standards.md),
> [docs/item-types.md](docs/item-types.md), [prisma/schema.prisma](prisma/schema.prisma),
> and the existing auth/profile/dashboard code, which sets the conventions this follows.
>
> The prompt cited `@docs/content-types.md`; the actual file is
> [docs/item-types.md](docs/item-types.md) and that's what was used.
>
> **Documentation only** — no source files were changed.

---

## Table of Contents

1. [Core principle](#core-principle)
2. [File structure](#file-structure)
3. [Routing: `/items/[type]`](#routing-itemstype)
4. [Layer 1 — Mutations (`src/actions/items.ts`)](#layer-1--mutations-srcactionsitemsts)
5. [Layer 2 — Validation (`src/lib/validations/item.ts`)](#layer-2--validation-srclibvalidationsitemts)
6. [Layer 3 — Queries (`src/lib/db/items.ts`)](#layer-3--queries-srclibdbitemsts)
7. [Layer 4 — Type-specific logic in components](#layer-4--type-specific-logic-in-components)
8. [Component responsibilities](#component-responsibilities)
9. [End-to-end flows](#end-to-end-flows)
10. [Blocking prerequisites](#blocking-prerequisites)
11. [Key decisions & trade-offs](#key-decisions--trade-offs)
12. [Suggested build order](#suggested-build-order)

---

## Core principle

**The type is data, not a branch.** All 7 types are rows in `ItemType` writing to one
`Item` table with sparse nullable columns (see [docs/item-types.md](docs/item-types.md)).
So the CRUD system treats type as a *parameter* everywhere except the last mile of
rendering.

Concretely, the split the prompt asks for:

| Layer | Type-aware? | Why |
|---|---|---|
| **Actions** (mutations) | ❌ No | One code path writes `Item`. Type is a validated input, never a `switch`. |
| **Validation** | ⚠️ Only via **kind** | A single schema + one refinement keyed on text/url/file. |
| **Queries** (`lib/db`) | ⚠️ Only as a filter | `where.itemType.name = type`. Same select, same shape. |
| **Route** | ❌ No | One dynamic segment resolves the type and passes it down. |
| **Components** | ✅ **Yes** | Editors and previews genuinely differ. **This is the only place `switch (type)` belongs.** |

The rule to hold: **if you're tempted to add `if (type === "link")` outside
`src/components/items/`, you're in the wrong layer.**

---

## File structure

New files marked ➕; existing files that need edits marked ✏️.

```
src/
├── actions/
│   ├── auth.ts
│   ├── profile.ts
│   └── items.ts                      ➕ ALL mutations: create, update, delete,
│                                        toggleFavorite, togglePin, touch
├── lib/
│   ├── db/
│   │   ├── collections.ts
│   │   ├── profile.ts
│   │   └── items.ts                  ✏️ + getItemsByType, getItemById,
│   │                                    getItemTypeBySlug; user-scoping fix
│   ├── validations/
│   │   ├── auth.ts
│   │   └── item.ts                   ➕ Zod schemas, kind-aware refinement
│   ├── items/
│   │   ├── types.ts                  ➕ TYPE_SLUGS, slug↔name, TYPE_KIND registry
│   │   └── format.ts                 ➕ formatFileSize, hostname(url), etc.
│   └── constants.ts                  ✏️ ITEMS_PAGE_SIZE
├── app/
│   ├── dashboard/
│   │   ├── layout.tsx                ✏️ (see routing note — shell moves here)
│   │   └── page.tsx
│   └── items/
│       └── [type]/
│           ├── page.tsx              ➕ the ONE list route (server component)
│           ├── new/page.tsx          ➕ create form
│           └── [id]/edit/page.tsx    ➕ edit form
├── components/
│   ├── dashboard/
│   │   ├── item-card.tsx             ✏️ add href + kind-aware preview
│   │   └── item-type-icon.tsx
│   └── items/                        ➕ all new
│       ├── item-form.tsx             ➕ shared shell; picks the editor by kind
│       ├── item-list.tsx             ➕ grid + empty state
│       ├── item-toolbar.tsx          ➕ sort/filter/new (client island)
│       ├── item-drawer.tsx           ➕ slide-over detail (client island)
│       ├── item-actions.tsx          ➕ favorite/pin/delete buttons (client island)
│       ├── delete-item-dialog.tsx    ➕ confirm (client island)
│       └── editors/
│           ├── text-editor.tsx       ➕ snippet, prompt, command, note
│           ├── url-editor.tsx        ➕ link
│           └── file-editor.tsx       ➕ file, image (Pro — build last)
└── proxy.ts                          ✏️ matcher must include /items
```

**Why `src/lib/items/` is separate from `src/lib/db/`:** the slug map and kind
registry are pure, synchronous, importable by client components. `lib/db/*` imports
Prisma and must never reach a client bundle.

---

## Routing: `/items/[type]`

### One route, seven URLs

The sidebar already links to `/items/{name}s`
([sidebar-content.tsx:62](src/components/dashboard/sidebar-content.tsx#L62)) —
so the slug is the **plural** of the type name:

| Slug | `ItemType.name` |
|---|---|
| `/items/snippets` | `snippet` |
| `/items/prompts` | `prompt` |
| `/items/commands` | `command` |
| `/items/notes` | `note` |
| `/items/links` | `link` |
| `/items/files` | `file` |
| `/items/images` | `image` |

> ⚠️ **These 7 links 404 today** — `src/app/items/` doesn't exist. Building this route
> is what makes the existing sidebar work.

**Resolve the slug with an explicit map, not by stripping the trailing `s`.**
All 7 happen to pluralize regularly, but a map rejects junk (`/items/foo`) cleanly and
survives a future irregular custom type.

```ts
// src/lib/items/types.ts
export const TYPE_SLUGS = {
  snippets: "snippet",
  prompts:  "prompt",
  commands: "command",
  notes:    "note",
  links:    "link",
  files:    "file",
  images:   "image",
} as const;

export type TypeSlug = keyof typeof TYPE_SLUGS;
export type TypeName = (typeof TYPE_SLUGS)[TypeSlug];

export const slugForType = (name: string) => `${name}s`;
export const typeForSlug = (slug: string): TypeName | null =>
  TYPE_SLUGS[slug as TypeSlug] ?? null;
```

### The page

```tsx
// src/app/items/[type]/page.tsx  — server component, no "use client"
export async function generateStaticParams() {
  return Object.keys(TYPE_SLUGS).map((type) => ({ type }));
}

export async function generateMetadata({ params }) {
  const { type } = await params;                       // Next 16: params is a Promise
  const name = typeForSlug(type);
  if (!name) return {};
  return { title: `${titleCase(name)}s · DevStash` };
}

export default async function ItemsByTypePage({ params, searchParams }) {
  const [{ type: slug }, query] = await Promise.all([params, searchParams]);

  const typeName = typeForSlug(slug);
  if (!typeName) notFound();                           // unknown slug → 404, not a crash

  const session = await auth();
  if (!session?.user?.id) redirect(`/sign-in?callbackUrl=/items/${slug}`);

  const [itemType, items] = await Promise.all([
    getItemTypeBySlug(typeName),
    getItemsByType(session.user.id, typeName, { sort: query.sort }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <ItemsHeader type={itemType} count={items.length} />
      <ItemToolbar type={itemType} />
      <ItemList items={items} type={itemType} />
    </div>
  );
}
```

Note `params`/`searchParams` are **Promises** in Next 16 — the auth pages already
await them ([sign-in/page.tsx:31](src/app/(auth)/sign-in/page.tsx#L31)).

### ⚠️ Two placement problems to settle first

**1. The route sits outside the dashboard shell.** The sidebar + header live in
[src/app/dashboard/layout.tsx](src/app/dashboard/layout.tsx), which only wraps
`/dashboard/*`. A page at `src/app/items/[type]/` renders with **no sidebar**.

Three options:

| Option | Result | Verdict |
|---|---|---|
| **A. Route group** — move to `src/app/(dashboard)/`, holding `dashboard/`, `items/`, `collections/` | URLs unchanged, one shared shell | ✅ **Recommended** — this is what [project-overview.md](context/project-overview.md) specified all along |
| B. Nest under `/dashboard/items/[type]` | Breaks every existing sidebar link | ❌ |
| C. Duplicate the shell in an `items/layout.tsx` | Two copies of the sidebar fetch | ❌ |

Option A means creating `src/app/(dashboard)/layout.tsx` (moved verbatim) and relocating
`dashboard/`, plus the future `collections/`, into the group. No URLs change.

**2. `/items` isn't protected.** [proxy.ts:17](src/proxy.ts#L17) matches only
`/dashboard/:path*` and `/profile/:path*`. Extend it:

```ts
matcher: ["/dashboard/:path*", "/profile/:path*", "/items/:path*", "/collections/:path*"]
```

Keep the in-page `auth()` guard too — the profile page does both, and defense-in-depth
matters more once mutations exist.

---

## Layer 1 — Mutations (`src/actions/items.ts`)

**One file. Six actions. Zero type branching.**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createItemSchema, updateItemSchema } from "@/lib/validations/item";
import { slugForType } from "@/lib/items/types";

export async function createItem(formData: FormData) { … }
export async function updateItem(formData: FormData) { … }
export async function deleteItem(formData: FormData) { … }
export async function toggleFavorite(formData: FormData) { … }
export async function togglePin(formData: FormData) { … }
export async function touchItem(id: string) { … }   // sets lastUsedAt
```

### The shape every mutation follows

Established by [actions/profile.ts](src/actions/profile.ts) — match it exactly:

1. **`auth()` first**, redirect to `/sign-in?callbackUrl=…` if absent.
2. **Zod-parse the `FormData`**; on failure `redirect(?error=<message>)`.
3. **Verify ownership** before touching the row (below).
4. **Mutate** via Prisma.
5. **`revalidatePath()`** the affected routes.
6. **`redirect()`** to the destination with a success flag.

```ts
export async function createItem(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/items");

  const parsed = createItemSchema.safeParse(fromFormData(formData));
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    const slug = String(formData.get("typeSlug") ?? "");
    redirect(`/items/${slug}/new?error=${encodeURIComponent(message)}`);
  }

  const { typeName, collectionIds, tags, ...data } = parsed.data;

  const itemType = await prisma.itemType.findFirst({
    where: { name: typeName, isSystem: true, userId: null },
    select: { id: true },
  });
  if (!itemType) redirect(`/items?error=${encodeURIComponent("Unknown item type")}`);

  const item = await prisma.item.create({
    data: {
      ...data,
      contentType: contentTypeFor(typeName),   // TEXT | FILE — derived, never posted
      userId: session.user.id,
      itemTypeId: itemType.id,
      tags: { create: tags.map((name) => ({
        tag: { connectOrCreate: { where: { name }, create: { name } } },
      })) },
      collections: { create: collectionIds.map((collectionId) => ({ collectionId })) },
    },
    select: { id: true },
  });

  revalidatePath(`/items/${slugForType(typeName)}`);
  revalidatePath("/dashboard");
  redirect(`/items/${slugForType(typeName)}?created=${item.id}`);
}
```

### Ownership: the one security rule

`Item.id` is a cuid, but it is **guessable enough to matter** — never trust a posted id.
Every update/delete must scope by `userId` in the **same query**, not in a prior read:

```ts
// ✅ Atomic — a foreign id updates 0 rows
const { count } = await prisma.item.updateMany({
  where: { id, userId: session.user.id },
  data: parsed.data,
});
if (count === 0) notFound();

// ❌ Never: findUnique({ where: { id } }) then compare userId — TOCTOU, and leaks
//    existence through timing/error differences.
```

Same for `deleteMany`. `updateMany`/`deleteMany` return a count instead of throwing,
which makes "not yours" and "doesn't exist" indistinguishable to the caller — exactly
what you want.

### `contentType` is derived, never submitted

A client that posts `contentType: FILE` on a note would corrupt the invariant in
[docs/item-types.md](docs/item-types.md). Derive it from the type name:

```ts
// src/lib/items/types.ts
export const TYPE_KIND = {
  snippet: "text", prompt: "text", command: "text", note: "text",
  link: "url",
  file: "file", image: "file",
} as const;

export const contentTypeFor = (name: TypeName) =>
  TYPE_KIND[name] === "file" ? "FILE" : "TEXT";   // link → TEXT, per the schema
```

### Revalidation — new ground

**No `revalidatePath` call exists anywhere in the codebase today**, because nothing
mutates displayed data yet. Every item mutation must invalidate:

| Mutation | Revalidate |
|---|---|
| create / delete | `/items/{slug}`, `/dashboard`, any affected `/collections/{id}` |
| update | `/items/{slug}`, `/dashboard`, `/items/{slug}/{id}/edit` |
| favorite / pin | `/items/{slug}`, `/dashboard` (both feed stat cards + pinned section) |
| `touchItem` | `/dashboard` only (`lastUsedAt` drives Recent) |

Watch out: `getRecentCollections` is wrapped in React `cache()`
([collections.ts:38](src/lib/db/collections.ts#L38)) — that's *per-request* memoization,
unaffected by revalidation. No action needed, just don't confuse the two.

### Why `FormData` and not typed args

Every form in this app is a server-action `<form action={…}>` with the page staying a
server component — the pattern the user established and the memory records. `FormData`
in, `redirect` out, keeps that intact and needs **zero** client JS for the core flows.
Interactivity stays in the small islands listed below.

---

## Layer 2 — Validation (`src/lib/validations/item.ts`)

One base schema, one kind-aware refinement — **not** seven schemas.

```ts
import { z } from "zod";
import { TYPE_KIND, type TypeName } from "@/lib/items/types";

const baseItem = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  typeName: z.enum(Object.keys(TYPE_KIND) as [TypeName, ...TypeName[]]),

  content:  z.string().optional(),
  url:      z.string().url("Enter a valid URL").optional().or(z.literal("")),
  language: z.string().max(50).optional(),
  fileUrl:  z.string().url().optional(),
  fileName: z.string().max(255).optional(),
  fileSize: z.coerce.number().int().positive().optional(),

  tags: z.array(z.string().trim().toLowerCase().min(1).max(30)).max(10).default([]),
  collectionIds: z.array(z.string().cuid()).default([]),
});

/** Enforces the type ↔ field contract the DB can't. */
export const createItemSchema = baseItem.superRefine((data, ctx) => {
  const kind = TYPE_KIND[data.typeName];

  if (kind === "text" && !data.content?.trim())
    ctx.addIssue({ path: ["content"], code: "custom", message: "Content is required" });

  if (kind === "url" && !data.url)
    ctx.addIssue({ path: ["url"], code: "custom", message: "A URL is required" });

  if (kind === "file" && !data.fileUrl)
    ctx.addIssue({ path: ["fileUrl"], code: "custom", message: "Upload a file" });

  if (kind !== "text" && data.language)
    ctx.addIssue({ path: ["language"], code: "custom",
                   message: "Language only applies to text items" });
});

export const updateItemSchema = createItemSchema
  .safeExtend({ id: z.string().cuid() });   // typeName is immutable — see below
```

This closes gap #3 from [docs/item-types.md](docs/item-types.md): nothing currently ties
`link` to "must have `url`". Zod v4 is already a dependency and the auth schemas use its
top-level `z.email()` style.

**Type is immutable after creation.** Changing a note into a file would orphan `content`
and demand a `fileUrl` that doesn't exist. Simpler and safer: no type change; delete and
recreate. Keep `typeName` out of the update path (or ignore it server-side).

---

## Layer 3 — Queries (`src/lib/db/items.ts`)

Extend the existing file — it already has `itemCardSelect`, `ItemWithMeta`,
`toItemWithMeta`, and `SYSTEM_TYPE_ORDER`. Reuse all of it.

```ts
export async function getItemsByType(
  userId: string,
  typeName: TypeName,
  opts: { sort?: "recent" | "created" | "title"; take?: number; skip?: number } = {},
): Promise<ItemWithMeta[]>

export async function getItemById(
  userId: string,
  id: string,
): Promise<ItemDetail | null>      // ItemWithMeta + file fields + collections + timestamps

export async function getItemTypeBySlug(name: TypeName): Promise<ItemTypeSummary | null>
```

`getItemsByType` is a **filter, not a branch** — the whole type-awareness is one clause:

```ts
where: { userId, itemType: { name: typeName } },
orderBy: sortMap[opts.sort ?? "recent"],
select: itemCardSelect,       // identical shape for all 7 types
```

Query ordering is already indexed by `[userId, updatedAt]` and `[userId, lastUsedAt]`.
Add `@@index([userId, itemTypeId])` if the per-type list gets slow — the existing
single-column `[itemTypeId]` index isn't selective enough once one user has thousands
of items. That's a migration; defer until measured.

### ⚠️ The user-scoping fix this depends on

**Every existing helper in `lib/db/items.ts` and `lib/db/collections.ts` is hardcoded to
the demo user:**

```ts
where: { user: { email: DEMO_USER_EMAIL } }     // items.ts:73, 87, 134-136; collections.ts:42, 101, 114
```

The moment users can create items, that's a **cross-tenant data leak** — every signed-in
user would see the demo user's items on the dashboard. `getProfileStats(userId)`
([profile.ts:23](src/lib/db/profile.ts#L23)) already shows the right pattern.

**This is a prerequisite, not a nice-to-have.** Thread `userId` through every helper,
have callers pass `session.user.id`, and delete `DEMO_USER_EMAIL` from
[constants.ts:2](src/lib/constants.ts#L2) once the seed no longer needs it.

---

## Layer 4 — Type-specific logic in components

This is the **only** layer that knows a snippet differs from a link. Two small registries
drive it, so adding a type is a map entry rather than a new `if`.

```tsx
// src/components/items/item-form.tsx  — server component
const EDITORS = {
  text: TextEditor,   // snippet, prompt, command, note
  url:  UrlEditor,    // link
  file: FileEditor,   // file, image
} as const;

export function ItemForm({ type, item, collections }: ItemFormProps) {
  const Editor = EDITORS[TYPE_KIND[type.name]];
  const action = item ? updateItem : createItem;

  return (
    <form action={action} className="space-y-4">
      {item && <input type="hidden" name="id" value={item.id} />}
      <input type="hidden" name="typeName" value={type.name} />

      {/* shared for all 7 */}
      <TitleField defaultValue={item?.title} />
      <DescriptionField defaultValue={item?.description} />

      {/* the ONE type-specific slot */}
      <Editor item={item} type={type} />

      <TagsField defaultValue={item?.tags} />
      <CollectionsField options={collections} selected={item?.collectionIds} />

      <SubmitButton pendingText="Saving…">{item ? "Save" : "Create"}</SubmitButton>
    </form>
  );
}
```

Three editors cover seven types because the differences collapse onto **kind**:

| Editor | Types | Renders |
|---|---|---|
| `TextEditor` | snippet, prompt, command, note | `<textarea name="content">` + a `language` `<select>` **only** when `type.name === "snippet"` |
| `UrlEditor` | link | `<input type="url" name="url">` |
| `FileEditor` | file, image | Upload control → `fileUrl`/`fileName`/`fileSize` hidden fields; image shows a preview |

The single genuine within-kind difference is the language picker (snippet-only —
confirmed empirically: `language` is set on snippets and nothing else). One conditional,
inside the editor, is the right place for it.

Same registry idea for display, reusing `ItemCard`'s existing fallback chain:

```tsx
const PREVIEWS = { text: CodePreview, url: LinkPreview, file: FilePreview } as const;
```

---

## Component responsibilities

| Component | Client? | Owns | Must NOT |
|---|---|---|---|
| **`items/[type]/page.tsx`** | Server | Resolve slug → type, guard auth, fetch, compose | Contain markup for a specific type |
| **`ItemList`** | Server | Grid layout, empty state (copy varies by type name) | Fetch or mutate |
| **`ItemCard`** ✏️ | Server | Accent border, icon chip, title, preview, badges; links to the item | Know *how* to render a specific type — delegates to `PREVIEWS[kind]` |
| **`ItemToolbar`** | **Client** | Sort/filter selects, "New {type}" button | Hold item data; pushes to `searchParams` only |
| **`ItemForm`** | Server | Shared fields, picks editor by kind, wires the server action | Branch on `type.name` beyond the registry lookup |
| **`TextEditor` / `UrlEditor` / `FileEditor`** | Server (file: Client) | The type-specific inputs — **the designated home for type logic** | Call Prisma or import from `lib/db` |
| **`ItemDrawer`** | **Client** | Slide-over open/close, focus trap, Escape | Fetch — receives a fully-resolved item |
| **`ItemActions`** | **Client** | Favorite/pin toggles via server-action forms | Optimistic state that lies about failures |
| **`DeleteItemDialog`** | **Client** | Confirm before `deleteItem` | Delete directly — posts to the action |
| **`SubmitButton`** (exists) | **Client** | `useFormStatus` pending state | — |

Client islands stay small and leaf-level; pages stay server components. That's the
codebase's standing rule, and the memory note records it as explicit user feedback.

### The drawer needs the Sheet generalized first

[project-overview.md](context/project-overview.md) specifies items open in a slide-over
drawer. [components/ui/sheet.tsx](src/components/ui/sheet.tsx) exists but is
**sidebar-specific**: hardcoded `w-72`, and a `sr-only` title/description literally
reading *"Navigation"* / *"Browse item types and collections."*
([sheet.tsx:52-57](src/components/ui/sheet.tsx#L52-L57)).

Reusing it as-is would announce "Navigation" to screen readers when opening a snippet.
Lift `title`/`description` to props (defaulting to today's strings) and allow a width
override before building `ItemDrawer`.

---

## End-to-end flows

### Create

```
/items/snippets  →  "New snippet"  →  /items/snippets/new
                                        │  server component
                                        │  fetches type + user's collections
                                        ▼
                                      <ItemForm type={snippet} />
                                        │  action={createItem}
                                        ▼  POST FormData
                                      createItem()
                                        auth → Zod (kind refinement) → resolve typeId
                                        → prisma.item.create (tags connectOrCreate)
                                        → revalidatePath(/items/snippets, /dashboard)
                                        ▼
                                      redirect /items/snippets?created=<id>
                                        ▼
                                      list re-renders, success banner
```

### Update

Identical, plus a hidden `id`, and the ownership-scoped `updateMany` returning
`count === 0` → `notFound()`.

### Delete

`DeleteItemDialog` (client) confirms → posts `id` to `deleteItem` → `deleteMany({ id,
userId })` → cascades clear `TagsOnItems` and `ItemCollection` rows automatically
(both have `onDelete: Cascade`) → revalidate → `redirect(/items/{slug}?deleted=1)`.

### Feedback: banners, not toasts

[project-overview.md](context/project-overview.md) asks for toasts, but **no toast
library is installed** and the whole app signals success/failure through `searchParams`
banners rendered server-side ([sign-in/page.tsx:45-96](src/app/(auth)/sign-in/page.tsx#L45-L96)).
The rate-limiting feature already made this same call deliberately.

Stay consistent — `?created=`, `?deleted=1`, `?error=<msg>` — and revisit toasts as one
separate decision covering the whole app, not per-feature.

---

## Blocking prerequisites

In dependency order. The first two are not optional.

1. **User-scope the `lib/db` helpers.** Hardcoded `DEMO_USER_EMAIL` becomes a
   cross-tenant leak the moment real users own items. *(See [Layer 3](#layer-3--queries-srclibdbitemsts).)*
2. **Extend the proxy matcher** to `/items/:path*`. Currently unprotected.
3. **Decide the route group** — `src/app/(dashboard)/` — or item pages render with no sidebar.
4. **Generalize `sheet.tsx`** before building the drawer (a11y).
5. **Server-side Pro gating.** `PRO_TYPES` is UI-only
   ([sidebar-content.tsx:26](src/components/dashboard/sidebar-content.tsx#L26)); once
   `createItem` exists, a free user could POST `typeName: "file"` and bypass the badge.
   The check belongs in the action, keyed on `User.isPro` — plus the free-tier caps
   (50 items / 3 collections), which nothing enforces yet.
6. **R2 upload route** — file/image editors can't work without it. Build the 5 text/url
   types first; they need no new infrastructure.

---

## Key decisions & trade-offs

| Decision | Why | Cost |
|---|---|---|
| **One `actions/items.ts`** for all types | The write path is genuinely identical; 7 files would be 7 copies drifting apart | One file grows to ~250 lines. Acceptable; split only if it passes ~400 |
| **Type-specific logic in components only** | Rendering is where types actually differ; keeps the security-sensitive layer uniform and auditable | A new type touches the editor/preview registries — but that's one map entry each |
| **Kind registry (`text`/`url`/`file`)** over per-type maps | 7 types collapse to 3 behaviors; matches the schema's real structure | The snippet-only language picker needs one conditional inside `TextEditor` |
| **Server Actions, not API routes** | [coding-standards.md](context/coding-standards.md) reserves routes for webhooks/uploads/external clients. Item CRUD is none of those | A future mobile/CLI client needs routes added later — but they can call the same `lib/db` helpers |
| **`FormData` + `redirect`** | Preserves server-rendered pages with zero client JS in the core path | No inline field-level errors without `useActionState`; first error goes to a banner |
| **Ownership via `updateMany`/`deleteMany`** | Atomic; can't leak existence; no TOCTOU window | Returns a count rather than throwing — callers must check it |
| **`contentType` derived server-side** | Client can't corrupt the type↔field invariant | — |
| **Type immutable after create** | A note→file conversion has no sane field mapping | Users must delete + recreate to change type |
| **Banners over toasts** | Consistent with every existing flow; no dependency added | Diverges from the overview's spec until a global toast decision is made |
| **Explicit slug map** over `+ "s"` / `slice(-1)` | Rejects junk slugs cleanly; survives irregular custom types | Two places to update per new type |

---

## Suggested build order

Each step ships something usable.

1. **Prerequisites 1–3** — user scoping, proxy matcher, route group. No new UI; fixes a leak.
2. **Read-only `/items/[type]`** — `getItemsByType` + `ItemList` reusing `ItemCard`.
   The 7 dead sidebar links start working.
3. **Create + validate** — `lib/items/types.ts`, `validations/item.ts`, `createItem`,
   `ItemForm` + `TextEditor` + `UrlEditor`. Covers 5 of 7 types.
4. **Update + delete** — edit route, `DeleteItemDialog`, ownership-scoped mutations.
5. **Toggles + `touchItem`** — favorite/pin islands; `lastUsedAt` makes Recent honest.
6. **Drawer** — generalize `sheet.tsx`, then `ItemDrawer`.
7. **Pro gating + free-tier caps** — server-side, in the actions.
8. **R2 uploads → `FileEditor`** — completes file/image, the last 2 types.
