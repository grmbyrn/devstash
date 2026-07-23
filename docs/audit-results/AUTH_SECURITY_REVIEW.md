# Auth Security Review — DevStash

**Last audited:** 2026-07-23
**Scope:** NextAuth v5 setup, credentials + GitHub providers, email verification, forgot/reset password, registration, profile (change password, delete account). Excludes framework-handled concerns (CSRF, cookie flags/signing, OAuth `state`/PKCE, JWT cookie format).
**Files reviewed:** 14 — `src/auth.ts`, `src/auth.config.ts`, `src/proxy.ts`, `src/lib/auth/{verification,password-reset,register}.ts`, `src/lib/email/{client,verification,password-reset}.ts`, `src/actions/{auth,profile}.ts`, `src/lib/validations/auth.ts`, `src/app/api/auth/register/route.ts`, `src/app/profile/page.tsx`, plus `prisma/schema.prisma` and `.gitignore`.

## Summary

The auth implementation is solid where it matters most: token generation, at-rest token hashing, single-use/expiry enforcement, password hashing, and session-scoped mutations are all done correctly, so there are **no Critical findings and no auth-bypass / IDOR / token-forgery issues**. The real gaps are systemic hardening that lives in application code and that NextAuth does not provide: there is **no rate limiting / anti-automation** anywhere (1 High), and **password reset/change does not revoke existing JWT sessions** (1 Medium). Three Low items (email case handling, no max password length, residual enumeration side-channels) round it out.

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 1 |
| Medium   | 1 |
| Low      | 3 |

## Findings

### [HIGH] No rate limiting or anti-automation on any credential/email endpoint
- **Location:** `src/auth.ts:21` (`authorize`), `src/lib/auth/register.ts:23` (`registerUser`), `src/actions/auth.ts:65` (`resendVerification`), `src/actions/auth.ts` `requestPasswordReset`
- **Issue:** None of the credential-accepting or email-sending paths are throttled. `authorize` runs an unlimited number of email+`bcrypt.compare` attempts; registration, `requestPasswordReset`, and `resendVerification` can be called without limit.
- **Impact / exploit:** Online brute-force / credential stuffing against sign-in (bcrypt cost 12 slows but does not prevent guessing weak passwords; there is no account lockout or backoff). The email paths enable abuse: mailbox-bombing a victim and mass token generation against the `VerificationToken` table. NextAuth v5 does **not** rate-limit credential attempts or email sends — this is the application's responsibility.
- **Fix:** Add IP- and account-keyed rate limiting in front of these entry points — e.g. a middleware/util backed by Upstash Redis (`@upstash/ratelimit`) or an in-memory limiter for single-instance dev, applied in `authorize` (per email + per IP), the register action/route, and the reset/resend actions. Pair sign-in throttling with exponential backoff or a temporary lockout after N failures. Reported once as a systemic gap rather than per-endpoint.
- **Confidence / verification:** Confirmed by reading each handler — no limiter import or call exists. Cross-checked Auth.js docs: rate limiting is explicitly out of scope for the library and left to the app.

### [MEDIUM] Password reset and change do not revoke existing sessions
- **Location:** `src/auth.ts:64` (`jwt`/`session` callbacks), `src/lib/auth/password-reset.ts:96` (`resetUserPassword`), `src/actions/profile.ts:15` (`changePassword`)
- **Issue:** Sessions use the stateless JWT strategy, and the `jwt` callback only stamps `token.id` at initial sign-in. Changing or resetting the password updates `User.password` but nothing invalidates already-issued JWTs, and there is no session-version / `passwordChangedAt` check on subsequent requests.
- **Impact / exploit:** A core purpose of password reset is to evict an attacker who already controls the account. Here, an attacker holding a valid session cookie keeps access after the victim resets the password, until the JWT naturally expires. Same for change-password. (Related: after `deleteAccount`, a lingering JWT on another device still presents as authenticated until expiry — the local cookie is cleared but others are not.)
- **Fix:** Add a `passwordChangedAt` (or monotonically increasing `sessionVersion`) column to `User`; put it in the JWT at sign-in; in the `jwt`/`session` callback (or a lightweight DB check) reject tokens issued before the latest change. Bump it in `resetUserPassword` and `changePassword`. This is app logic NextAuth intentionally leaves to you via the callback hooks — not something it does automatically.
- **Confidence / verification:** Confirmed the `jwt` callback (`src/auth.ts:64-78`) performs no invalidation check and neither password-writing path touches session state. This is a known, documented consequence of the JWT session strategy.

### [LOW] Case-sensitive email handling allows near-duplicate accounts
- **Location:** `src/lib/auth/register.ts:35` (`findUnique({ where: { email } })`), `src/auth.ts:26` (`authorize` lookup)
- **Issue:** Emails are stored and matched exactly as entered; there is no normalization (`.toLowerCase().trim()`) on register or sign-in. `@@unique` on `email` is likewise case-sensitive at the DB level.
- **Impact / exploit:** `User@x.com` and `user@x.com` can both register as separate accounts; a user who signs up lowercase but later types mixed-case can fail to sign in or land on a different account. Not directly exploitable, but a real auth-confusion / data-integrity issue and a foundation for future bugs.
- **Fix:** Normalize email to lowercase (and trim) in `registerUser`, `authorize`, `requestPasswordReset`, and `resendVerification` before any DB lookup or write, so one address maps to exactly one account.
- **Confidence / verification:** Confirmed no normalization in any lookup path; consistent with the "case-sensitive email" note already recorded in project history.

### [LOW] No maximum password length; bcrypt silently truncates at 72 bytes
- **Location:** `src/lib/validations/auth.ts` (`registerSchema`, `resetPasswordSchema`, `changePasswordSchema` — `password`/`newPassword` are `min(8)` with no `max`)
- **Issue:** bcrypt only hashes the first 72 bytes of input. With no upper bound, a passphrase longer than 72 bytes is silently truncated, so trailing characters contribute nothing.
- **Impact / exploit:** Largely informational — it can subtly weaken very long passwords and surprise users. Also lets arbitrarily large inputs reach the hasher (minor DoS surface, bounded by body limits).
- **Fix:** Add `.max(72)` (or pre-hash with SHA-256 then bcrypt if you want to preserve full-length entropy) to the password fields in the Zod schemas.
- **Confidence / verification:** Confirmed the schemas have no `max`; bcrypt's 72-byte limit is well documented (bcryptjs README / OWASP Password Storage Cheat Sheet).

### [LOW] Residual account-enumeration side channels (timing + register 409)
- **Location:** `src/actions/auth.ts` `requestPasswordReset` (email/token work only runs for real accounts), `src/lib/auth/register.ts:36` (409 "already exists")
- **Issue:** The **response bodies are correctly uniform** — `requestPasswordReset` and `resendVerification` always redirect to the same confirmation (this is done well, see Passed Checks). What remains: (a) `requestPasswordReset` only performs token creation + email send for an existing credentials account, so response *timing* differs measurably between real and unknown addresses; (b) registration necessarily returns 409 for an existing email.
- **Impact / exploit:** A determined attacker can probe which emails are registered via timing or the register endpoint. Low impact and partly inherent to registration UX.
- **Fix:** Optional — even out timing by doing the existence-dependent work off the request path (queue) or adding a small constant-time floor; the 409 is a common, accepted trade-off and can be left as-is. Rate limiting (High finding) also blunts practical enumeration.
- **Confidence / verification:** Confirmed uniform redirects in both actions and the branch that gates email work on account existence.

## Passed Checks

Verified correct — these are done right and should be preserved:

- **CSPRNG tokens, 256-bit:** both flows use `crypto.randomBytes(32).toString("hex")` — `src/lib/auth/verification.ts:34`, `src/lib/auth/password-reset.ts:38`. No `Math.random`.
- **Raw token emailed, only the hash stored & queried:** SHA-256 hash persisted; lookups by hash — `src/lib/auth/verification.ts:24,74`, `src/lib/auth/password-reset.ts:20,74`. A DB leak yields no usable links.
- **Single-use enforcement:** token consumed and deleted in the *same* `$transaction` as the state change — `src/lib/auth/verification.ts:86` (verify → set `emailVerified` + delete), `src/lib/auth/password-reset.ts:113` (reset → update password + delete). Replay is not possible.
- **Expiration enforced on read, not just stored:** `record.expires < new Date()` rejected and the row deleted — `src/lib/auth/verification.ts:80`, `src/lib/auth/password-reset.ts:88` (24h verify / 1h reset TTL).
- **No cross-flow token confusion:** reset tokens are namespaced (`password-reset:{email}`) and `validatePasswordResetToken`/`resetUserPassword` reject any token outside that namespace — `src/lib/auth/password-reset.ts:73,101`. Verification and reset tokens cannot wipe or drive each other.
- **Password hashing:** bcrypt cost 12 on register, reset, and change — `src/lib/auth/register.ts:44`, `src/lib/auth/password-reset.ts:109`, `src/actions/profile.ts` (`changePassword`).
- **Constant-time verification:** current-password and sign-in checks use `bcrypt.compare`, never `===` — `src/actions/profile.ts` (`changePassword`), `src/auth.ts:30`.
- **Hash never leaves the server:** register selects only `{id,name,email}`; the profile page selects `password` server-side but forwards only a derived `hasPassword` boolean — `src/lib/auth/register.ts:55`, `src/app/profile/page.tsx`.
- **Session-scoped mutations (no IDOR):** `changePassword` and `deleteAccount` re-derive the user from `auth()` and act on `session.user.id` only — never a client-supplied id/email — `src/actions/profile.ts`.
- **Auth guards, defense in depth:** profile page redirects when unauthenticated *and* the proxy matcher covers `/dashboard/:path*` and `/profile/:path*` — `src/app/profile/page.tsx`, `src/proxy.ts:16`.
- **Uniform anti-enumeration responses:** `requestPasswordReset` → `/forgot-password?sent=1` and `resendVerification` → `/sign-in?resent=1` regardless of whether the address exists; both restrict work to accounts that actually have a password — `src/actions/auth.ts`.
- **Email-verification gate is fail-safe:** `isEmailVerificationEnabled()` is off unless the env var is exactly `"true"`, and off-mode stamps `emailVerified` at creation, so the toggle can neither lock users out nor be forged — `src/lib/auth/verification.ts:16`, `src/lib/auth/register.ts:53`.
- **Validation before sinks:** Zod validates every Server Action / route body before it reaches Prisma or bcrypt — `src/lib/validations/auth.ts` + call sites.
- **No open redirect:** the credentials/GitHub sign-in actions redirect to hardcoded paths; no user-controlled `callbackUrl` reaches `redirect()` — `src/actions/auth.ts`.
- **`.env` correctly ignored:** `.gitignore:34` (`.env*`); no secrets hardcoded in tracked source.

## Not Flagged (handled by NextAuth / out of scope)

Deliberately not reported — these are covered by the framework or aren't defects:

- **CSRF** on Auth.js routes/actions (built-in double-submit token).
- **Session cookie security** — `httpOnly`, `secure`, `sameSite`, and JWT encryption/signing are NextAuth defaults.
- **OAuth `state` / PKCE / nonce** for the GitHub provider.
- **JWT session format / cookie storage** — the JWT strategy is a deliberate configuration choice (its revocation trade-off is captured as the Medium finding above, which is the app-level part).
- **Unbuilt hardening** (2FA, formal account-lockout policy, audit logging) — not implemented, not defects; see optional hardening.

## Recommended Hardening (optional, non-blocking)

- Prevent password **reuse** on change/reset (compare new against the current hash and reject a match).
- Consider checking new passwords against a breached-password list (e.g. HaveIBeenPwned k-anonymity range API) at register/reset.
- The two email flows share the `VerificationToken` table; if a user pastes a *reset* link into `/verify-email`, `consumeVerificationToken` will attempt `user.update` on a non-existent `password-reset:{email}` identifier and throw (a 500, not a security issue). A guard rejecting non-bare-email identifiers there would make it a clean "invalid link" instead.
