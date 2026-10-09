import Link from "next/link";
import { Layers } from "lucide-react";

import { cn } from "@/lib/utils";

/** The DevStash mark: the layers icon on the brand-gradient tile. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-6.5 shrink-0 place-items-center rounded-md bg-brand-gradient text-white",
        className,
      )}
    >
      <Layers className="size-4" aria-hidden />
    </span>
  );
}

/** Mark plus wordmark, linking home. */
export function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5 text-[1.05rem] font-bold">
      <LogoMark />
      DevStash
    </Link>
  );
}
