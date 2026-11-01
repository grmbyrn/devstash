"use server";

import { auth } from "@/auth";
import type { ActionResult } from "@/actions/items";
import {
  createCollection as createCollectionQuery,
  type CreatedCollection,
} from "@/lib/db/collections";
import { createCollectionSchema } from "@/lib/validations/collection";

/**
 * Create a collection from the "New collection" dialog.
 *
 * The owner is always the session user: the schema strips any `userId` the
 * payload carries, and the query connects the id passed here. Validation runs
 * server-side regardless of the dialog's disabled Create button.
 */
export async function createCollection(
  input: unknown,
): Promise<ActionResult<CreatedCollection>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "You need to be signed in to do that." };
    }

    const parsed = createCollectionSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
      };
    }

    const collection = await createCollectionQuery(session.user.id, parsed.data);
    return { success: true, data: collection };
  } catch (error) {
    // Log for the server, but never hand the client a database message.
    console.error("Collection create error:", error);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}
