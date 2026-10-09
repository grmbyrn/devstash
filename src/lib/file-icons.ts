import {
  File,
  FileCode,
  FileCog,
  FileImage,
  FileJson,
  FileSpreadsheet,
  FileText,
  type LucideIcon,
} from "lucide-react";

import { fileExtension } from "@/lib/uploads";

// Covers every extension `UPLOAD_RULES` accepts, grouped by what a reader would
// recognise the file as; anything else falls back to the plain file icon.
const ICON_BY_EXTENSION: Record<string, LucideIcon> = {
  ".pdf": FileText,
  ".txt": FileText,
  ".md": FileText,
  ".json": FileJson,
  ".xml": FileCode,
  ".csv": FileSpreadsheet,
  ".yaml": FileCog,
  ".yml": FileCog,
  ".toml": FileCog,
  ".ini": FileCog,
  ".png": FileImage,
  ".jpg": FileImage,
  ".jpeg": FileImage,
  ".gif": FileImage,
  ".webp": FileImage,
  ".svg": FileImage,
};

/**
 * The icon for an uploaded file, chosen by extension.
 *
 * Pass the object *key* rather than the client-supplied `fileName`: the key's
 * extension is server-generated and was validated at upload.
 */
export function fileIconFor(key: string | null): LucideIcon {
  if (!key) return File;
  return ICON_BY_EXTENSION[fileExtension(key)] ?? File;
}
