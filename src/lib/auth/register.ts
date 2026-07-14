import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations/auth";
import { issueEmailVerification } from "@/lib/auth/verification";

export type RegisterResult =
  | {
      success: true;
      data: { id: string; name: string | null; email: string | null };
    }
  | { success: false; error: string; status: 400 | 409 };

/**
 * Core registration: validates the payload, rejects duplicate emails, hashes the
 * password (bcrypt, 12 rounds — matching the seed), and creates the user. Shared
 * by the `POST /api/auth/register` route (external/future clients) and the
 * `registerAction` server action (the sign-up form). Never returns the hash.
 */
export async function registerUser(input: unknown): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      status: 400,
    };
  }

  const { name, email, password } = parsed.data;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return {
      success: false,
      error: "A user with this email already exists",
      status: 409,
    };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, password: passwordHash },
    select: { id: true, name: true, email: true },
  });

  // Send the verification email. A send failure shouldn't fail registration —
  // the account exists and the user can request a fresh link from sign-in.
  try {
    await issueEmailVerification(user.email!, user.name);
  } catch (error) {
    console.error("Failed to send verification email on register:", error);
  }

  return { success: true, data: user };
}
