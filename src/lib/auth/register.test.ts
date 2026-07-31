import bcrypt from "bcryptjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { registerUser } from "@/lib/auth/register";
import { sendVerificationEmail } from "@/lib/email/verification";
import { prismaMock } from "@/test/prisma-mock";

vi.mock("@/lib/prisma", async () => ({
  prisma: (await import("@/test/prisma-mock")).prismaMock,
}));

// Stub the outbound email only — the token/verification logic under it stays real.
vi.mock("@/lib/email/verification", () => ({ sendVerificationEmail: vi.fn() }));

const VALID_INPUT = {
  name: "Ada",
  email: "ada@example.com",
  password: "supersecret",
  confirmPassword: "supersecret",
};

/** What `user.create` resolves to — the `select` in the helper omits the hash. */
const CREATED_USER = {
  id: "user_1",
  name: "Ada",
  email: "ada@example.com",
};

describe("registerUser", () => {
  beforeEach(() => {
    vi.stubEnv("EMAIL_VERIFICATION_ENABLED", "false");
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue(CREATED_USER);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects an invalid payload before touching the database", async () => {
    const result = await registerUser({ ...VALID_INPUT, email: "nope" });

    expect(result).toEqual({
      success: false,
      error: "Enter a valid email address",
      status: 400,
    });
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("rejects a duplicate email with 409", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "existing" });

    const result = await registerUser(VALID_INPUT);

    expect(result).toEqual({
      success: false,
      error: "A user with this email already exists",
      status: 409,
    });
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("stores a bcrypt hash, never the raw password", async () => {
    const result = await registerUser(VALID_INPUT);

    expect(result.success).toBe(true);
    const { data } = prismaMock.user.create.mock.calls[0][0];
    expect(data.password).not.toBe(VALID_INPUT.password);
    await expect(
      bcrypt.compare(VALID_INPUT.password, data.password),
    ).resolves.toBe(true);
  });

  it("never returns the password hash to the caller", async () => {
    const result = await registerUser(VALID_INPUT);

    expect(result).toEqual({ success: true, data: CREATED_USER });
    expect(prismaMock.user.create.mock.calls[0][0].select).not.toHaveProperty(
      "password",
    );
  });

  describe("with email verification disabled", () => {
    it("stamps the account verified and sends no email", async () => {
      await registerUser(VALID_INPUT);

      const { data } = prismaMock.user.create.mock.calls[0][0];
      expect(data.emailVerified).toBeInstanceOf(Date);
      expect(sendVerificationEmail).not.toHaveBeenCalled();
      expect(prismaMock.verificationToken.create).not.toHaveBeenCalled();
    });
  });

  describe("with email verification enabled", () => {
    beforeEach(() => {
      vi.stubEnv("EMAIL_VERIFICATION_ENABLED", "true");
    });

    it("leaves the account unverified and emails a link", async () => {
      await registerUser(VALID_INPUT);

      const { data } = prismaMock.user.create.mock.calls[0][0];
      expect(data.emailVerified).toBeNull();
      expect(sendVerificationEmail).toHaveBeenCalledWith(
        "ada@example.com",
        "Ada",
        expect.any(String),
      );
    });

    it("still succeeds when the verification email fails to send", async () => {
      vi.mocked(sendVerificationEmail).mockRejectedValue(new Error("smtp down"));
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await registerUser(VALID_INPUT);

      // The account exists; the user can request a fresh link from sign-in.
      expect(result).toEqual({ success: true, data: CREATED_USER });
      expect(consoleError).toHaveBeenCalled();
    });
  });
});
