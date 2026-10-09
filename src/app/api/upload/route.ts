import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { buildObjectKey, isStorageConfigured, putObject } from "@/lib/r2";
import { mimeTypeForFileName, validateUpload } from "@/lib/uploads";

/**
 * POST /api/upload
 *
 * Store one file in R2 and report the key it landed under. The create dialog
 * calls this *before* creating the item, then sends the key along with the rest
 * of the form — so a failed upload never produces a half-made item, and an
 * upload with no item behind it is cleaned up by the create action.
 *
 * A route rather than a Server Action because actions can't report upload
 * progress: the client needs `XMLHttpRequest` to drive the progress bar, which
 * means a plain HTTP endpoint. The coding standards call this out as one of the
 * cases API routes exist for.
 *
 * **Known constraint:** the bytes pass through this handler, so a platform with
 * a serverless request-body cap (Vercel's is around 4.5 MB) would reject the
 * larger end of the 10 MB file tier in production. Moving to a presigned PUT
 * straight to R2 is the fix, and needs bucket CORS configured.
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    if (!isStorageConfigured()) {
      // A deployment without R2 credentials shouldn't look like a user error.
      return NextResponse.json(
        { success: false, error: "File storage isn't configured." },
        { status: 503 },
      );
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json(
        { success: false, error: "Expected a file upload." },
        { status: 400 },
      );
    }

    const file = form.get("file");
    const typeName = form.get("type");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "No file was received." },
        { status: 400 },
      );
    }

    if (typeof typeName !== "string") {
      return NextResponse.json(
        { success: false, error: "Choose an item type." },
        { status: 400 },
      );
    }

    // First pass against the reported metadata, so an oversized file is refused
    // before its bytes are read into memory.
    const check = validateUpload({
      typeName,
      fileName: file.name,
      size: file.size,
      mimeType: file.type,
    });

    if (!check.ok) {
      return NextResponse.json(
        { success: false, error: check.error },
        { status: 400 },
      );
    }

    const body = Buffer.from(await file.arrayBuffer());

    // Second pass against the byte count the handler actually read, which is
    // also the number stored as `fileSize` — so the value that was validated
    // and the value that gets written are the same one, rather than a limit
    // checked on `File.size` and a different number recorded beside it.
    //
    // In the Next/undici runtime these agree: `formData()` re-parses the
    // multipart body, so `File.size` already reflects the parsed bytes rather
    // than anything the client claimed. This is belt-and-braces, not the only
    // thing standing between an oversized upload and the bucket.
    const confirmed = validateUpload({
      typeName,
      fileName: file.name,
      size: body.byteLength,
      mimeType: file.type,
    });

    if (!confirmed.ok) {
      return NextResponse.json(
        { success: false, error: confirmed.error },
        { status: 400 },
      );
    }

    const key = buildObjectKey(session.user.id, file.name);

    await putObject({
      key,
      body,
      // Derived from the extension, never the client's Content-Type — see
      // `mimeTypeForFileName`.
      contentType: mimeTypeForFileName(file.name),
    });

    return NextResponse.json({
      success: true,
      data: {
        // The object key, not a URL. Reads go through `/api/files/[...key]`.
        key,
        fileName: file.name,
        fileSize: body.byteLength,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { success: false, error: "Upload failed. Please try again." },
      { status: 500 },
    );
  }
}
