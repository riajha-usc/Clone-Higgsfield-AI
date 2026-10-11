"use client";

import { formatBalance } from "@/lib/format";
import { useLive } from "@/lib/hooks/use-live";
import { getBalance } from "@/lib/repo";
import { useAppStore } from "@/lib/store";

export function CreditBadge() {
  const ready = useAppStore((s) => s.ready);
  const balance = useLive(() => getBalance(), []);
  const loaded = ready && balance !== undefined;

  return (
    <span
      className="ml-auto shrink-0 whitespace-nowrap rounded-pill border border-lime/30 bg-lime/10 px-3 py-1 text-sm font-medium tabular-nums text-lime"
      aria-live="polite"
      title="Your credit balance"
    >
      {loaded ? formatBalance(balance) : "…"}
      <span className="hidden min-[420px]:inline"> credits</span>
    </span>
  );
}
