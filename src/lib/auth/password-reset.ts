import { createHash, randomBytes } from "crypto";

import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email/password-reset";

/** Reset links are valid for 1 hour — shorter than verification since the link changes credentials. */
const TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * Password-reset tokens share the `VerificationToken` table, so their identifier
 * is namespaced to keep them from colliding with email-verification tokens (which
 * key off the bare email). `createVerificationToken` clears rows by identifier —
 * a shared key would let one flow wipe the other's pending token. The prefix also
 * lets the reset consumer reject a verification token handed to the wrong flow.
 */
const IDENTIFIER_PREFIX = "password-reset:";

/**
 * Hash the token before it touches the database, so a DB leak never exposes a
 * usable link. The raw token only ever lives in the emailed URL.
 */
function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

function identifierFor(email: string): string {
  return `${IDENTIFIER_PREFIX}${email}`;
}

/**
 * Create a single-use reset token for `email`, replacing any existing one for
 * that address (so only the latest emailed link works). Returns the raw token to
 * embed in the URL; the DB stores only its hash.
 */
export async function createPasswordResetToken(email: string): Promise<string> {
  const rawToken = randomBytes(32).toString("hex");
  const identifier = identifierFor(email);

  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: {
      identifier,
      token: hashToken(rawToken),
      expires: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  return rawToken;
}

/**
 * Issue a fresh reset token and email the link. Only ever called for a real
 * credentials account — the action layer decides whether an address qualifies.
 */
export async function issuePasswordReset(
  email: string,
  name: string | null,
): Promise<void> {
  const rawToken = await createPasswordResetToken(email);
  await sendPasswordResetEmail(email, name, rawToken);
}

export type PeekResult =
  | { ok: true; email: string }
  | { ok: false; reason: "invalid" | "expired" };

/**
 * Peek at a reset token without consuming it — used to decide whether to render
 * the reset form on page load. Rejects tokens outside the reset namespace so a
 * verification token can't drive the reset form. Never mutates.
 */
export async function validatePasswordResetToken(
  rawToken: string,
): Promise<PeekResult> {
  const record = await prisma.verificationToken.findUnique({
    where: { token: hashToken(rawToken) },
  });

  if (!record || !record.identifier.startsWith(IDENTIFIER_PREFIX)) {
    return { ok: false, reason: "invalid" };
  }
  if (record.expires < new Date()) {
    return { ok: false, reason: "expired" };
  }

  return {
    ok: true,
    email: record.identifier.slice(IDENTIFIER_PREFIX.length),
  };
}

export type ResetResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "expired" };

/**
 * Validate and consume a reset token, setting the user's new password. Hashes
 * with bcrypt 12 rounds (matching register/seed), then updates the user and burns
 * the token atomically so a link works exactly once. Expired tokens are removed
 * and reported so the UI can offer a fresh link.
 */
export async function resetUserPassword(
  rawToken: string,
  newPassword: string,
): Promise<ResetResult> {
  const hashed = hashToken(rawToken);
  const record = await prisma.verificationToken.findUnique({
    where: { token: hashed },
  });

  if (!record || !record.identifier.startsWith(IDENTIFIER_PREFIX)) {
    return { ok: false, reason: "invalid" };
  }
  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token: hashed } });
    return { ok: false, reason: "expired" };
  }

  const email = record.identifier.slice(IDENTIFIER_PREFIX.length);
  const passwordHash = await bcrypt.hash(newPassword, 12);

  // Set the new password and burn the token atomically.
  await prisma.$transaction([
    prisma.user.update({
      where: { email },
      data: { password: passwordHash },
    }),
    prisma.verificationToken.delete({ where: { token: hashed } }),
  ]);

  return { ok: true };
}
