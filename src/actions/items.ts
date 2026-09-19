"use server";

import { auth } from "@/auth";
import {
  createItem as createItemQuery,
  deleteItem as deleteItemQuery,
  getSystemItemTypes,
  updateItem as updateItemQuery,
} from "@/lib/db/items";
import type { CreateItemData, ItemDetail } from "@/lib/db/items";
import { editableFields, isCreatableType } from "@/lib/item-types";
import { createItemSchema, updateItemSchema } from "@/lib/validations/item";

/**
 * The `{ success, data, error }` shape the rest of the app returns. Unlike the
 * auth actions, item mutations answer the caller instead of redirecting — the
 * drawer stays open and renders the result in place.
 */
export type ActionResult<T> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: string };

/**
 * Create an item from the "New item" dialog.
 *
 * Two things the schema can't decide are settled here, because both need the
 * actual type row:
 *
 * - The client picks `itemTypeId`, so it's resolved against the real system
 *   types. An unknown id, or one naming an upload type, is refused rather than
 *   handed to the database.
 * - The payload is then narrowed to the fields that type uses, so a snippet
 *   can't be given a `url` and a link can't be given `content`, whatever the
 *   form sent.
 *
 * Returns the new item's `ItemDetail`, the same shape `updateItem` returns.
 */
export async function createItem(
  input: unknown,
): Promise<ActionResult<ItemDetail>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "You need to be signed in to do that." };
    }

    const parsed = createItemSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
      };
    }

    const { itemTypeId, tags, title, description, ...rest } = parsed.data;

    const itemType = (await getSystemItemTypes()).find(
      (type) => type.id === itemTypeId,
    );
    if (!itemType || !isCreatableType(itemType.name)) {
      return { success: false, error: "Choose an item type." };
    }

    const fields = editableFields(itemType.name);
    const data: CreateItemData = {
      itemTypeId,
      title,
      description,
      tags,
      ...(fields.content ? { content: rest.content } : {}),
      ...(fields.language ? { language: rest.language } : {}),
      ...(fields.url ? { url: rest.url } : {}),
    };

    // A link is its URL — the one optional field that isn't optional. Only the
    // types that carry a url are subject to this, so nothing else is affected.
    if (fields.url && !data.url) {
      return { success: false, error: "URL is required for links." };
    }

    const item = await createItemQuery(session.user.id, data);

    return { success: true, data: item };
  } catch (error) {
    // Log for the server, but never hand the client a database message.
    console.error("Item create error:", error);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}

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
