// The seeded demo account. Only `prisma/seed.ts` uses this now — every query
// under `src/lib/db/` is scoped to the signed-in user id.
export const DEMO_USER_EMAIL = "demo@devstash.io";

// How many recent collections the dashboard fetches. The sidebar renders a
// subset of these; sharing the limit lets both callers hit the same cached
// query (see getRecentCollections) instead of issuing two DB round trips.
export const RECENT_COLLECTIONS_LIMIT = 6;
