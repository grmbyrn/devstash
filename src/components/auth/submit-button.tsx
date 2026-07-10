"use client";

import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * Submit button that reflects the enclosing form's pending state. Kept as a
 * small client island so the auth pages themselves stay server components.
 */
export function SubmitButton({
  children,
  pendingText,
  ...props
}: ButtonProps & { pendingText?: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}
