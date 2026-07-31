import bcrypt from "bcryptjs";
import type { Session } from "next-auth";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { auth, signOut } from "@/auth";
import { changePassword, deleteAccount } from "@/actions/profile";
import { prismaMock } from "@/test/prisma-mock";
import { captureRedirect } from "@/test/redirect";

vi.mock("next/navigation", async () => ({
  redirect: (await import("@/test/redirect")).redirectMock,
}));

vi.mock("@/auth", () => ({ auth: vi.fn(), signOut: vi.fn() }));

vi.mock("@/lib/prisma", async () => ({
  prisma: (await import("@/test/prisma-mock")).prismaMock,
}));

const SESSION: Session = {
  user: { id: "user_1", email: "ada@example.com" },
  expires: "2099-01-01T00:00:00.000Z",
};

/**
 * `auth()` is overloaded (middleware wrapper, route handler wrapper, bare call);
 * narrow it to the bare call the actions make before stubbing a session.
 */
function mockSession(session: Session | null) {
  vi.mocked<() => Promise<Session | null>>(auth).mockResolvedValue(session);
}

const CURRENT_PASSWORD = "oldpassword";
/** Cheap rounds for the fixture — the cost factor lives in the hash itself. */
let currentHash: string;

beforeAll(async () => {
  currentHash = await bcrypt.hash(CURRENT_PASSWORD, 4);
});

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

describe("changePassword", () => {
  const input = {
    currentPassword: CURRENT_PASSWORD,
    newPassword: "brandnewpassword",
    confirmPassword: "brandnewpassword",
  };

  beforeEach(() => {
    mockSession(SESSION);
    prismaMock.user.findUnique.mockResolvedValue({ password: currentHash });
  });

  it("sends signed-out visitors to sign in", async () => {
    mockSession(null);

    const url = await captureRedirect(() => changePassword(formData(input)));

    expect(url).toBe("/sign-in?callbackUrl=/profile");
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("rejects a mismatched confirmation before touching the database", async () => {
    const url = await captureRedirect(() =>
      changePassword(formData({ ...input, confirmPassword: "different" })),
    );

    expect(url).toBe("/profile?pwError=Passwords%20do%20not%20match");
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("rejects a new password under 8 characters", async () => {
    const url = await captureRedirect(() =>
      changePassword(
        formData({ ...input, newPassword: "short", confirmPassword: "short" }),
      ),
    );

    expect(url).toBe(
      "/profile?pwError=Password%20must%20be%20at%20least%208%20characters",
    );
  });

  it("refuses an account that has no password to change", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ password: null });

    const url = await captureRedirect(() => changePassword(formData(input)));

    expect(url).toBe(
      "/profile?pwError=Password%20change%20isn't%20available%20for%20this%20account.",
    );
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("refuses when the current password is wrong, so a session alone can't rotate credentials", async () => {
    const url = await captureRedirect(() =>
      changePassword(formData({ ...input, currentPassword: "notmypassword" })),
    );

    expect(url).toBe("/profile?pwError=Current%20password%20is%20incorrect.");
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("stores a new bcrypt hash for the signed-in user", async () => {
    const url = await captureRedirect(() => changePassword(formData(input)));

    expect(url).toBe("/profile?pwSuccess=1");
    const [update] = prismaMock.user.update.mock.calls[0];
    expect(update.where).toEqual({ id: "user_1" });
    expect(update.data.password).not.toBe(input.newPassword);
    expect(update.data.password).not.toBe(currentHash);
    // 12 rounds, matching register/reset/seed.
    expect(update.data.password).toMatch(/^\$2[aby]\$12\$/);
    await expect(
      bcrypt.compare(input.newPassword, update.data.password),
    ).resolves.toBe(true);
  });

  it("scopes the lookup to the session user, not anything from the form", async () => {
    await captureRedirect(() =>
      changePassword(formData({ ...input, userId: "someone_else" })),
    );

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user_1" },
      select: { password: true },
    });
  });
});

describe("deleteAccount", () => {
  beforeEach(() => {
    mockSession(SESSION);
  });

  it("sends signed-out visitors to sign in", async () => {
    mockSession(null);

    const url = await captureRedirect(() =>
      deleteAccount(formData({ confirmEmail: "ada@example.com" })),
    );

    expect(url).toBe("/sign-in?callbackUrl=/profile");
    expect(prismaMock.user.delete).not.toHaveBeenCalled();
  });

  it("refuses a confirmation that doesn't match the account email", async () => {
    const url = await captureRedirect(() =>
      deleteAccount(formData({ confirmEmail: "someone@example.com" })),
    );

    expect(url).toBe(
      "/profile?deleteError=Type%20your%20email%20exactly%20to%20confirm%20deletion.",
    );
    expect(prismaMock.user.delete).not.toHaveBeenCalled();
  });

  it("refuses an empty confirmation", async () => {
    const url = await captureRedirect(() =>
      deleteAccount(formData({ confirmEmail: "" })),
    );

    expect(url).toContain("deleteError=");
    expect(prismaMock.user.delete).not.toHaveBeenCalled();
  });

  it("deletes the account and clears the session on an exact match", async () => {
    await deleteAccount(formData({ confirmEmail: "ada@example.com" }));

    expect(prismaMock.user.delete).toHaveBeenCalledWith({
      where: { id: "user_1" },
    });
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/" });
  });

  it("accepts a differently-cased or padded confirmation", async () => {
    await deleteAccount(formData({ confirmEmail: "  ADA@Example.com  " }));

    expect(prismaMock.user.delete).toHaveBeenCalledWith({
      where: { id: "user_1" },
    });
  });

  it("never deletes when the session carries no email", async () => {
    mockSession({ user: { id: "user_1" }, expires: SESSION.expires });

    const url = await captureRedirect(() =>
      deleteAccount(formData({ confirmEmail: "" })),
    );

    expect(url).toContain("deleteError=");
    expect(prismaMock.user.delete).not.toHaveBeenCalled();
  });
});
