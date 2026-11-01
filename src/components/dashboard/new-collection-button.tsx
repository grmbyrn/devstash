"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FolderPlus } from "lucide-react";
import { toast } from "sonner";

import { createCollection } from "@/actions/collections";
import { Button } from "@/components/ui/button";
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

/**
 * The header's "New collection" button and the dialog it opens. Like
 * `NewItemButton`, it owns its own open state so the server-component layout
 * needs no provider around it.
 */
export function NewCollectionButton() {
  const [isOpen, setOpen] = React.useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <FolderPlus />
          {/* Icon-only on phones, where the label would squeeze the search
              field down to a couple of characters; screen readers keep it. */}
          <span className="sr-only sm:not-sr-only">New collection</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New collection</DialogTitle>
          <DialogDescription>
            Group related items so they&apos;re easy to find together.
          </DialogDescription>
        </DialogHeader>
        {/* Radix unmounts the content on close, so reopening starts blank. */}
        <NewCollectionForm onCreated={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function NewCollectionForm({ onCreated }: { onCreated: () => void }) {
  const router = useRouter();

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [isSaving, setSaving] = React.useState(false);

  const canSave = name.trim().length > 0 && !isSaving;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSave) return;

    setSaving(true);
    try {
      const result = await createCollection({ name, description });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Collection created");
      onCreated();
      // Re-render the server components behind the dialog so the dashboard
      // grid, its stats and the sidebar's recents all pick up the new row.
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Name" htmlFor="new-collection-name">
        <Input
          id="new-collection-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="React Patterns"
          maxLength={100}
          required
          autoFocus
        />
      </Field>

      <Field label="Description" htmlFor="new-collection-description">
        <Textarea
          id="new-collection-description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
        />
      </Field>

      <DialogFooter>
        <Button type="submit" size="sm" disabled={!canSave}>
          {isSaving ? "Creating…" : "Create collection"}
        </Button>
      </DialogFooter>
    </form>
  );
}
