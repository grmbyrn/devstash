/**
 * Deterministic environment for unit tests.
 *
 * Vitest does not load `.env`, so tests never depend on a developer's local
 * secrets — but a few modules read env at import time (the Resend client throws
 * without an API key, for example). These placeholders keep imports working
 * without ever reaching a real service; anything a test cares about should be
 * set explicitly with `vi.stubEnv`.
 */
process.env.RESEND_API_KEY ??= "re_test_key";
process.env.EMAIL_FROM ??= "DevStash <test@devstash.test>";
process.env.APP_URL ??= "http://localhost:3000";

// Off by default, matching the production default in `isEmailVerificationEnabled`.
process.env.EMAIL_VERIFICATION_ENABLED ??= "false";

// Rate limiting fails open when unconfigured, so unit tests see no throttling
// unless they opt in.
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
