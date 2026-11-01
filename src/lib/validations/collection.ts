import { z } from "zod";

/**
 * Payload for `createCollection`.
 *
 * The name is trimmed before the length checks so whitespace alone can't pass
 * as a name. An empty or whitespace-only description is stored as `null`
 * rather than as an empty string, matching how the item schemas clear text.
 */
export const createCollectionSchema = z.object({
  // The custom message covers a missing name as well as a blank one — Zod's
  // default ("expected string, received undefined") would otherwise reach a
  // toast.
  name: z
    .string({ error: "Name is required" })
    .trim()
    .min(1, "Name is required")
    .max(100, "Name is too long"),
  description: z
    .union([z.string(), z.null()])
    .optional()
    .transform((value) => {
      const trimmed = (value ?? "").trim();
      return trimmed.length > 0 ? trimmed : null;
    })
    .refine((value) => value === null || value.length <= 500, {
      message: "Description is too long",
    }),
});

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;
