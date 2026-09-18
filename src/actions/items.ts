"use server";

import { auth } from "@/auth";
import {
  deleteItem as deleteItemQuery,
  updateItem as updateItemQuery,
} from "@/lib/db/items";
import type { ItemDetail } from "@/lib/db/items";
import { updateItemSchema } from "@/lib/validations/item";

/**
 * The `{ success, data, error }` shape the rest of the app returns. Unlike the
 * auth actions, item mutations answer the caller instead of redirecting — the
 * drawer stays open and renders the result in place.
 */
export type ActionResult<T> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: string };

/**
 * Save an edit from the item drawer.
 *
 * Validation runs server-side regardless of what the client checked: the
 * drawer's disabled Save button is a convenience, this is the rule. Ownership
 * is enforced inside the query's `where` clause, so an item belonging to
 * someone else reports the same "not found" as an id that never existed.
 *
 * Returns the refreshed `ItemDetail` so the open drawer can re-render without a
 * second trip to `/api/items/[id]`.
 */
export async function updateItem(
  itemId: string,
  input: unknown,
): Promise<ActionResult<ItemDetail>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "You need to be signed in to do that." };
    }

    if (typeof itemId !== "string" || itemId.length === 0) {
      return { success: false, error: "Item not found." };
    }

    const parsed = updateItemSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
      };
    }

    const item = await updateItemQuery(session.user.id, itemId, parsed.data);
    if (!item) {
      return { success: false, error: "Item not found." };
    }

    return { success: true, data: item };
  } catch (error) {
    // Log for the server, but never hand the client a database message.
    console.error("Item update error:", error);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}

/**
 * Delete an item from the drawer.
 *
 * The confirmation dialog in front of this is a UX gate, not the rule: the auth
 * check and the ownership filter inside the query are what actually decide.
 * A foreign or unknown id reports the same "Item not found." as each other.
 */
export async function deleteItem(itemId: string): Promise<ActionResult<null>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "You need to be signed in to do that." };
    }

    if (typeof itemId !== "string" || itemId.length === 0) {
      return { success: false, error: "Item not found." };
    }

    const deleted = await deleteItemQuery(session.user.id, itemId);
    if (!deleted) {
      return { success: false, error: "Item not found." };
    }

    return { success: true, data: null };
  } catch (error) {
    // Log for the server, but never hand the client a database message.
    console.error("Item delete error:", error);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}
