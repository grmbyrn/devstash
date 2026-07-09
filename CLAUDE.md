# DevStash

A developer knowledge hub for snippets, commands, prompts, notes, files, images, links and custom types.

## Context Files

Read the following to get the full context of the project:

- @context/project-overview.md
- @context/coding-standards.md
- @context/ai-interactions.md
- @context/current-feature.md

## Commands

```bash
npm run dev      # start dev server
npm run build    # production build
npm run lint     # run ESLint
npm start        # start production server
```

No test runner is configured yet.

## Stack

- **Next.js 16** / **React 19** / **TypeScript**
- **Tailwind CSS v4** (PostCSS plugin — no `tailwind.config.*`, configured via CSS `@theme`)
- App Router (`src/app/`)

## Neon MCP Usage

When using the Neon MCP server for any database operation in this project:

- **Project:** Always target the DevStash Neon project. Resolve it by name
  (`list_projects` → match "devstash") rather than assuming a project ID.
- **Branch:** Always use the **development** branch by default. Resolve it by
  name (`list_branches` → match "development") and pass its branch ID
  explicitly to every `run_sql` / connection-string call. Never rely on the
  Neon default branch, since the default is production.
- **Production is off-limits.** Never read from or write to the production
  branch unless I explicitly name "production" in the request for that specific
  task. Approval for one production action does NOT carry over to later ones.
- **Writes / DDL:** Even on the development branch, confirm with me before
  running anything that mutates data or schema (INSERT/UPDATE/DELETE/DROP/ALTER,
  migrations, branch resets). Plain SELECTs on development need no confirmation.
- **When unsure** which project or branch a request refers to, ask before
  running — do not guess.
