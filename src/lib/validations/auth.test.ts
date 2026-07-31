import { describe, expect, it } from "vitest";

import {
  changePasswordSchema,
  forgotPasswordSchema,
  registerSchema,
  resetPasswordSchema,
  signInSchema,
} from "@/lib/validations/auth";

/** First issue message, which is what the actions surface to the user. */
function firstError(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues[0]?.message;
}

describe("registerSchema", () => {
  const valid = {
    name: "Ada",
    email: "ada@example.com",
    password: "supersecret",
    confirmPassword: "supersecret",
  };

  it("accepts a well-formed payload", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("trims the name", () => {
    const parsed = registerSchema.parse({ ...valid, name: "  Ada  " });
    expect(parsed.name).toBe("Ada");
  });

  it("rejects a blank name", () => {
    const result = registerSchema.safeParse({ ...valid, name: "   " });
    expect(result.success).toBe(false);
    expect(firstError(result)).toBe("Name is required");
  });

  it("rejects a malformed email", () => {
    const result = registerSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(result.success).toBe(false);
    expect(firstError(result)).toBe("Enter a valid email address");
  });

  it("rejects a password under 8 characters", () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
    expect(firstError(result)).toBe("Password must be at least 8 characters");
  });

  it("rejects mismatched passwords on the confirm field", () => {
    const result = registerSchema.safeParse({
      ...valid,
      confirmPassword: "somethingelse",
    });
    expect(result.success).toBe(false);
    expect(firstError(result)).toBe("Passwords do not match");
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });
});

describe("signInSchema", () => {
  it("accepts an email and any non-empty password", () => {
    const result = signInSchema.safeParse({ email: "a@b.io", password: "x" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty password without leaking a length rule", () => {
    // Sign-in must not enforce the 8-char minimum: older accounts may predate it.
    expect(signInSchema.safeParse({ email: "a@b.io", password: "" }).success).toBe(
      false,
    );
  });
});

describe("forgotPasswordSchema", () => {
  it("accepts a valid address", () => {
    expect(forgotPasswordSchema.safeParse({ email: "a@b.io" }).success).toBe(true);
  });

  it("rejects an invalid address", () => {
    expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts matching passwords of at least 8 characters", () => {
    const result = resetPasswordSchema.safeParse({
      password: "newpassword",
      confirmPassword: "newpassword",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a mismatch", () => {
    const result = resetPasswordSchema.safeParse({
      password: "newpassword",
      confirmPassword: "newpassw0rd",
    });
    expect(result.success).toBe(false);
    expect(firstError(result)).toBe("Passwords do not match");
  });
});

describe("changePasswordSchema", () => {
  const valid = {
    currentPassword: "oldpassword",
    newPassword: "newpassword",
    confirmPassword: "newpassword",
  };

  it("accepts a well-formed payload", () => {
    expect(changePasswordSchema.safeParse(valid).success).toBe(true);
  });

  it("requires the current password", () => {
    const result = changePasswordSchema.safeParse({
      ...valid,
      currentPassword: "",
    });
    expect(result.success).toBe(false);
    expect(firstError(result)).toBe("Enter your current password");
  });

  it("rejects a mismatched confirmation", () => {
    const result = changePasswordSchema.safeParse({
      ...valid,
      confirmPassword: "different",
    });
    expect(result.success).toBe(false);
    expect(firstError(result)).toBe("Passwords do not match");
  });
});
