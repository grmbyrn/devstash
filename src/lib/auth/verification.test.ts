import { createHash } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  consumeVerificationToken,
  createVerificationToken,
  isEmailVerificationEnabled,
} from "@/lib/auth/verification";
import { prismaMock } from "@/test/prisma-mock";

vi.mock("@/lib/prisma", async () => ({
  prisma: (await import("@/test/prisma-mock")).prismaMock,
}));

vi.mock("@/lib/email/verification", () => ({ sendVerificationEmail: vi.fn() }));

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

describe("isEmailVerificationEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is on only for the exact string \"true\"", () => {
    vi.stubEnv("EMAIL_VERIFICATION_ENABLED", "true");
    expect(isEmailVerificationEnabled()).toBe(true);
  });

  it.each(["false", "1", "TRUE", "yes", ""])(
    "is off for %o, so a misconfigured deploy can't lock users out",
    (value) => {
      vi.stubEnv("EMAIL_VERIFICATION_ENABLED", value);
      expect(isEmailVerificationEnabled()).toBe(false);
    },
  );

  it("is off when the variable is unset", () => {
    vi.stubEnv("EMAIL_VERIFICATION_ENABLED", undefined);
    expect(isEmailVerificationEnabled()).toBe(false);
  });
});

describe("createVerificationToken", () => {
  it("stores only the hash, never the raw token", async () => {
    const rawToken = await createVerificationToken("ada@example.com");

    const { data } = prismaMock.verificationToken.create.mock.calls[0][0];
    expect(data.token).toBe(sha256(rawToken));
    expect(data.token).not.toBe(rawToken);
  });

  it("returns a 32-byte random token", async () => {
    const rawToken = await createVerificationToken("ada@example.com");

    expect(rawToken).toMatch(/^[0-9a-f]{64}$/);
  });

  it("issues a different token each time", async () => {
    const first = await createVerificationToken("ada@example.com");
    const second = await createVerificationToken("ada@example.com");

    expect(first).not.toBe(second);
  });

  it("replaces any earlier token for the address, so only the newest link works", async () => {
    await createVerificationToken("ada@example.com");

    expect(prismaMock.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: "ada@example.com" },
    });
  });

  it("expires in 24 hours", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-07-31T12:00:00Z");
    vi.setSystemTime(now);

    await createVerificationToken("ada@example.com");

    const { data } = prismaMock.verificationToken.create.mock.calls[0][0];
    expect(data.expires).toEqual(new Date(now.getTime() + 24 * 60 * 60 * 1000));
    vi.useRealTimers();
  });
});

describe("consumeVerificationToken", () => {
  it("reports an unknown token as invalid without writing anything", async () => {
    prismaMock.verificationToken.findUnique.mockResolvedValue(null);

    const result = await consumeVerificationToken("bogus");

    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.verificationToken.delete).not.toHaveBeenCalled();
  });

  it("looks the token up by hash", async () => {
    prismaMock.verificationToken.findUnique.mockResolvedValue(null);

    await consumeVerificationToken("raw-token");

    expect(prismaMock.verificationToken.findUnique).toHaveBeenCalledWith({
      where: { token: sha256("raw-token") },
    });
  });

  it("deletes an expired token and reports it, without verifying the user", async () => {
    prismaMock.verificationToken.findUnique.mockResolvedValue({
      identifier: "ada@example.com",
      token: sha256("raw-token"),
      expires: new Date(Date.now() - 1_000),
    });

    const result = await consumeVerificationToken("raw-token");

    expect(result).toEqual({ ok: false, reason: "expired" });
    expect(prismaMock.verificationToken.delete).toHaveBeenCalledWith({
      where: { token: sha256("raw-token") },
    });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("marks the user verified and burns the token in one transaction", async () => {
    prismaMock.verificationToken.findUnique.mockResolvedValue({
      identifier: "ada@example.com",
      token: sha256("raw-token"),
      expires: new Date(Date.now() + 60_000),
    });

    const result = await consumeVerificationToken("raw-token");

    expect(result).toEqual({ ok: true, email: "ada@example.com" });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { email: "ada@example.com" },
      data: { emailVerified: expect.any(Date) },
    });
    expect(prismaMock.verificationToken.delete).toHaveBeenCalledWith({
      where: { token: sha256("raw-token") },
    });
  });
});
