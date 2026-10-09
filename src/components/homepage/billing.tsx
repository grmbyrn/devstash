"use client";

import { createContext, use, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { Billing, PlanPrice } from "./content";

const BillingContext = createContext<{
  billing: Billing;
  setBilling: (billing: Billing) => void;
} | null>(null);

function useBilling() {
  const context = use(BillingContext);
  if (!context) throw new Error("useBilling must be used inside <BillingProvider>");
  return context;
}

/** Holds the monthly/yearly choice for the pricing section. */
export function BillingProvider({ children }: { children: React.ReactNode }) {
  const [billing, setBilling] = useState<Billing>("monthly");
  return <BillingContext value={{ billing, setBilling }}>{children}</BillingContext>;
}

/** Monthly ↔ yearly switch. */
export function BillingSwitch() {
  const { billing, setBilling } = useBilling();
  const yearly = billing === "yearly";

  return (
    <div className="flex items-center justify-center gap-3.5 font-semibold">
      <span className={cn("transition-colors", yearly ? "text-muted-foreground" : "text-foreground")}>
        Monthly
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={yearly}
        aria-label="Bill yearly"
        onClick={() => setBilling(yearly ? "monthly" : "yearly")}
        className="relative h-6.5 w-12 rounded-full border border-input bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-checked:bg-brand"
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform",
            yearly && "translate-x-5.5",
          )}
        />
      </button>
      <span
        className={cn(
          "inline-flex items-center gap-2 transition-colors",
          yearly ? "text-foreground" : "text-muted-foreground",
        )}
      >
        Yearly
        <Badge className="bg-emerald-500/15 text-emerald-400">Save 25%</Badge>
      </span>
    </div>
  );
}

/** A plan's price — fixed, or following the billing switch. */
export function PlanPriceDisplay({ price }: { price: PlanPrice | Record<Billing, PlanPrice> }) {
  const { billing } = useBilling();
  const { amount, period, note } = "amount" in price ? price : price[billing];

  return (
    <>
      <p className="mt-6 flex items-baseline gap-1">
        <span className="text-5xl font-extrabold tracking-tight">{amount}</span>
        <span className="text-muted-foreground">{period}</span>
      </p>
      <p className="mt-0.5 mb-6 min-h-5 text-sm text-muted-foreground">{note}</p>
    </>
  );
}
