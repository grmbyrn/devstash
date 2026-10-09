import { File, FileCog, FileImage, FileJson, FileText } from "lucide-react";
import { describe, expect, it } from "vitest";

import { fileIconFor } from "@/lib/file-icons";
import { UPLOAD_RULES } from "@/lib/uploads";

describe("fileIconFor", () => {
  it("maps extensions to their icon", () => {
    expect(fileIconFor("user_1/abc.pdf")).toBe(FileText);
    expect(fileIconFor("user_1/abc.json")).toBe(FileJson);
    expect(fileIconFor("user_1/abc.yml")).toBe(FileCog);
    expect(fileIconFor("user_1/abc.png")).toBe(FileImage);
  });

  it("ignores extension case", () => {
    expect(fileIconFor("user_1/abc.JSON")).toBe(FileJson);
  });

  it("falls back to the plain file icon", () => {
    expect(fileIconFor(null)).toBe(File);
    expect(fileIconFor("user_1/abc")).toBe(File);
    expect(fileIconFor("user_1/abc.exe")).toBe(File);
  });

  it("gives every accepted file extension a specific icon", () => {
    for (const ext of UPLOAD_RULES.file.extensions) {
      expect(fileIconFor(`user_1/abc${ext}`), ext).not.toBe(File);
    }
  });
});
