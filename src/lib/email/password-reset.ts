import { EMAIL_FROM, getBaseUrl, resend } from "@/lib/email/client";

/**
 * Send the password-reset email containing a single-use link. The raw token (not
 * its stored hash) goes in the URL. Throws if Resend rejects the send so callers
 * can decide whether to surface or swallow the failure.
 */
export async function sendPasswordResetEmail(
  email: string,
  name: string | null,
  rawToken: string,
): Promise<void> {
  const resetUrl = `${getBaseUrl()}/reset-password?token=${rawToken}`;
  const greeting = name ? `Hi ${name},` : "Hi,";

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: "Reset your DevStash password",
    html: `
      <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #0f172a;">
        <h1 style="font-size: 20px; margin: 0 0 16px;">Reset your password</h1>
        <p style="margin: 0 0 12px; line-height: 1.5;">${greeting}</p>
        <p style="margin: 0 0 20px; line-height: 1.5;">
          We received a request to reset your DevStash password. Click the button
          below to choose a new one.
        </p>
        <p style="margin: 0 0 24px;">
          <a href="${resetUrl}"
             style="display: inline-block; background: #3b82f6; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 600;">
            Reset password
          </a>
        </p>
        <p style="margin: 0 0 8px; font-size: 13px; color: #64748b; line-height: 1.5;">
          Or paste this link into your browser:
        </p>
        <p style="margin: 0 0 24px; font-size: 13px; word-break: break-all;">
          <a href="${resetUrl}" style="color: #3b82f6;">${resetUrl}</a>
        </p>
        <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
          This link expires in 1 hour. If you didn't request a password reset, you
          can safely ignore this email — your password won't change.
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }
}
