import { AuthError } from "next-auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { signIn } from "@/auth";
import {
  register,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  signInWithCredentials,
} from "@/actions/auth";
import { registerUser } from "@/lib/auth/register";
import { issueEmailVerification } from "@/lib/auth/verification";
import {
  issuePasswordReset,
  resetUserPassword,
} from "@/lib/auth/password-reset";
import { checkRateLimit } from "@/lib/rate-limit";
import { prismaMock } from "@/test/prisma-mock";
import { captureRedirect } from "@/test/redirect";

vi.mock("next/navigation", async () => ({
  redirect: (await import("@/test/redirect")).redirectMock,
}));

// `next-auth`'s entry pulls in `next/server`, which doesn't resolve outside the
// Next runtime. The action only uses `AuthError` for an `instanceof` check, and
// both it and this test read the class from here, so the check stays honest.
vi.mock("next-auth", () => ({ AuthError: class AuthError extends Error {} }));

vi.mock("@/auth", () => ({ signIn: vi.fn(), signOut: vi.fn() }));

vi.mock("@/lib/prisma", async () => ({
  prisma: (await import("@/test/prisma-mock")).prismaMock,
}));

vi.mock("@/lib/auth/register", () => ({ registerUser: vi.fn() }));

vi.mock("@/lib/auth/verification", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/verification")>()),
  issueEmailVerification: vi.fn(),
}));

vi.mock("@/lib/auth/password-reset", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/password-reset")>()),
  issuePasswordReset: vi.fn(),
  resetUserPassword: vi.fn(),
}));

vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(async () => "203.0.113.5"),
}));

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

/** Simulate the limiter rejecting the next call, 10 minutes from resetting. */
function rateLimited() {
  vi.mocked(checkRateLimit).mockResolvedValue({
    success: false,
    remaining: 0,
    reset: Date.now() + 10 * 60_000,
    limit: 5,
  });
}

beforeEach(() => {
  // Allowed by default; individual tests opt into being throttled.
  vi.mocked(checkRateLimit).mockResolvedValue({
    success: true,
    remaining: 4,
    reset: 0,
    limit: 5,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("register", () => {
  beforeEach(() => {
    vi.stubEnv("EMAIL_VERIFICATION_ENABLED", "false");
    vi.mocked(registerUser).mockResolvedValue({
      success: true,
      data: { id: "user_1", name: "Ada", email: "ada@example.com" },
    });
  });

  const input = {
    name: "Ada",
    email: "ada@example.com",
    password: "supersecret",
    confirmPassword: "supersecret",
  };

  it("forwards the form fields to registerUser", async () => {
    await captureRedirect(() => register(formData(input)));

    expect(registerUser).toHaveBeenCalledWith(input);
  });

  it("sends the user to sign-in on success", async () => {
    const url = await captureRedirect(() => register(formData(input)));

    expect(url).toBe("/sign-in?registered=1");
  });

  it("asks the user to check their inbox when verification is enabled", async () => {
    vi.stubEnv("EMAIL_VERIFICATION_ENABLED", "true");

    const url = await captureRedirect(() => register(formData(input)));

    expect(url).toBe("/sign-in?registered=1&verify=1");
  });

  it("returns to the form with the error message", async () => {
    vi.mocked(registerUser).mockResolvedValue({
      success: false,
      error: "A user with this email already exists",
      status: 409,
    });

    const url = await captureRedirect(() => register(formData(input)));

    expect(url).toBe(
      "/register?error=A%20user%20with%20this%20email%20already%20exists",
    );
  });

  it("throttles before creating anything", async () => {
    rateLimited();

    const url = await captureRedirect(() => register(formData(input)));

    expect(url).toContain("/register?error=Too%20many%20attempts");
    expect(registerUser).not.toHaveBeenCalled();
  });
});

describe("signInWithCredentials", () => {
  const credentials = { email: "ada@example.com", password: "supersecret" };

  it("passes the credentials to NextAuth with the dashboard as the target", async () => {
    await signInWithCredentials(formData(credentials));

    expect(signIn).toHaveBeenCalledWith("credentials", {
      ...credentials,
      redirectTo: "/dashboard",
    });
  });

  it("keys the limiter by IP and lowercased email", async () => {
    await signInWithCredentials(
      formData({ ...credentials, email: "ADA@Example.com" }),
    );

    expect(checkRateLimit).toHaveBeenCalledWith(
      "login",
      "203.0.113.5:ada@example.com",
    );
  });

  it("throttles before checking the password", async () => {
    rateLimited();

    const url = await captureRedirect(() =>
      signInWithCredentials(formData(credentials)),
    );

    expect(url).toBe("/sign-in?error=RateLimited&retryMins=10");
    expect(signIn).not.toHaveBeenCalled();
  });

  it("reports a rejected sign-in as invalid credentials", async () => {
    vi.mocked(signIn).mockRejectedValue(new AuthError("CredentialsSignin"));

    const url = await captureRedirect(() =>
      signInWithCredentials(formData(credentials)),
    );

    expect(url).toBe("/sign-in?error=CredentialsSignin");
  });

  it("steers an unverified account to the resend flow instead", async () => {
    vi.stubEnv("EMAIL_VERIFICATION_ENABLED", "true");
    vi.mocked(signIn).mockRejectedValue(new AuthError("CredentialsSignin"));
    prismaMock.user.findUnique.mockResolvedValue({
      password: "hash",
      emailVerified: null,
    });

    const url = await captureRedirect(() =>
      signInWithCredentials(formData(credentials)),
    );

    expect(url).toBe("/sign-in?error=EmailNotVerified&email=ada%40example.com");
  });

  it("does not look up the account when verification is switched off", async () => {
    vi.stubEnv("EMAIL_VERIFICATION_ENABLED", "false");
    vi.mocked(signIn).mockRejectedValue(new AuthError("CredentialsSignin"));

    const url = await captureRedirect(() =>
      signInWithCredentials(formData(credentials)),
    );

    expect(url).toBe("/sign-in?error=CredentialsSignin");
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("rethrows non-auth errors rather than masking them as a bad password", async () => {
    const failure = new Error("database is on fire");
    vi.mocked(signIn).mockRejectedValue(failure);

    await expect(signInWithCredentials(formData(credentials))).rejects.toThrow(
      failure,
    );
  });
});

describe("resendVerification", () => {
  beforeEach(() => {
    vi.stubEnv("EMAIL_VERIFICATION_ENABLED", "true");
  });

  it("emails a fresh link to an unverified credentials account", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      name: "Ada",
      email: "ada@example.com",
      password: "hash",
      emailVerified: null,
    });

    const url = await captureRedirect(() =>
      resendVerification(formData({ email: "ada@example.com" })),
    );

    expect(issueEmailVerification).toHaveBeenCalledWith("ada@example.com", "Ada");
    expect(url).toBe("/sign-in?resent=1");
  });

  it("gives the same answer for an unknown address, so it can't probe accounts", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const url = await captureRedirect(() =>
      resendVerification(formData({ email: "nobody@example.com" })),
    );

    expect(issueEmailVerification).not.toHaveBeenCalled();
    expect(url).toBe("/sign-in?resent=1");
  });

  it("sends nothing to an already-verified account", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      name: "Ada",
      email: "ada@example.com",
      password: "hash",
      emailVerified: new Date(),
    });

    await captureRedirect(() =>
      resendVerification(formData({ email: "ada@example.com" })),
    );

    expect(issueEmailVerification).not.toHaveBeenCalled();
  });

  it("sends nothing to an OAuth-only account", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      name: "Ada",
      email: "ada@example.com",
      password: null,
      emailVerified: null,
    });

    await captureRedirect(() =>
      resendVerification(formData({ email: "ada@example.com" })),
    );

    expect(issueEmailVerification).not.toHaveBeenCalled();
  });

  it("does nothing when verification is switched off", async () => {
    vi.stubEnv("EMAIL_VERIFICATION_ENABLED", "false");

    const url = await captureRedirect(() =>
      resendVerification(formData({ email: "ada@example.com" })),
    );

    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    expect(url).toBe("/sign-in?resent=1");
  });

  it("still confirms when the send fails, without leaking the error", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      name: "Ada",
      email: "ada@example.com",
      password: "hash",
      emailVerified: null,
    });
    vi.mocked(issueEmailVerification).mockRejectedValue(new Error("smtp down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const url = await captureRedirect(() =>
      resendVerification(formData({ email: "ada@example.com" })),
    );

    expect(url).toBe("/sign-in?resent=1");
    expect(consoleError).toHaveBeenCalled();
  });

  it("throttles by IP and address", async () => {
    rateLimited();

    const url = await captureRedirect(() =>
      resendVerification(formData({ email: "ada@example.com" })),
    );

    expect(checkRateLimit).toHaveBeenCalledWith(
      "resendVerification",
      "203.0.113.5:ada@example.com",
    );
    expect(url).toBe("/sign-in?error=RateLimited&retryMins=10");
  });
});

describe("requestPasswordReset", () => {
  it("emails a link to a credentials account", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      name: "Ada",
      email: "ada@example.com",
      password: "hash",
    });

    const url = await captureRedirect(() =>
      requestPasswordReset(formData({ email: "ada@example.com" })),
    );

    expect(issuePasswordReset).toHaveBeenCalledWith("ada@example.com", "Ada");
    expect(url).toBe("/forgot-password?sent=1");
  });

  it("gives the same confirmation for an unknown address", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const url = await captureRedirect(() =>
      requestPasswordReset(formData({ email: "nobody@example.com" })),
    );

    expect(issuePasswordReset).not.toHaveBeenCalled();
    expect(url).toBe("/forgot-password?sent=1");
  });

  it("sends nothing to an OAuth-only account, but still confirms", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      name: "Ada",
      email: "ada@example.com",
      password: null,
    });

    const url = await captureRedirect(() =>
      requestPasswordReset(formData({ email: "ada@example.com" })),
    );

    expect(issuePasswordReset).not.toHaveBeenCalled();
    expect(url).toBe("/forgot-password?sent=1");
  });

  it("confirms even for a malformed address, without querying", async () => {
    const url = await captureRedirect(() =>
      requestPasswordReset(formData({ email: "not-an-email" })),
    );

    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    expect(url).toBe("/forgot-password?sent=1");
  });

  it("throttles by IP alone, so the limit can't reveal which accounts exist", async () => {
    rateLimited();

    const url = await captureRedirect(() =>
      requestPasswordReset(formData({ email: "ada@example.com" })),
    );

    expect(checkRateLimit).toHaveBeenCalledWith("forgotPassword", "203.0.113.5");
    expect(url).toBe(
      "/forgot-password?error=Too%20many%20attempts.%20Please%20try%20again%20in%2010%20minutes.",
    );
  });
});

describe("resetPassword", () => {
  const input = {
    token: "raw-token",
    password: "brandnewpassword",
    confirmPassword: "brandnewpassword",
  };

  beforeEach(() => {
    vi.mocked(resetUserPassword).mockResolvedValue({ ok: true });
  });

  it("burns the token and sends the user to sign in", async () => {
    const url = await captureRedirect(() => resetPassword(formData(input)));

    expect(resetUserPassword).toHaveBeenCalledWith("raw-token", "brandnewpassword");
    expect(url).toBe("/sign-in?reset=1");
  });

  it("keeps the token in the URL when the passwords don't match", async () => {
    const url = await captureRedirect(() =>
      resetPassword(formData({ ...input, confirmPassword: "different" })),
    );

    expect(url).toBe(
      "/reset-password?token=raw-token&error=Passwords%20do%20not%20match",
    );
    expect(resetUserPassword).not.toHaveBeenCalled();
  });

  it("keeps the token when the new password is too short", async () => {
    const url = await captureRedirect(() =>
      resetPassword(
        formData({ ...input, password: "short", confirmPassword: "short" }),
      ),
    );

    expect(url).toBe(
      "/reset-password?token=raw-token&error=Password%20must%20be%20at%20least%208%20characters",
    );
  });

  it("drops the token when it went bad, so the page shows the invalid state", async () => {
    vi.mocked(resetUserPassword).mockResolvedValue({
      ok: false,
      reason: "expired",
    });

    const url = await captureRedirect(() => resetPassword(formData(input)));

    expect(url).toBe("/reset-password?error=expired");
  });

  it("preserves the token when throttled so the user can retry later", async () => {
    rateLimited();

    const url = await captureRedirect(() => resetPassword(formData(input)));

    expect(url).toContain("token=raw-token");
    expect(url).toContain("error=Too%20many%20attempts");
    expect(resetUserPassword).not.toHaveBeenCalled();
  });
});
