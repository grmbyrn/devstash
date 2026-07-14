import { Resend } from "resend";

/**
 * Resend client singleton. `RESEND_API_KEY` is read at construction; the SDK
 * only performs network I/O when `emails.send` is called, so an unset key fails
 * at send time (surfaced by the caller) rather than at import.
 */
export const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * From-address for transactional email. Defaults to the Resend sandbox sender,
 * which only delivers to your own Resend account email — set `EMAIL_FROM` to a
 * verified-domain address for real delivery.
 */
export const EMAIL_FROM =
  process.env.EMAIL_FROM ?? "DevStash <onboarding@resend.dev>";

/** Absolute base URL for links embedded in emails. */
export function getBaseUrl(): string {
  return (
    process.env.APP_URL ?? process.env.AUTH_URL ?? "http://localhost:3000"
  );
}
