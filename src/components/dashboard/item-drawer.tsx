"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  ExternalLink,
  FolderPlus,
  Pencil,
  Pin,
  Star,
  Tag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { updateItem } from "@/actions/items";
import { Button } from "@/components/ui/button";
import { CodeEditor } from "@/components/ui/code-editor";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { ItemDetail, ItemWithMeta } from "@/lib/db/items";
import { formatFileSize, relativeTime } from "@/lib/format";
import { editableFields } from "@/lib/item-types";
import { parseTagInput } from "@/lib/validations/item";
import { cn } from "@/lib/utils";

import { DeleteItemDialog } from "./delete-item-dialog";
import { ItemTypeIcon } from "./item-type-icon";

interface ItemDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The clicked card's data — renders instantly, before detail arrives. */
  preview: ItemWithMeta | null;
  /** Full detail from `/api/items/[id]`; null while loading or on error. */
  detail: ItemDetail | null;
  error: string | null;
  /** Hands a saved edit back to the provider, which owns `detail`. */
  onSaved: (item: ItemDetail) => void;
  /** Tells the provider an item is gone, so it can close the drawer. */
  onDeleted: (id: string) => void;
}

export function ItemDrawer({
  open,
  onOpenChange,
  preview,
  detail,
  error,
  onSaved,
  onDeleted,
}: ItemDrawerProps) {
  // Detail supersedes the card data once it lands; until then the card's copy
  // fills the header so opening the drawer never flashes an empty shell.
  const item = detail ?? preview;
  const isLoading = !detail && !error;

  // Edit mode is stored as *which item* is being edited, not a bare boolean, so
  // switching cards leaves it behind automatically: the id no longer matches,
  // and no effect is needed to reset it.
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const isEditing = detail !== null && editingId === detail.id;

  // The delete confirmation is keyed the same way, for the same reason: a
  // confirm left open can never belong to a different item than the one on
  // screen.
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const isConfirmingDelete = detail !== null && deletingId === detail.id;
  const deleteButtonRef = React.useRef<HTMLButtonElement | null>(null);

  function handleOpenChange(next: boolean) {
    // Closing discards an in-progress edit, so reopening the same card starts
    // in view mode rather than back in a stale form.
    if (!next) {
      setEditingId(null);
      setDeletingId(null);
    }
    onOpenChange(next);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        description="Item details"
        className="w-full gap-0 overflow-y-auto sm:max-w-lg"
      >
        {item && (
          <>
            <header className="flex items-start gap-3 border-b border-border p-4 pr-12">
              <span
                className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"
                style={{ color: item.type.color }}
              >
                <ItemTypeIcon name={item.type.icon} className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <SheetTitle className="truncate text-lg font-semibold leading-tight text-foreground">
                  {item.title}
                </SheetTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {detail ? (
                    relativeTime(detail.updatedAt)
                  ) : (
                    <span className="inline-block h-3 w-20 animate-pulse rounded bg-muted align-middle" />
                  )}
                </p>
              </div>
            </header>

            {isEditing && detail ? (
              <ItemEditForm
                // Remount per item, so the inputs re-seed from the new detail
                // rather than holding the previous item's text.
                key={detail.id}
                item={detail}
                onCancel={() => setEditingId(null)}
                onSaved={(updated) => {
                  onSaved(updated);
                  // A save can resolve after the drawer has moved on (closing
                  // mid-save is possible — Escape isn't blocked while saving),
                  // so only leave edit mode if this is still the item being
                  // edited. Otherwise a stale completion would kick the user
                  // out of an edit they have since started on another card.
                  setEditingId((current) =>
                    current === updated.id ? null : current,
                  );
                }}
              />
            ) : (
              <>
                <ActionBar
                  isFavorite={item.isFavorite}
                  isPinned={item.isPinned}
                  // Editing needs the full detail, which the card preview does
                  // not carry, so the pencil waits for the fetch to land.
                  canEdit={Boolean(detail)}
                  onEdit={() => detail && setEditingId(detail.id)}
                  // Delete waits for detail too: it names the item in the
                  // confirmation, and an item whose fetch failed is not one to
                  // offer deleting.
                  canDelete={Boolean(detail)}
                  onDelete={() => detail && setDeletingId(detail.id)}
                  deleteRef={deleteButtonRef}
                />

                <div className="flex flex-col gap-5 p-4">
                  {error ? (
                    <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                      {error}
                    </p>
                  ) : isLoading ? (
                    <DetailSkeleton />
                  ) : (
                    detail && <ItemBody item={detail} />
                  )}
                </div>

                {detail && (
                  <DeleteItemDialog
                    open={isConfirmingDelete}
                    onOpenChange={(next) =>
                      setDeletingId(next ? detail.id : null)
                    }
                    itemId={detail.id}
                    itemTitle={detail.title}
                    onDeleted={onDeleted}
                    returnFocusTo={deleteButtonRef}
                  />
                )}
              </>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Favorite / Pin / Copy / Edit / Delete.
 *
 * Edit and Delete are live; Favorite, Pin and Copy stay disabled until their own
 * mutations land. Favorite and Pin still reflect the item's current state.
 */
function ActionBar({
  isFavorite,
  isPinned,
  canEdit,
  onEdit,
  canDelete,
  onDelete,
  deleteRef,
}: {
  isFavorite: boolean;
  isPinned: boolean;
  canEdit: boolean;
  onEdit: () => void;
  canDelete: boolean;
  onDelete: () => void;
  deleteRef: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-border px-3 py-2">
      <ActionButton
        icon={
          <Star className={cn(isFavorite && "fill-yellow-400 text-yellow-400")} />
        }
        label="Favorite"
        active={isFavorite}
      />
      <ActionButton
        icon={<Pin className={cn(isPinned && "fill-current")} />}
        label="Pin"
        active={isPinned}
      />
      <ActionButton icon={<Copy />} label="Copy" />
      <ActionButton
        icon={<Pencil />}
        label="Edit"
        onClick={onEdit}
        disabled={!canEdit}
        title={canEdit ? "Edit" : "Loading…"}
      />
      <ActionButton
        icon={<Trash2 />}
        label="Delete"
        onClick={onDelete}
        disabled={!canDelete}
        title={canDelete ? "Delete" : "Loading…"}
        buttonRef={deleteRef}
        className="ml-auto text-destructive"
      />
    </div>
  );
}

/**
 * One action-bar button. Without an `onClick` it renders disabled and titled
 * "coming soon", which is still true of every action but Edit.
 */
function ActionButton({
  icon,
  label,
  active = false,
  className,
  onClick,
  disabled,
  title,
  buttonRef,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  const isDisabled = disabled ?? !onClick;

  return (
    <button
      type="button"
      ref={buttonRef}
      onClick={onClick}
      disabled={isDisabled}
      title={title ?? `${label} — coming soon`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0",
        !isDisabled &&
          "hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        active && "text-foreground",
        className,
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ItemBody({ item }: { item: ItemDetail }) {
  // Snippets and commands render in the real editor; every other type keeps the
  // plain block. `editableFields(...).language` is already exactly that pair —
  // keying off it rather than a second list means the two can't drift.
  const isCode = editableFields(item.type.name).language;

  return (
    <>
      {item.description && (
        <p className="text-sm text-muted-foreground">{item.description}</p>
      )}

      {item.url && (
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 break-all text-sm text-primary hover:underline"
        >
          <ExternalLink className="size-3.5 shrink-0" />
          {item.url}
        </a>
      )}

      {item.content &&
        (isCode ? (
          <CodeEditor
            value={item.content}
            language={item.language}
            ariaLabel={`${item.title} — code`}
          />
        ) : (
          <pre className="overflow-x-auto whitespace-pre-wrap wrap-break-word rounded-md bg-muted/50 p-3 font-mono text-xs leading-relaxed text-foreground">
            {item.content}
          </pre>
        ))}

      {item.fileUrl && (
        <a
          href={item.fileUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm hover:bg-accent"
        >
          <span className="min-w-0 truncate">{item.fileName ?? "File"}</span>
          {item.fileSize !== null && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatFileSize(item.fileSize)}
            </span>
          )}
        </a>
      )}

      <Section icon={<Tag className="size-3.5" />} title="Tags">
        {item.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No tags yet.</p>
        )}
      </Section>

      <Section icon={<FolderPlus className="size-3.5" />} title="Collections">
        {item.collections.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {item.collections.map((collection) => (
              <span
                key={collection.id}
                className="rounded bg-muted px-2 py-0.5 text-xs text-foreground"
              >
                {collection.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Not in any collection.
          </p>
        )}
      </Section>
    </>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading item…</span>
      <div className="h-24 animate-pulse rounded-md bg-muted/50" />
      <div className="flex flex-col gap-2">
        <div className="h-3 w-16 animate-pulse rounded bg-muted" />
        <div className="flex gap-1.5">
          <div className="h-5 w-12 animate-pulse rounded bg-muted" />
          <div className="h-5 w-16 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

/**
 * Edit mode: the same drawer with its fields swapped for inputs.
 *
 * Which fields appear is driven by `editableFields`, and the payload carries
 * exactly those keys — so saving a snippet never sends `url`, and the server
 * leaves that column alone rather than clearing it.
 *
 * Controlled inputs with local state, no form library: the only validation here
 * is the empty-title guard on Save, which is a convenience. The server action
 * re-validates everything and is the source of truth.
 */
function ItemEditForm({
  item,
  onCancel,
  onSaved,
}: {
  item: ItemDetail;
  onCancel: () => void;
  onSaved: (updated: ItemDetail) => void;
}) {
  const router = useRouter();
  const fields = editableFields(item.type.name);

  const [title, setTitle] = React.useState(item.title);
  const [description, setDescription] = React.useState(item.description ?? "");
  const [content, setContent] = React.useState(item.content ?? "");
  const [language, setLanguage] = React.useState(item.language ?? "");
  const [url, setUrl] = React.useState(item.url ?? "");
  const [tagInput, setTagInput] = React.useState(item.tags.join(", "));
  const [isSaving, setSaving] = React.useState(false);

  const canSave = title.trim().length > 0 && !isSaving;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSave) return;

    setSaving(true);
    try {
      const result = await updateItem(item.id, {
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

      onSaved(result.data);
      toast.success("Item saved");
      // Re-render the server components behind the drawer so the card grid
      // picks up the new title, preview and tags.
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Button type="submit" size="sm" disabled={!canSave}>
          {isSaving ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </Button>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <Field label="Title" htmlFor="item-title">
          <Input
            id="item-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />
        </Field>

        <Field label="Description" htmlFor="item-description">
          <Textarea
            id="item-description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        {fields.url && (
          <Field label="URL" htmlFor="item-url">
            {/* Deliberately not type="url": native validation would block
                submit on its own terms, so the schema's message never reached
                the user and errors arrived on two different surfaces.
                `inputMode` keeps the URL keyboard on mobile. */}
            <Input
              id="item-url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </Field>
        )}

        {fields.language && (
          <Field label="Language" htmlFor="item-language">
            <Input
              id="item-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="typescript"
            />
          </Field>
        )}

        {fields.content &&
          (fields.language ? (
            // No `htmlFor`: Monaco owns its textarea, so the editor carries its
            // own accessible name instead of being a label target.
            <Field label="Content">
              <CodeEditor
                value={content}
                onChange={setContent}
                // The live value, so retyping the Language field above
                // re-highlights immediately rather than on save.
                language={language}
                ariaLabel="Content"
              />
            </Field>
          ) : (
            <Field label="Content" htmlFor="item-content">
              <Textarea
                id="item-content"
                rows={10}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="font-mono text-xs"
              />
            </Field>
          ))}

        <Field label="Tags" htmlFor="item-tags" hint="Separate with commas">
          <Input
            id="item-tags"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="react, hooks"
          />
        </Field>

        {/* Shown, not editable — the type is fixed and collections are managed
            separately. */}
        <dl className="flex flex-col gap-1 border-t border-border pt-3 text-xs text-muted-foreground">
          <Meta term="Type" value={item.type.name} />
          <Meta
            term="Collections"
            value={
              item.collections.length > 0
                ? item.collections.map((c) => c.name).join(", ")
                : "None"
            }
          />
          <Meta term="Created" value={relativeTime(item.createdAt)} />
          <Meta term="Updated" value={relativeTime(item.updatedAt)} />
        </dl>
      </div>
    </form>
  );
}

function Meta({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0">{term}</dt>
      <dd className="min-w-0 flex-1 truncate text-foreground">{value}</dd>
    </div>
  );
}
