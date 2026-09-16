# DevStash

One fast, searchable hub for everything a developer scatters across too many tools — code snippets, AI prompts, shell commands, notes, links, files and images — stored as typed **items**, grouped into **collections**, and tagged.

Built with Next.js 16 (App Router), React 19, TypeScript, Prisma 7 against Neon Postgres, NextAuth v5 and Tailwind CSS v4.

---

## Table of contents

- [Project status](#project-status)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [How it works](#how-it-works)
- [Routes](#routes)
- [Project structure](#project-structure)
- [Database](#database)
- [Testing](#testing)
- [Conventions](#conventions)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## Project status

DevStash is a work in progress. Authentication and the read-only dashboard are complete; item authoring is not yet built.

**Working today**

- Full auth: email/password sign-in, registration, GitHub OAuth, email verification (toggleable), forgot/reset password, sign out
- Rate limiting on every auth entry point (Upstash Redis, fails open)
- Dashboard shell — collapsible sidebar, stats, recent collections, pinned items, recent items — all reading live data from Postgres
- Items list per type at `/items/[type]`
- Profile page with usage stats, change password and delete account

**Not built yet**

- Creating, editing or deleting items (the database and seed data exist; there is no UI or API for authoring)
- `/collections` and `/collections/[id]` — the sidebar and collection cards already link here, so those links 404
- Search, file/image upload to R2, AI features, Stripe billing and export

Free vs. Pro tiers are modelled in the schema (`User.isPro`) but not enforced — during development every user is treated as Pro. The **PRO** badges beside Files and Images in the sidebar are labels only.

---

## Requirements

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 20.9 | Required by Next.js 16 |
| npm | 10+ | Ships with Node 20 |
| PostgreSQL | — | A [Neon](https://neon.tech) project is expected; any Postgres 14+ works |

Optional third-party services. The app runs without them, with the noted degradation:

| Service | Used for | Without it |
|---------|----------|------------|
| [Resend](https://resend.com) | Verification and password-reset emails | Leave email verification off; password reset will fail at send time |
| [Upstash Redis](https://upstash.com) | Auth rate limiting | Rate limiting fails **open** — all requests allowed |
| [GitHub OAuth app](https://github.com/settings/developers) | "Sign in with GitHub" | Use email/password instead |

---

## Quick start

```bash
git clone <repo-url> devstash
cd devstash
npm install

cp .env.example .env         # then fill in DATABASE_URL and AUTH_SECRET
openssl rand -base64 33      # paste the result into AUTH_SECRET

npm run db:generate          # generate the Prisma client
npm run db:migrate           # apply migrations to your database
npm run db:seed              # demo user + system types + sample data

npm run dev
```

Open <http://localhost:3000/sign-in> and sign in with the seeded account:

```
email:    demo@devstash.io
password: 12345678
```

The dashboard at `/dashboard` is populated with 5 collections and 18 items belonging to that demo user.

At minimum you need `DATABASE_URL` and `AUTH_SECRET`. Everything else can stay empty for local development.

> **`npm run db:generate` is not optional.** The Prisma client is generated into `src/generated/prisma`, which is gitignored, and there is no `postinstall` hook. A fresh clone will not typecheck or build until you run it.

---

## Environment variables

Copy `.env.example` to `.env`. Every variable is listed below; the file itself carries the same notes inline.

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Postgres connection string, e.g. `postgresql://user:pass@host/db?sslmode=require`. Point this at your Neon **development** branch locally. |
| `AUTH_SECRET` | Signs NextAuth JWTs. Generate with `openssl rand -base64 33` (or `npx auth secret`, which writes it into `.env` for you). |

### GitHub OAuth (optional)

| Variable | Description |
|----------|-------------|
| `AUTH_GITHUB_ID` | OAuth app client ID |
| `AUTH_GITHUB_SECRET` | OAuth app client secret |

Callback URL for the OAuth app: `http://localhost:3000/api/auth/callback/github`.

`AUTH_SECRET`, `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET` are read by NextAuth directly from the environment — you will not find them referenced in application code.

### Email (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `RESEND_API_KEY` | — | Resend API key. Read when the module loads, used only at send time. |
| `EMAIL_FROM` | `DevStash <onboarding@resend.dev>` | Sender address. The sandbox default only delivers to your own Resend account address; real delivery needs a verified domain. |
| `APP_URL` | `http://localhost:3000` | Base URL used to build absolute links inside emails. Falls back to `AUTH_URL`. |
| `EMAIL_VERIFICATION_ENABLED` | `false` | Master switch for the verification flow. |

`EMAIL_VERIFICATION_ENABLED` is **off unless set to exactly `"true"`**. That default is deliberate: a deploy without a verified sender domain can never lock users out of their own accounts. When off, registration stamps `emailVerified` immediately and no mail is sent. Turn it on only where a real sender is configured.

### Rate limiting (optional)

| Variable | Description |
|----------|-------------|
| `UPSTASH_REDIS_REST_URL` | From Upstash console → your Redis database → REST API |
| `UPSTASH_REDIS_REST_TOKEN` | Same place |

If either is unset, rate limiting **fails open** and allows every request. It also fails open if a Redis call throws, so an outage can't lock people out.

---

## Scripts

```bash
npm run dev            # dev server on :3000
npm run build          # production build
npm start              # serve the production build
npm run lint           # ESLint

npm test               # run the unit tests once
npm run test:watch     # watch mode
npm run test:coverage  # coverage report (src/actions + src/lib)

npm run db:generate    # regenerate the Prisma client into src/generated/prisma
npm run db:migrate     # create + apply a migration (development)
npm run db:deploy      # apply pending migrations (production)
npm run db:seed        # seed demo user, system types and sample data
npm run db:studio      # Prisma Studio
```

---

## How it works

**Server-first rendering.** Pages under `src/app/` are server components that query Prisma directly. Mutations go through Server Actions in `src/actions/`. Interactivity is confined to small client islands — the sidebar state provider, the account menu, the submit button's pending state, the delete-account confirmation field. API routes are reserved for things Server Actions can't do: `POST /api/auth/register` exists for future external clients, and `/api/auth/[...nextauth]` is NextAuth's own handler.

**Auth.** NextAuth v5 with the split-config pattern: `src/auth.config.ts` holds the edge-safe base (providers only, no adapter) so middleware can import it; `src/auth.ts` builds the full instance with the Prisma adapter and the real credentials `authorize`. Sessions use the JWT strategy, which means the cookie carries the user id and is trusted without a database read — so pages that load user-owned data call `requireUser()` from `src/lib/auth/session.ts`, which confirms the row still exists and bounces stale sessions (a session otherwise outlives a deleted account). `src/proxy.ts` guards `/dashboard`, `/items` and `/profile` at the edge.

**Tokens.** Verification and password-reset links both mint a 32-byte random value that is emailed in the URL but stored only as its SHA-256 hash, so a database leak yields no usable link. Verification tokens live 24h; reset tokens live 1h and are single-use, burned in the same transaction that changes the password. Both share the `VerificationToken` table, kept apart by a `password-reset:{email}` identifier namespace so neither flow can consume or clobber the other's token.

**Passwords** are bcrypt with 12 rounds everywhere — seed, registration and change-password alike.

**Anti-enumeration.** The forgot-password form always lands on the same confirmation page whether or not the address exists, and only issues a link for accounts that actually have a password (OAuth-only users have nothing to reset).

**Data access** lives in `src/lib/db/`. Note an inconsistency worth knowing before you add pages: `profile.ts` and `getItemsByType` are scoped to the signed-in `session.user.id`, while the older dashboard and collection helpers are still hardcoded to the seeded `DEMO_USER_EMAIL` (`src/lib/constants.ts`). So a non-demo account sees the demo user's dashboard but its own — empty — items list. Migrating the remaining helpers to session scope is a known follow-up.

---

## Routes

| Path | Auth | Description |
|------|------|-------------|
| `/` | public | Placeholder landing page |
| `/sign-in` | public | Email/password + GitHub, with banners for verification, reset and rate-limit states |
| `/register` | public | Create an account |
| `/forgot-password` | public | Request a reset link |
| `/reset-password` | public | Set a new password from an emailed token |
| `/verify-email` | public | Consume a verification token |
| `/dashboard` | required | Stats, recent collections, pinned and recent items |
| `/items/[type]` | required | One page per system type: `snippets`, `prompts`, `commands`, `notes`, `links`, `files`, `images`. Unknown slugs 404. |
| `/profile` | required | Usage stats, change password, delete account |
| `/api/auth/[...nextauth]` | — | NextAuth handler |
| `/api/auth/register` | public | JSON registration endpoint; returns `{ success, data, error }`, 429 with `Retry-After` when rate limited |

Item types are stored singular (`snippet`) but routed and labelled plural (`/items/snippets`, "Snippets"). `src/lib/item-types.ts` is the single source of that mapping — use it rather than hand-rolling the pluralization.

---

## Project structure

```
src/
├── app/
│   ├── (auth)/              # sign-in, register, forgot/reset password, verify-email
│   ├── (dashboard)/         # sidebar + header shell
│   │   ├── dashboard/       # → /dashboard
│   │   └── items/[type]/    # → /items/snippets, /items/prompts, …
│   ├── profile/
│   └── api/auth/
├── actions/                 # Server Actions (auth.ts, profile.ts)
├── components/
│   ├── ui/                  # shadcn/ui primitives
│   ├── auth/ dashboard/ profile/
├── lib/
│   ├── auth/                # register, verification, password-reset, session guard
│   ├── db/                  # Prisma query helpers
│   ├── email/               # Resend client + templates
│   ├── validations/         # Zod schemas
│   ├── item-types.ts        # slug ↔ label mapping
│   ├── rate-limit.ts
│   └── prisma.ts            # client singleton
├── test/                    # shared mocks (prisma-mock, redirect)
├── auth.ts / auth.config.ts
└── proxy.ts                 # route protection

prisma/
├── schema.prisma
├── migrations/
└── seed.ts

context/                     # project spec, standards, per-feature specs, history
docs/                        # architecture notes and audit results
```

The route groups `(auth)` and `(dashboard)` don't appear in URLs — they exist to attach different layouts. `/dashboard` and `/items/*` both live under `(dashboard)` so they share the sidebar shell.

---

## Database

Prisma 7 with the `prisma-client` generator. Two details differ from older Prisma setups:

- The client is generated to **`src/generated/prisma`** (gitignored), not `node_modules/.prisma`. Import from `@/generated/prisma/client`.
- The datasource URL lives in **`prisma.config.ts`**, not in `schema.prisma`.

**Never run `prisma db push`** — in any environment. Schema changes always go through an explicit migration:

```bash
npm run db:migrate -- --name add_something
npx prisma migrate status    # verify in sync before committing
```

Core models: `User`, `Item`, `ItemType`, `Collection`, `ItemCollection` (many-to-many join, so one item can live in several collections), `Tag`, `TagsOnItems`, plus the NextAuth `Account` / `Session` / `VerificationToken` tables. Seven system item types (snippet, prompt, command, note, link, file, image) are seeded on first run.

`npm run db:seed` is idempotent — safe to re-run. It creates the demo user, the system types, and 5 collections / 18 items.

### Working with Neon

This project uses a Neon **development** branch for local work and a separate production branch. Point `DATABASE_URL` at development; never run migrations, writes or resets against production unless that is explicitly what you intend.

---

## Testing

Vitest, node environment, no jsdom. **111 tests across 8 files.**

```bash
npm test
```

- **In scope:** Server Actions (`src/actions/`) and utilities (`src/lib/`) — validation, token logic, rate limiting, redirect targets, anything with branching or a security rule.
- **Out of scope:** React components and pages. There is no React test setup; UI is verified in a browser.
- Thin Prisma wrappers (`src/lib/db/`) and email templates are skipped — I/O with no logic of their own.

Conventions worth knowing before you add tests:

- Tests sit beside the code as `*.test.ts`.
- **Never touch the real database, Redis or email.** Mock `@/lib/prisma` with `prismaMock` from `src/test/prisma-mock.ts`.
- Server Actions signal their result by redirecting, so assert on the URL with `captureRedirect` from `src/test/redirect.ts`.
- Vitest does not load `.env`; `vitest.setup.ts` supplies placeholder values and deletes the Upstash vars so rate limiting fails open by default. Use `vi.stubEnv` for anything a test depends on and `vi.unstubAllEnvs()` in an `afterEach` — env stubs are not auto-restored.

---

## Conventions

- **TypeScript strict.** No `any` — use `unknown` and narrow.
- **Server components by default.** Add `'use client'` only for interactivity, hooks or browser APIs, and keep those components small.
- **Server Actions for mutations.** API routes only for webhooks, uploads with progress, long-running work, specific status codes, or endpoints meant for external clients.
- **Validate every input with Zod** (`src/lib/validations/`).
- **Return `{ success, data, error }`** from actions; surface failures as user-visible messages.
- **Tailwind CSS v4** — CSS-based config via the `@theme` directive in `src/app/globals.css`. There is no `tailwind.config.*` and adding one would be a v3 regression.
- **Dark mode first**, light mode as an option.
- Components in PascalCase; functions camelCase; constants SCREAMING_SNAKE_CASE.
- Conventional commits (`feat:`, `fix:`, `chore:`), one concern per commit. Work on a branch, not `main`.

The full workflow — document the feature in `context/current-feature.md`, branch, implement, test, build, commit, merge — is written up in `context/ai-interaction.md`, alongside the coding standards in `context/coding-standards.md` and the product spec in `context/project-overview.md`. `context/current-feature.md` also carries a dated history of every shipped feature, which is the fastest way to understand why something is the way it is.

---

## Deployment

1. Set every required environment variable in the hosting platform, with `DATABASE_URL` pointing at the production database and a **fresh** `AUTH_SECRET` (don't reuse the development one).
2. Set `APP_URL` to the deployed origin, or verification and reset links will point at `localhost`.
3. Run `npm run db:deploy` **before** the app starts — `prisma migrate deploy` applies pending migrations without prompting.
4. `npm run build` runs `next build`; the Prisma client must already be generated, so ensure `npm run db:generate` is part of the build command.
5. Leave `EMAIL_VERIFICATION_ENABLED` unset until a Resend-verified sender domain is configured. Turning it on without one locks new users out.
6. Set the Upstash variables in production. Without them, auth rate limiting is silently inactive.
7. Add the production callback URL (`https://your-domain/api/auth/callback/github`) to the GitHub OAuth app.

---

## Troubleshooting

**`Cannot find module '@/generated/prisma/client'`** — run `npm run db:generate`. The generated client is gitignored and there is no postinstall hook.

**Emails never arrive** — the default sender `onboarding@resend.dev` is Resend's sandbox and only delivers to the email address on your own Resend account. Set `EMAIL_FROM` to an address on a verified domain for anything else.

**Registered but can't sign in** — if `EMAIL_VERIFICATION_ENABLED="true"`, the account is unverified until the emailed link is clicked. The sign-in page shows an amber banner with a resend button. Set the variable to `false` to bypass the flow entirely in development.

**Rate limiting doesn't seem to do anything** — that's the unconfigured path. Set both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`; with either missing it fails open by design.

**Signed in, but the dashboard shows someone else's data** — expected for now. The dashboard helpers still read the seeded demo user while `/items` and `/profile` are session-scoped. See [How it works](#how-it-works).

**Clicking a collection 404s** — `/collections` isn't built yet. The links are already in place for when it is.
