# AI Interaction Guidelines

## Communication

- Be concise and direct
- Explain non-obvious decisions briefly
- Ask before large refactors or architectural changes
- Don't add features not in the project spec
- Never delete files without clarification

## Workflow

This is the common workflow that we will use for every single feature/fix:

1. **Document** - Document the feature in @context/current-feature.md.
2. **Branch** - Create new branch for feature, fix, etc
3. **Implement** - Implement the feature/fix that I create in @context/current-feature.md
4. **Test** - Write/update unit tests for any server action or utility the feature touches, then run `npm test`. Verify it works in the browser. Run `npm run build` and fix any errors
5. **Iterate** - Iterate and change things if needed
6. **Commit** - Only after build passes and everything works
7. **Merge** - Merge to main
8. **Delete Branch** - Delete branch after merge
9. **Review** - Review AI-generated code periodically and on demand.
10. Mark as completed in @context/current-feature.md and add to history

Do NOT commit without permission and until the tests and build pass. If either fails, fix the issues first.

## Testing

Unit tests run on **Vitest** (`vitest.config.ts`, node environment).

```bash
npm test            # run once
npm run test:watch  # watch mode
npm run test:coverage
```

### Scope

- **In scope:** server actions (`src/actions/`), utilities/helpers (`src/lib/`) and API route handlers (`src/app/api/**/route.ts`) — validation, auth/token logic, rate limiting, redirect targets, anything with branching or a security rule.
- **Out of scope:** React components and pages. There is no jsdom/React setup; UI is verified in the browser as part of step 4 of the workflow.
- Thin Prisma query wrappers (`src/lib/db/`) and email templates are skipped by default — they're mostly I/O with no logic of their own. Two exceptions earn tests: a wrapper that **maps or reshapes** rows (e.g. `getItemById` serializing dates for the wire), and one whose `where` clause carries a **security rule** — every user-scoped read is guarded in `src/lib/db/scoping.test.ts`, so a query that loses its `userId` fails the suite rather than quietly showing one account another's data.

### Conventions

- Tests live next to the code as `*.test.ts` (e.g. `src/lib/auth/register.test.ts`).
- **Never touch the real database, Redis, or email.** Mock `@/lib/prisma` with the shared `prismaMock` from `src/test/prisma-mock.ts` and stub the outbound email module.
- Server actions signal their result by redirecting, so assert on the URL with `captureRedirect` from `src/test/redirect.ts`.
- Vitest doesn't load `.env`; `vitest.setup.ts` supplies placeholder env. Use `vi.stubEnv` for anything a test depends on, and `vi.unstubAllEnvs()` in an `afterEach`.
- Test the behaviour that matters (a password is hashed, an expired token is refused, an unknown email gets the same answer as a known one) — not implementation detail.
- API routes: mock `@/auth` wholesale (its `next-auth` import will not resolve outside the Next runtime) and mock the `src/lib/db` helper the route calls, then import the handler and assert on the `Response` — status plus parsed body.
- **Coverage does not count API routes.** The v8 provider omits a route module a test actually executed and reports an unexecuted one as 0%, so `coverage.include` deliberately lists only `src/actions` and `src/lib`. A route showing no coverage is not evidence it is untested — check for a `route.test.ts` beside it.

## Branching

We will create a new branch for every feature/fix. Name branch **feature/[feature]** or **fix[fix]**, etc. Ask to delete the branch once merged.

## Commits

- Ask before committing (don't auto-commit)
- Use conventional commit messages (feat:, fix:, chore:, etc.)
- Keep commits focused (one feature/fix per commit)
- Never put "Generated With Claude" in the commit messages

## When Stuck

- If something isn't working after 2-3 attempts, stop and explain the issue
- Don't keep trying random fixes
- Ask for clarification if requirements are unclear

## Code Changes

- Make minimal changes to accomplish the task
- Don't refactor unrelated code unless asked
- Don't add "nice to have" features
- Preserve existing patterns in the codebase

## Code Review

Review AI-generated code periodically, especially for:

- Security (auth checks, input validation)
- Performance (unnecessary re-renders, N+1 queries)
- Logic errors (edge cases)
- Patterns (matches existing codebase?)
