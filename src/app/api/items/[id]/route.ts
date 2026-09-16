import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getItemById } from "@/lib/db/items";

/**
 * GET /api/items/[id]
 *
 * One item's full detail for the item drawer, which fetches on click rather
 * than navigating. Returns the `{ success, data, error }` shape the rest of the
 * app uses.
 *
 * An item belonging to someone else is a 404, not a 403: `getItemById` scopes
 * the query by `userId`, so the route cannot tell "not yours" from "not there"
 * and therefore cannot leak which ids exist.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id } = await params;
    const item = await getItemById(session.user.id, id);

    if (!item) {
      return NextResponse.json(
        { success: false, error: "Item not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error("Item fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
