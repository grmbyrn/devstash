# DevStash — Project Overview

> **One fast, searchable, AI-enhanced hub for all dev knowledge & resources.**

---

## Table of Contents

1. [Problem](#problem)
2. [Target Users](#target-users)
3. [Tech Stack](#tech-stack)
4. [Data Models](#data-models)
5. [Item Types](#item-types)
6. [Features](#features)
7. [Monetization](#monetization)
8. [UI/UX Guidelines](#uiux-guidelines)
9. [Project Structure](#project-structure)
10. [Key Decisions & Constraints](#key-decisions--constraints)

---

## Problem

Developers scatter their essentials across too many tools:

| What | Where it lives |
|------|---------------|
| Code snippets | VS Code, Notion, GitHub Gists |
| AI prompts | ChatGPT/Claude history |
| Context files | Buried inside project folders |
| Useful links | Browser bookmarks |
| Documentation notes | Random folders |
| Commands | `.txt` files or bash history |
| Project templates | GitHub Gists |

This creates context switching, lost knowledge, and inconsistent workflows. DevStash fixes this.

---

## Target Users

| User Type | Core Need |
|-----------|-----------|
| **Everyday Developer** | Fast access to snippets, prompts, commands, links |
| **AI-first Developer** | Save prompts, contexts, workflows, system messages |
| **Content Creator / Educator** | Store code blocks, explanations, course notes |
| **Full-stack Builder** | Collect patterns, boilerplates, API examples |

---

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| **Framework** | Next.js 16 / React 19 | SSR + API routes in one repo |
| **Language** | TypeScript | Full type safety |
| **Database** | Neon (PostgreSQL) | Cloud-hosted |
| **ORM** | Prisma 7 | Latest — fetch fresh docs before use |
| **Auth** | NextAuth v5 | Email/password + GitHub OAuth |
| **File Storage** | Cloudflare R2 | For file & image uploads |
| **AI** | OpenAI `gpt-4o-mini` | Tagging, summaries, code explanation |
| **CSS** | Tailwind CSS v4 + shadcn/ui | Dark mode default |
| **Caching** | Redis | Optional — evaluate as needed |

> ⚠️ **DB Rule:** Never run `db push` in any environment. Always create and run explicit migrations.

---

## Data Models

### Prisma Schema

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── User ──────────────────────────────────────────────────────────────────

model User {
  id                    String       @id @default(cuid())
  name                  String?
  email                 String?      @unique
  emailVerified         DateTime?
  image                 String?
  isPro                 Boolean      @default(false)
  stripeCustomerId      String?      @unique
  stripeSubscriptionId  String?      @unique
  createdAt             DateTime     @default(now())
  updatedAt             DateTime     @updatedAt

  accounts     Account[]
  sessions     Session[]
  items        Item[]
  collections  Collection[]
  itemTypes    ItemType[]   // custom types only (isSystem = false)
}

// ─── NextAuth Models ───────────────────────────────────────────────────────

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ─── Item ──────────────────────────────────────────────────────────────────

model Item {
  id          String      @id @default(cuid())
  title       String
  contentType ContentType // TEXT | FILE
  content     String?     // text content; null if file
  fileUrl     String?     // Cloudflare R2 URL; null if text
  fileName    String?     // original filename
  fileSize    Int?        // bytes
  url         String?     // for link-type items
  description String?
  isFavorite  Boolean     @default(false)
  isPinned    Boolean     @default(false)
  language    String?     // e.g. "typescript", "python" — for syntax highlighting
  lastUsedAt  DateTime?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  userId     String
  itemTypeId String

  user        User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  itemType    ItemType          @relation(fields: [itemTypeId], references: [id])
  tags        TagsOnItems[]
  collections ItemCollection[]
}

enum ContentType {
  TEXT
  FILE
}

// ─── ItemType ──────────────────────────────────────────────────────────────

model ItemType {
  id       String  @id @default(cuid())
  name     String  // e.g. "snippet", "prompt", "command"
  icon     String  // Lucide icon name e.g. "Code", "Sparkles"
  color    String  // hex e.g. "#3b82f6"
  isSystem Boolean @default(false)
  userId   String? // null for system types; set for custom user types

  user  User?  @relation(fields: [userId], references: [id], onDelete: Cascade)
  items Item[]

  @@unique([name, userId]) // prevent duplicate names per user
}

// ─── Collection ────────────────────────────────────────────────────────────

model Collection {
  id            String   @id @default(cuid())
  name          String
  description   String?
  isFavorite    Boolean  @default(false)
  defaultTypeId String?  // suggested type for new items in this collection
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  userId String

  user  User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  items ItemCollection[]
}

// ─── ItemCollection (join table) ───────────────────────────────────────────

model ItemCollection {
  itemId       String
  collectionId String
  addedAt      DateTime @default(now())

  item       Item       @relation(fields: [itemId], references: [id], onDelete: Cascade)
  collection Collection @relation(fields: [collectionId], references: [id], onDelete: Cascade)

  @@id([itemId, collectionId])
}

// ─── Tag ───────────────────────────────────────────────────────────────────

model Tag {
  id    String        @id @default(cuid())
  name  String        @unique
  items TagsOnItems[]
}

model TagsOnItems {
  itemId String
  tagId  String

  item Item @relation(fields: [itemId], references: [id], onDelete: Cascade)
  tag  Tag  @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([itemId, tagId])
}
```

---

## Item Types

System types are seeded on first run and cannot be modified by users.

| Type | Icon | Color | URL Path | Content Kind |
|------|------|-------|----------|--------------|
| **Snippet** | `Code` | `#3b82f6` (blue) | `/items/snippets` | Text |
| **Prompt** | `Sparkles` | `#8b5cf6` (purple) | `/items/prompts` | Text |
| **Command** | `Terminal` | `#f97316` (orange) | `/items/commands` | Text |
| **Note** | `StickyNote` | `#fde047` (yellow) | `/items/notes` | Text |
| **Link** | `Link` | `#10b981` (emerald) | `/items/links` | URL |
| **File** ⭐ | `File` | `#6b7280` (gray) | `/items/files` | File upload |
| **Image** ⭐ | `Image` | `#ec4899` (pink) | `/items/images` | File upload |

> ⭐ = Pro only in production. All types available during development.

### Seed Script (System Types)

```typescript
// prisma/seed.ts
const systemTypes = [
  { name: "snippet", icon: "Code",       color: "#3b82f6", isSystem: true },
  { name: "prompt",  icon: "Sparkles",   color: "#8b5cf6", isSystem: true },
  { name: "command", icon: "Terminal",   color: "#f97316", isSystem: true },
  { name: "note",    icon: "StickyNote", color: "#fde047", isSystem: true },
  { name: "link",    icon: "Link",       color: "#10b981", isSystem: true },
  { name: "file",    icon: "File",       color: "#6b7280", isSystem: true },
  { name: "image",   icon: "Image",      color: "#ec4899", isSystem: true },
];
```

---

## Features

### Core

- **Items** — Create, edit, delete items of any type. Open in a slide-over drawer for quick access without losing context.
- **Collections** — Group items into named collections. Items can belong to multiple collections simultaneously (e.g., a React snippet in both "React Patterns" and "Interview Prep").
- **Search** — Full-text search across title, content, tags, and type.
- **Tags** — Add tags to items; used for filtering and AI auto-suggestion.
- **Favorites** — Star collections and items.
- **Pinned Items** — Pin items to the top of any view.
- **Recently Used** — Track `lastUsedAt` on items; surface in a "Recent" view.

### Item Features

- Markdown editor for text-type items (snippet, prompt, note, command)
- Syntax highlighting for code blocks (detect from `language` field)
- Link previews for link-type items
- File upload for file/image types (stored in Cloudflare R2)
- Import code directly from a file
- View which collections an item belongs to
- Add/remove items to/from multiple collections

### Data Management

- Export data as JSON or ZIP archive (Pro)

### AI Features (Pro — disabled in dev)

| Feature | Description |
|---------|-------------|
| **Auto-tag** | Suggest relevant tags when saving an item |
| **Summarize** | Generate a one-line summary of a snippet or note |
| **Explain Code** | Plain-English explanation of any code snippet |
| **Prompt Optimizer** | Rewrite a prompt for clarity and effectiveness |

Model: `gpt-4o-mini` via OpenAI API.

---

## Monetization

> During development, treat all users as Pro.

### Free Tier

- 50 items total
- 3 collections
- All system types **except** File & Image
- Basic search
- No file/image uploads
- No AI features

### Pro — $8/month or $72/year

- Unlimited items & collections
- File & Image uploads (Cloudflare R2)
- Custom item types *(coming later)*
- All AI features
- Export as JSON/ZIP
- Priority support

**Implementation:** `User.isPro` boolean + Stripe `customerId` / `subscriptionId`. Gate features server-side in API routes and middleware. Surface upgrade prompts in the UI when free limits are hit.

---

## UI/UX Guidelines

### Principles

- **Developer-focused** — dark mode default, light mode available
- **References:** Notion (content feel), Linear (speed & keyboard nav), Raycast (command palette UX)
- Clean typography, generous whitespace, subtle borders and shadows
- Syntax highlighting on all code blocks

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  Sidebar (collapsible)      │  Main Content             │
│                             │                           │
│  Item Types                 │  Collections Grid         │
│  ├ Snippets                 │  ┌──────┐ ┌──────┐       │
│  ├ Prompts                  │  │ 🟦   │ │ 🟪   │       │
│  ├ Commands                 │  │React │ │Prompt│       │
│  ├ Notes                    │  │Patt. │ │s     │       │
│  ├ Links                    │  └──────┘ └──────┘       │
│  ├ Files                    │                           │
│  └ Images                   │  Items (color-coded)      │
│                             │  ┌────────────────────┐   │
│  Collections (latest)       │  │ 🟦 useDebounce hook │   │
│  ├ React Patterns           │  └────────────────────┘   │
│  ├ Interview Prep           │                           │
│  └ Python Snippets          │                           │
└─────────────────────────────────────────────────────────┘
                           ↕
              Item clicks open in a slide-over drawer
```

- **Collection cards** — background color derived from the most common item type in that collection.
- **Item cards** — color-coded left border matching their item type color.
- **Sidebar** — collapses to icon rail on smaller screens; becomes a full drawer on mobile.

### Micro-interactions

- Smooth drawer transitions (slide-in/out)
- Hover states on cards (subtle lift/shadow)
- Toast notifications for all create/update/delete actions
- Loading skeletons while data fetches

### Responsive

- Desktop-first layout
- Sidebar → icon rail at medium breakpoints
- Sidebar → full-width bottom sheet drawer on mobile

---

## Project Structure

```
devstash/
├── app/                        # Next.js App Router
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/
│   │   ├── layout.tsx          # Sidebar + main shell
│   │   ├── page.tsx            # Home / recent items
│   │   ├── items/
│   │   │   └── [type]/         # /items/snippets, /items/prompts, etc.
│   │   ├── collections/
│   │   │   └── [id]/
│   │   └── search/
│   └── api/
│       ├── auth/[...nextauth]/
│       ├── items/
│       ├── collections/
│       ├── tags/
│       ├── upload/             # R2 file upload handler
│       ├── export/             # JSON/ZIP export
│       └── ai/                 # AI feature endpoints
│           ├── tag/
│           ├── summarize/
│           ├── explain/
│           └── optimize-prompt/
├── components/
│   ├── ui/                     # shadcn/ui primitives
│   ├── item-drawer.tsx         # Quick-access slide-over
│   ├── item-card.tsx
│   ├── collection-card.tsx
│   ├── sidebar.tsx
│   └── search-bar.tsx
├── lib/
│   ├── prisma.ts               # Prisma client singleton
│   ├── auth.ts                 # NextAuth config
│   ├── r2.ts                   # Cloudflare R2 client
│   ├── openai.ts               # OpenAI client
│   └── utils.ts
├── prisma/
│   ├── schema.prisma
│   ├── migrations/             # All migrations go here
│   └── seed.ts                 # System item types
└── types/
    └── index.ts
```

---

## Key Decisions & Constraints

| Topic | Decision |
|-------|----------|
| **Migrations** | Always write explicit migration files. Never use `prisma db push`. |
| **Auth** | NextAuth v5 — email/password + GitHub OAuth |
| **File storage** | Cloudflare R2 (S3-compatible). Store URL in `Item.fileUrl`. |
| **AI gating** | All AI features are Pro-only. During dev, bypass the check. |
| **Custom types** | Planned for Pro but not in v1. Scaffold the `isSystem` flag now. |
| **Item–Collection** | Many-to-many via `ItemCollection` join table. One item can live in many collections. |
| **Tags** | Global tag table (not per-user). Tags are reusable across users. |
| **Prisma version** | Prisma 7 — pull fresh docs before implementing; APIs may differ from v5/v6. |
| **AI model** | `gpt-4o-mini` — fast and cheap for tagging/explanation tasks. |
| **Dark mode** | Default. Use `dark` class strategy with Tailwind. |
| **Syntax highlighting** | Use `shiki` or `highlight.js` — driven by `Item.language` field. |

---

*Last updated: May 2026*
