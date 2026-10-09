import { auth } from "@/auth";
import { getItemByFileKey } from "@/lib/db/items";
import { getObject, isStorageConfigured, objectKeyOwner } from "@/lib/r2";
import { mimeTypeForFileName } from "@/lib/uploads";

/**
 * GET /api/files/[...key]
 *
 * Serve one stored object to the user who owns the item pointing at it. This is
 * the only way an uploaded file is ever read: the R2 bucket is private, and
 * `Item.fileUrl` holds the object *key* rather than a public URL, so possession
 * of a key grants nothing on its own.
 *
 * Two jobs, in this order:
 *
 *  1. **Authorise.** `getItemByFileKey` scopes by `userId`, so a key belonging
 *     to someone else finds no row and is answered with a 404 — byte-identical
 *     to a key that never existed, which is what keeps the route from
 *     confirming whether an object is real.
 *  2. **Serve.** The response type is derived from the item's stored filename,
 *     never from what was uploaded, and the response is locked down (see the
 *     headers below) because the bytes are user-supplied.
 *
 * `?download=1` sends it as an attachment; without it, images render inline,
 * which is what the drawer's preview uses.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    if (!isStorageConfigured()) {
      return json({ success: false, error: "File storage isn't configured." }, 503);
    }

    const { key: segments } = await params;
    const key = (segments ?? []).join("/");

    // A cheap shape check before any I/O. The database lookup below is the
    // authoritative test — this only rejects keys that couldn't possibly be
    // this user's, and keeps malformed paths away from the bucket.
    if (!key || objectKeyOwner(key) !== session.user.id) {
      return json({ success: false, error: "File not found" }, 404);
    }

    const item = await getItemByFileKey(session.user.id, key);
    if (!item) {
      return json({ success: false, error: "File not found" }, 404);
    }

    const object = await getObject(key);
    if (!object) {
      // The row survived but the object didn't — a failed cleanup, or a bucket
      // edited by hand. Reported the same as any other miss.
      return json({ success: false, error: "File not found" }, 404);
    }

    const fileName = item.fileName ?? "download";
    const asAttachment =
      new URL(request.url).searchParams.get("download") === "1";

    return new Response(new Uint8Array(object.body), {
      headers: {
        // Derived from the *object key*, not from `item.fileName`. The key's
        // extension was validated at upload and is server-generated; the
        // display name is client-supplied and never was, so deriving from it
        // would let an uploader choose the type their bytes are served as.
        "Content-Type": mimeTypeForFileName(key),
        "Content-Length": String(object.body.byteLength),
        "Content-Disposition": contentDisposition(fileName, asAttachment),
        // The bytes are user-supplied and SVG is executable markup, so an image
        // item could otherwise run script in our own origin when opened
        // directly. `sandbox` with no tokens blocks scripts, plugins and form
        // submission; `default-src 'none'` stops it fetching anything. Rendering
        // through an <img> was already safe — this covers direct navigation.
        "Content-Security-Policy": "default-src 'none'; sandbox",
        // Serve it as the type we chose, with no sniffing to something else.
        "X-Content-Type-Options": "nosniff",
        // Authorised per user, so it must never land in a shared cache.
        "Cache-Control": "private, max-age=3600, must-revalidate",
      },
    });
  } catch (error) {
    console.error("File fetch error:", error);
    return json(
      { success: false, error: "Something went wrong. Please try again." },
      500,
    );
  }
}

/**
 * A `Content-Disposition` carrying the original filename.
 *
 * Both forms are sent: a stripped ASCII `filename` for older clients, and the
 * RFC 5987 `filename*` with the real name percent-encoded. Quotes, control
 * characters and path separators are removed from the ASCII form so a crafted
 * name can't break out of the header.
 */
function contentDisposition(fileName: string, asAttachment: boolean): string {
  const disposition = asAttachment ? "attachment" : "inline";
  const ascii =
    fileName
      .replace(/[\u0000-\u001f\u007f-￿"\\/]/g, "")
      .trim() || "download";

  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
