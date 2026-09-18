"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { deleteItem } from "@/actions/items";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Confirmation in front of deleting an item.
 *
 * Deletion is permanent — there is no undo and no trash — so the item is named
 * in the prompt and the destructive button is never the one focused on open
 * (Radix sends focus to Cancel).
 *
 * Reports the deleted id back to the caller, which owns the drawer's open
 * state; this component only runs the mutation and refreshes the grid behind it.
 */
export function DeleteItemDialog({
  open,
  onOpenChange,
  itemId,
  itemTitle,
  onDeleted,
  returnFocusTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  itemTitle: string;
  onDeleted: (id: string) => void;
  /** The control that opened this, to hand focus back to on dismiss. */
  returnFocusTo?: React.RefObject<HTMLButtonElement | null>;
}) {
  const router = useRouter();
  const [isDeleting, setDeleting] = React.useState(false);

  async function handleConfirm(event: React.MouseEvent) {
    // Keep the dialog up while the request is in flight, so the button can show
    // progress instead of the UI snapping shut on an action that may still fail.
    event.preventDefault();
    if (isDeleting) return;

    setDeleting(true);
    try {
      const result = await deleteItem(itemId);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      onOpenChange(false);
      onDeleted(itemId);
      toast.success("Item deleted");
      // Re-render the server components behind the drawer so the card grid and
      // the counts drop the deleted item.
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        // Radix restores focus to whatever opened the dialog, but here `open`
        // is driven by state rather than an `AlertDialogTrigger`, and nesting
        // inside the drawer's own focus scope leaves focus on `<body>` — which
        // would strand a keyboard user at the top of the page with the drawer
        // still open. Put it back on the Delete button, unless that button has
        // gone away because the delete succeeded and the drawer closed.
        onCloseAutoFocus={(event) => {
          const trigger = returnFocusTo?.current;
          if (!trigger?.isConnected) return;

          event.preventDefault();
          trigger.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this item?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium text-foreground">{itemTitle}</span>{" "}
            will be permanently deleted, along with its tags and its place in
            any collections. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isDeleting}
            className={cn(buttonVariants({ variant: "destructive" }))}
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
