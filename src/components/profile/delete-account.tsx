"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/auth/submit-button";
import { deleteAccount } from "@/actions/profile";

/**
 * Type-to-confirm delete gate. The destructive button stays disabled until the
 * user types their exact email, so deletion can't happen with a stray click. The
 * server action re-checks the confirmation, so this is UX, not the security
 * boundary.
 */
export function DeleteAccount({ email }: { email: string }) {
  const [value, setValue] = useState("");
  const confirmed = value.trim().toLowerCase() === email.toLowerCase();

  return (
    <form action={deleteAccount} className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor="confirmEmail" className="text-sm font-medium">
          Type <span className="font-semibold">{email}</span> to confirm
        </label>
        <Input
          id="confirmEmail"
          name="confirmEmail"
          type="text"
          autoComplete="off"
          placeholder={email}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>

      <SubmitButton
        variant="destructive"
        className="w-full sm:w-auto"
        disabled={!confirmed}
        pendingText="Deleting…"
      >
        Delete my account
      </SubmitButton>
    </form>
  );
}
