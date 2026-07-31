import { createHash } from "node:crypto";

import bcrypt from "bcryptjs";
import { describe, expect, it, vi } from "vitest";

import {
  createPasswordResetToken,
  resetUserPassword,
  validatePasswordResetToken,
} from "@/lib/auth/password-reset";
import { prismaMock } from "@/test/prisma-mock";

vi.mock("@/lib/prisma", async () => ({
  prisma: (await import("@/test/prisma-mock")).prismaMock,
}));

vi.mock("@/lib/email/password-reset", () => ({
  sendPasswordResetEmail: vi.fn(),
}));

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

/** A stored row as the reset flow expects it — identifier in the reset namespace. */
function resetTokenRow(rawToken: string, expiresInMs = 60_000) {
  return {
    identifier: "password-reset:ada@example.com",
    token: sha256(rawToken),
    expires: new Date(Date.now() + expiresInMs),
  };
}

describe("createPasswordResetToken", () => {
  it("namespaces the identifier so it can't collide with a verification token", async () => {
    await createPasswordResetToken("ada@example.com");

    const { data } = prismaMock.verificationToken.create.mock.calls[0][0];
    expect(data.identifier).toBe("password-reset:ada@example.com");
    expect(prismaMock.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: "password-reset:ada@example.com" },
    });
  });

  it("stores only the hash, never the raw token", async () => {
    const rawToken = await createPasswordResetToken("ada@example.com");

    const { data } = prismaMock.verificationToken.create.mock.calls[0][0];
    expect(rawToken).toMatch(/^[0-9a-f]{64}$/);
    expect(data.token).toBe(sha256(rawToken));
  });

  it("expires in 1 hour — shorter than a verification link", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-07-31T12:00:00Z");
    vi.setSystemTime(now);

    await createPasswordResetToken("ada@example.com");

    const { data } = prismaMock.verificationToken.create.mock.calls[0][0];
    expect(data.expires).toEqual(new Date(now.getTime() + 60 * 60 * 1000));
    vi.useRealTimers();
  });
});

describe("validatePasswordResetToken", () => {
  it("returns the address for a live token without mutating anything", async () => {
    prismaMock.verificationToken.findUnique.mockResolvedValue(
      resetTokenRow("raw-token"),
    );

    const result = await validatePasswordResetToken("raw-token");

    expect(result).toEqual({ ok: true, email: "ada@example.com" });
    // It's a peek: the token must survive for the form submit that follows.
    expect(prismaMock.verificationToken.delete).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an unknown token", async () => {
    prismaMock.verificationToken.findUnique.mockResolvedValue(null);

    await expect(validatePasswordResetToken("bogus")).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("rejects an email-verification token handed to the reset flow", async () => {
    prismaMock.verificationToken.findUnique.mockResolvedValue({
      identifier: "ada@example.com", // bare email = verification namespace
      token: sha256("raw-token"),
      expires: new Date(Date.now() + 60_000),
    });

    await expect(validatePasswordResetToken("raw-token")).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("reports an expired token without deleting it", async () => {
    prismaMock.verificationToken.findUnique.mockResolvedValue(
      resetTokenRow("raw-token", -1_000),
    );

    await expect(validatePasswordResetToken("raw-token")).resolves.toEqual({
      ok: false,
      reason: "expired",
    });
    expect(prismaMock.verificationToken.delete).not.toHaveBeenCalled();
  });
});

describe("resetUserPassword", () => {
  it("hashes the new password and burns the token in one transaction", async () => {
    prismaMock.verificationToken.findUnique.mockResolvedValue(
      resetTokenRow("raw-token"),
    );

    const result = await resetUserPassword("raw-token", "brandnewpassword");

    expect(result).toEqual({ ok: true });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);

    const [update] = prismaMock.user.update.mock.calls[0];
    expect(update.where).toEqual({ email: "ada@example.com" });
    expect(update.data.password).not.toBe("brandnewpassword");
    await expect(
      bcrypt.compare("brandnewpassword", update.data.password),
    ).resolves.toBe(true);

    expect(prismaMock.verificationToken.delete).toHaveBeenCalledWith({
      where: { token: sha256("raw-token") },
    });
  });

  it("refuses an unknown token and changes nothing", async () => {
    prismaMock.verificationToken.findUnique.mockResolvedValue(null);

    await expect(resetUserPassword("bogus", "brandnewpassword")).resolves.toEqual(
      { ok: false, reason: "invalid" },
    );
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("refuses a verification token, so it can't be used to change a password", async () => {
    prismaMock.verificationToken.findUnique.mockResolvedValue({
      identifier: "ada@example.com",
      token: sha256("raw-token"),
      expires: new Date(Date.now() + 60_000),
    });

    await expect(
      resetUserPassword("raw-token", "brandnewpassword"),
    ).resolves.toEqual({ ok: false, reason: "invalid" });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("deletes an expired token instead of resetting the password", async () => {
    prismaMock.verificationToken.findUnique.mockResolvedValue(
      resetTokenRow("raw-token", -1_000),
    );

    await expect(
      resetUserPassword("raw-token", "brandnewpassword"),
    ).resolves.toEqual({ ok: false, reason: "expired" });
    expect(prismaMock.verificationToken.delete).toHaveBeenCalledWith({
      where: { token: sha256("raw-token") },
    });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
