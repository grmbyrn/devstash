import { createHash, randomBytes } from "crypto";

import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email/verification";

/** Verification links are valid for 24 hours. */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Hash the token before it touches the database, so a DB leak never exposes a
 * usable link. The raw token only ever lives in the emailed URL.
 */
function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Create a single-use verification token for `email`, replacing any existing
 * ones for that address (so only the latest emailed link works). Returns the
 * raw token to embed in the URL; the DB stores only its hash.
 */
export async function createVerificationToken(email: string): Promise<string> {
  const rawToken = randomBytes(32).toString("hex");

  await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: hashToken(rawToken),
      expires: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  return rawToken;
}

/**
 * Issue a fresh verification token and email it. Used on register and when a
 * user asks to resend the link.
 */
export async function issueEmailVerification(
  email: string,
  name: string | null,
): Promise<void> {
  const rawToken = await createVerificationToken(email);
  await sendVerificationEmail(email, name, rawToken);
}

export type ConsumeResult =
  | { ok: true; email: string }
  | { ok: false; reason: "invalid" | "expired" };

/**
 * Validate and consume a verification token: on success it marks the user's
 * email verified and deletes the token (single-use). Expired tokens are removed
 * and reported so the UI can offer a resend. Invalid/unknown tokens report
 * `invalid` without any write.
 */
export async function consumeVerificationToken(
  rawToken: string,
): Promise<ConsumeResult> {
  const hashed = hashToken(rawToken);
  const record = await prisma.verificationToken.findUnique({
    where: { token: hashed },
  });

  if (!record) return { ok: false, reason: "invalid" };

  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token: hashed } });
    return { ok: false, reason: "expired" };
  }

  // Mark verified and burn the token atomically.
  await prisma.$transaction([
    prisma.user.update({
      where: { email: record.identifier },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.delete({ where: { token: hashed } }),
  ]);

  return { ok: true, email: record.identifier };
}
