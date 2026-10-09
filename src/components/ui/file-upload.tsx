"use client";

import * as React from "react";
import { FileIcon, ImageIcon, UploadCloud, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/format";
import {
  acceptAttribute,
  isPreviewableImage,
  UPLOAD_RULES,
  validateUpload,
  type UploadKind,
} from "@/lib/uploads";
import { cn } from "@/lib/utils";

/** What the upload route hands back, and what the create form then submits. */
export interface UploadedFile {
  /** The R2 object key. Reads go through `/api/files/[...key]`. */
  key: string;
  fileName: string;
  fileSize: number;
}

interface FileUploadProps {
  /** The item type name the upload is for — `"file"` or `"image"`. */
  typeName: string;
  kind: UploadKind;
  value: UploadedFile | null;
  onChange: (value: UploadedFile | null) => void;
  disabled?: boolean;
}

/**
 * Drag-and-drop upload for the file and image item types.
 *
 * Uploads immediately on drop or pick, rather than deferring to form submit:
 * the create action needs an object key, and uploading first means a failure
 * surfaces here — next to the field — instead of collapsing the whole create.
 *
 * **Uses `XMLHttpRequest`, not `fetch`.** This is the one place in the app that
 * does, and the reason is upload progress: `fetch` exposes no progress events
 * for a request body, so a determinate progress bar isn't possible with it.
 *
 * Client-side validation here is for immediate feedback only; the route
 * re-validates everything against the real bytes.
 */
export function FileUpload({
  typeName,
  kind,
  value,
  onChange,
  disabled,
}: FileUploadProps) {
  const inputId = React.useId();
  const [isDragging, setDragging] = React.useState(false);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  /**
   * A local `blob:` URL for the picked file, used to preview it.
   *
   * It cannot be previewed through `/api/files/[...key]` the way the drawer
   * does: that route authorises by finding an *item* that points at the key,
   * and no item exists until this form is submitted — so the proxy would
   * correctly answer a pending upload with a 404. Reading the local File also
   * means the preview appears instantly, with no second round trip.
   */
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const xhrRef = React.useRef<XMLHttpRequest | null>(null);

  const isUploading = progress !== null;
  const rules = UPLOAD_RULES[kind];

  // Abort an in-flight upload if the dialog closes mid-transfer, so the
  // callback can't fire against an unmounted form.
  React.useEffect(() => {
    return () => xhrRef.current?.abort();
  }, []);

  // Object URLs hold the file in memory until revoked.
  React.useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function upload(file: File) {
    setError(null);

    const check = validateUpload({
      typeName,
      fileName: file.name,
      size: file.size,
      mimeType: file.type,
    });

    if (!check.ok) {
      setError(check.error);
      return;
    }

    // Shown as soon as the file is picked, before the upload finishes.
    setPreviewUrl(kind === "image" ? URL.createObjectURL(file) : null);

    const form = new FormData();
    form.append("file", file);
    form.append("type", typeName);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    setProgress(0);

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      setProgress(Math.round((event.loaded / event.total) * 100));
    });

    xhr.addEventListener("load", () => {
      xhrRef.current = null;
      setProgress(null);

      let payload: {
        success?: boolean;
        data?: UploadedFile;
        error?: string;
      } | null = null;

      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        // A non-JSON body means something upstream rejected the request — most
        // likely a platform body-size limit, which never reaches our handler.
        setError(
          xhr.status === 413
            ? "That file is too large to upload."
            : "Upload failed. Please try again.",
        );
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300 && payload?.success && payload.data) {
        onChange(payload.data);
        return;
      }

      setError(payload?.error ?? "Upload failed. Please try again.");
    });

    xhr.addEventListener("error", () => {
      xhrRef.current = null;
      setProgress(null);
      setError("Upload failed. Check your connection and try again.");
    });

    xhr.addEventListener("abort", () => {
      xhrRef.current = null;
      setProgress(null);
    });

    xhr.open("POST", "/api/upload");
    xhr.send(form);
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (disabled || isUploading) return;

    const file = event.dataTransfer.files?.[0];
    if (file) upload(file);
  }

  function handleRemove() {
    xhrRef.current?.abort();
    setError(null);
    setPreviewUrl(null);
    onChange(null);
  }

  if (value) {
    return (
      <div className="flex flex-col gap-2">
        <UploadedPreview value={value} kind={kind} previewUrl={previewUrl} />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={disabled}
          >
            <X />
            Remove
          </Button>
          <span className="text-xs text-muted-foreground">
            {formatFileSize(value.fileSize)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled && !isUploading) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center gap-2 rounded-md border border-dashed border-border p-6 text-center transition-colors",
          isDragging && "border-primary bg-accent/50",
          disabled && "opacity-60",
        )}
      >
        {kind === "image" ? (
          <ImageIcon className="size-6 text-muted-foreground" />
        ) : (
          <UploadCloud className="size-6 text-muted-foreground" />
        )}

        {isUploading ? (
          <UploadProgress progress={progress} />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Drag and drop, or{" "}
              {/* The input stays in the accessibility tree (sr-only, not
                  hidden) so it remains focusable and operable by keyboard;
                  the label is what carries the visible affordance. */}
              <label
                htmlFor={inputId}
                className="cursor-pointer text-primary underline-offset-2 hover:underline"
              >
                choose a {kind}
              </label>
            </p>
            <p className="text-xs text-muted-foreground">
              Up to {Math.round(rules.maxBytes / (1024 * 1024))} MB ·{" "}
              {rules.extensions.join(" ")}
            </p>
          </>
        )}

        <input
          id={inputId}
          type="file"
          className="sr-only"
          accept={acceptAttribute(kind)}
          disabled={disabled || isUploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Reset the input so re-picking the same file fires `change` again
            // after a failed upload.
            event.target.value = "";
            if (file) upload(file);
          }}
        />
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function UploadProgress({ progress }: { progress: number }) {
  return (
    <div className="flex w-full max-w-xs flex-col gap-1.5">
      <div
        role="progressbar"
        aria-label="Upload progress"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full bg-primary transition-[width] duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {progress < 100 ? `Uploading… ${progress}%` : "Finishing up…"}
      </p>
    </div>
  );
}

/** An image renders as itself; anything else as its name and icon. */
function UploadedPreview({
  value,
  kind,
  previewUrl,
}: {
  value: UploadedFile;
  kind: UploadKind;
  previewUrl: string | null;
}) {
  const showImage = kind === "image" && isPreviewableImage(value.fileName);

  if (showImage && previewUrl) {
    return (
      // The local file, not the proxy — see `previewUrl` above. Deliberately
      // not `next/image` either: it would route a blob: URL through the
      // optimizer, which cannot fetch one.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={previewUrl}
        alt={value.fileName}
        className="max-h-48 w-full rounded-md border border-border object-contain"
      />
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-border p-3">
      <FileIcon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate text-sm">{value.fileName}</span>
    </div>
  );
}
