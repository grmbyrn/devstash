import { EMAIL_FROM, getBaseUrl, resend } from "@/lib/email/client";

/**
 * Send the account-verification email containing a single-use link. The raw
 * token (not its stored hash) goes in the URL. Throws if Resend rejects the
 * send so callers can decide whether to surface or swallow the failure.
 */
export async function sendVerificationEmail(
  email: string,
  name: string | null,
  rawToken: string,
): Promise<void> {
  const verifyUrl = `${getBaseUrl()}/verify-email?token=${rawToken}`;
  const greeting = name ? `Hi ${name},` : "Hi,";

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: "Verify your DevStash email",
    html: `
      <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #0f172a;">
        <h1 style="font-size: 20px; margin: 0 0 16px;">Verify your email</h1>
        <p style="margin: 0 0 12px; line-height: 1.5;">${greeting}</p>
        <p style="margin: 0 0 20px; line-height: 1.5;">
          Thanks for signing up for DevStash. Confirm your email address to
          activate your account.
        </p>
        <p style="margin: 0 0 24px;">
          <a href="${verifyUrl}"
             style="display: inline-block; background: #3b82f6; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 600;">
            Verify email
          </a>
        </p>
        <p style="margin: 0 0 8px; font-size: 13px; color: #64748b; line-height: 1.5;">
          Or paste this link into your browser:
        </p>
        <p style="margin: 0 0 24px; font-size: 13px; word-break: break-all;">
          <a href="${verifyUrl}" style="color: #3b82f6;">${verifyUrl}</a>
        </p>
        <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
          This link expires in 24 hours. If you didn't create a DevStash account,
          you can safely ignore this email.
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
}
