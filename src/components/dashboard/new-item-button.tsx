"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { createItem } from "@/actions/items";
import { Button } from "@/components/ui/button";
import { CodeEditor } from "@/components/ui/code-editor";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ItemTypeSummary } from "@/lib/db/items";
import { editableFields } from "@/lib/item-types";
import { parseTagInput } from "@/lib/validations/item";
import { cn } from "@/lib/utils";

import { ItemTypeIcon } from "./item-type-icon";

/**
 * The header's "New item" button and the dialog it opens.
 *
 * The button lives in the `(dashboard)` layout, which is a server component and
 * sits outside `ItemDrawerProvider` — so rather than hoisting another provider
 * around the whole shell, this owns its own open state and is the only client
 * code the header needs.
 */
export function NewItemButton({ itemTypes }: { itemTypes: ItemTypeSummary[] }) {
  const [isOpen, setOpen] = React.useState(false);

  if (itemTypes.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          New item
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New item</DialogTitle>
          <DialogDescription>
            Save a snippet, prompt, command, note or link to your stash.
          </DialogDescription>
        </DialogHeader>
        {/* Radix unmounts the content on close, so the form's state resets
            itself — reopening always starts blank without an effect. */}
        <NewItemForm itemTypes={itemTypes} onCreated={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Controlled inputs with local state, matching the drawer's edit form — no form
 * library, and the only client-side checks are the empty-title and empty-URL
 * guards, which are conveniences. The action re-validates everything.
 *
 * Which fields are shown, and which are sent, both come from `editableFields`,
 * so switching type mid-form never submits a field that type doesn't use. Typed
 * values are kept across a type switch rather than cleared, so flipping between
 * two types by accident doesn't lose work.
 */
function NewItemForm({
  itemTypes,
  onCreated,
}: {
  itemTypes: ItemTypeSummary[];
  onCreated: () => void;
}) {
  const router = useRouter();

  const [itemTypeId, setItemTypeId] = React.useState(itemTypes[0].id);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [content, setContent] = React.useState("");
  const [language, setLanguage] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [tagInput, setTagInput] = React.useState("");
  const [isSaving, setSaving] = React.useState(false);

  const selectedType =
    itemTypes.find((type) => type.id === itemTypeId) ?? itemTypes[0];
  const fields = editableFields(selectedType.name);

  const canSave =
    title.trim().length > 0 &&
    (!fields.url || url.trim().length > 0) &&
    !isSaving;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSave) return;

    setSaving(true);
    try {
      const result = await createItem({
        itemTypeId,
        title,
        description,
        tags: parseTagInput(tagInput),
        ...(fields.content ? { content } : {}),
        ...(fields.language ? { language } : {}),
        ...(fields.url ? { url } : {}),
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Item created");
      onCreated();
      // Re-render the server components behind the dialog so the new item shows
      // up in the grid and the counts it feeds.
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-xs font-medium text-muted-foreground">
          Type
        </legend>
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
          {itemTypes.map((type) => {
            const isSelected = type.id === selectedType.id;
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => setItemTypeId(type.id)}
                aria-pressed={isSelected}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md border p-2 text-[11px] capitalize transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  isSelected
                    ? "border-primary bg-accent text-foreground"
                    : "border-border text-muted-foreground hover:bg-accent/50",
                )}
              >
                <span style={{ color: type.color }}>
                  <ItemTypeIcon name={type.icon} className="size-4" />
                </span>
                {type.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <Field label="Title" htmlFor="new-item-title">
        <Input
          id="new-item-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="useDebounce hook"
          required
          autoFocus
        />
      </Field>

      <Field label="Description" htmlFor="new-item-description">
        <Textarea
          id="new-item-description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      {fields.url && (
        <Field label="URL" htmlFor="new-item-url">
          {/* Deliberately not type="url": native format validation blocks
              submit on its own terms, so the schema's message would never
              reach the user. `required` only checks emptiness, which is safe.
              `inputMode` keeps the URL keyboard on mobile. */}
          <Input
            id="new-item-url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            required
          />
        </Field>
      )}

      {fields.language && (
        <Field label="Language" htmlFor="new-item-language">
          <Input
            id="new-item-language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder="typescript"
          />
        </Field>
      )}

      {fields.content &&
        (fields.language ? (
          // Snippets and commands get the real editor; notes and prompts keep
          // the textarea. No `htmlFor`: Monaco owns its textarea, so the editor
          // carries its own accessible name instead of being a label target.
          <Field label="Content">
            <CodeEditor
              value={content}
              onChange={setContent}
              // The live value, so retyping the Language field above
              // re-highlights immediately.
              language={language}
              ariaLabel="Content"
            />
          </Field>
        ) : (
          <Field label="Content" htmlFor="new-item-content">
            <Textarea
              id="new-item-content"
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="font-mono text-xs"
            />
          </Field>
        ))}

      <Field label="Tags" htmlFor="new-item-tags" hint="Separate with commas">
        <Input
          id="new-item-tags"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          placeholder="react, hooks"
        />
      </Field>

      <DialogFooter>
        <Button type="submit" size="sm" disabled={!canSave}>
          {isSaving ? "Creating…" : "Create item"}
        </Button>
      </DialogFooter>
    </form>
  );
}
