"use client";

import { useLive } from "@/lib/hooks/use-live";
import { getBalance } from "@/lib/repo";
import { useAppStore } from "@/lib/store";

export function formatCredits(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 3 });
}

export function CreditBadge() {
  const ready = useAppStore((s) => s.ready);
  const balance = useLive(() => getBalance(), []);
  const loaded = ready && balance !== undefined;

  return (
    <span
      className="ml-auto rounded-pill border border-lime/30 bg-lime/10 px-3 py-1 text-sm font-medium tabular-nums text-lime"
      aria-live="polite"
    >
      {loaded ? `${formatCredits(balance)} credits` : "… credits"}
    </span>
  );
}
