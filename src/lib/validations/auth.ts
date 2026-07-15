import { z } from "zod";

/**
 * Payload for `POST /api/auth/register`. `confirmPassword` must match
 * `password`; the refinement surfaces the mismatch on that field.
 */
export const registerSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100),
    email: z.email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Shape the Credentials provider validates before touching the database.
 */
export const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

/**
 * Payload for the "forgot password" form — just the address to email a reset
 * link to.
 */
export const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email address"),
});

/**
 * Payload for the "reset password" form. `confirmPassword` must match `password`;
 * the refinement surfaces the mismatch on that field. Mirrors `registerSchema`.
 */
export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
