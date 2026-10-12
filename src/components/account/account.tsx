"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBalance, formatCost, formatDateTime } from "@/lib/format";
import { useLive } from "@/lib/hooks/use-live";
import { chargeFor, formatCredits, formatUsd, getPlan } from "@/lib/plans";
import { cancelPlan, getSettings, listLedger, resetDemo } from "@/lib/repo";
import type { LedgerReason } from "@/lib/types";
import { cn } from "@/lib/utils";

const REASON_LABELS: Record<LedgerReason, string> = {
  signup_grant: "Free credits on first visit",
  generation_debit: "Generation",
  generation_refund: "Refund for a failed generation",
  upgrade_grant: "Plan credits",
};

export function Account() {
  const settings = useLive(() => getSettings(), []);
  const ledger = useLive(() => listLedger(), []);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Running balance after each entry, summed oldest first, shown newest first.
  let running = 0;
  const rows = (ledger ?? []).map((entry) => {
    running = Math.round((running + entry.delta) * 1000) / 1000;
    return { entry, balance: running };
  });
  rows.reverse();
  const balance = running;
  const plan = getPlan(settings?.plan);

  async function cancel() {
    try {
      await cancelPlan();
      toast("Plan cancelled. Your credits stay.");
    } catch {
      toast.error("Couldn't cancel the plan. Try again.");
    }
  }

  async function reset() {
    setResetting(true);
    try {
      await resetDemo();
      // A full load drops every open query and in-memory job on the old database.
      window.location.assign("/p/demo");
    } catch {
      toast.error("Couldn't reset. Close other tabs of this app and try again.");
      setResetting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
      <p className="mt-2 text-sm text-text-muted">There is no login. Everything here lives in this browser.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <section className="rounded-card border border-line bg-panel p-6" aria-labelledby="plan-heading">
          <h2 id="plan-heading" className="text-xs font-medium uppercase tracking-wider text-text-muted">
            Plan
          </h2>
          {settings === undefined || !plan ? (
            <Skeleton className="mt-3 h-8 w-32" />
          ) : (
            <>
              <p className="mt-3 text-2xl font-semibold" data-testid="current-plan">
                {plan.displayName}
              </p>
              <p className="mt-1 text-sm text-text-muted">
                {plan.id === "free"
                  ? "10 credits, one time."
                  : `${formatUsd(chargeFor(plan, settings.term))} ${settings.term === "annual" ? "per year" : "per month"}, ${formatCredits(plan.credits)} credits each month.`}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href="/pricing">{plan.id === "free" ? "See plans" : "Change plan"}</Link>
                </Button>
                {plan.id !== "free" && (
                  <Button variant="outline" onClick={() => void cancel()}>
                    Cancel plan
                  </Button>
                )}
              </div>
            </>
          )}
        </section>

        <section className="rounded-card border border-line bg-panel p-6" aria-labelledby="balance-heading">
          <h2 id="balance-heading" className="text-xs font-medium uppercase tracking-wider text-text-muted">
            Balance
          </h2>
          {ledger === undefined ? (
            <Skeleton className="mt-3 h-8 w-32" />
          ) : (
            <>
              <p className="mt-3 text-2xl font-semibold tabular-nums text-lime" data-testid="account-balance">
                {formatCost(balance)} credits
              </p>
              <p className="mt-1 text-sm text-text-muted">
                The header shows {formatBalance(balance)}, rounded down to one decimal.
              </p>
            </>
          )}
        </section>
      </div>

      <section className="mt-8" aria-labelledby="ledger-heading">
        <h2 id="ledger-heading" className="mb-3 text-xs font-medium uppercase tracking-wider text-text-muted">
          Ledger
        </h2>
        <div className="overflow-x-auto rounded-card border border-line bg-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-text-muted">
                <th className="px-3 py-3 font-medium sm:px-4">Date</th>
                <th className="px-3 py-3 font-medium sm:px-4">Reason</th>
                <th className="px-3 py-3 text-right font-medium sm:px-4">Change</th>
                <th className="px-3 py-3 text-right font-medium sm:px-4">Balance</th>
              </tr>
            </thead>
            <tbody>
              {ledger === undefined ? (
                <tr>
                  <td colSpan={4} className="px-4 py-3">
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ) : (
                rows.map(({ entry, balance: after }) => (
                  <tr key={entry.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-3 text-text-muted sm:whitespace-nowrap sm:px-4">{formatDateTime(entry.createdAt)}</td>
                    <td className="px-3 py-3 sm:px-4">{REASON_LABELS[entry.reason] ?? entry.reason}</td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-3 py-3 text-right tabular-nums sm:px-4",
                        entry.delta > 0 ? "text-lime" : "text-text",
                      )}
                    >
                      {entry.delta > 0 ? "+" : "−"}
                      {formatCost(Math.abs(entry.delta))}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums sm:px-4">{formatCost(after)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10 rounded-card border border-line p-6" aria-labelledby="reset-heading">
        <h2 id="reset-heading" className="text-sm font-medium">
          Reset demo
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Deletes every project, generation and ledger entry in this browser and starts again with 10 credits.
        </p>
        <Button variant="destructive" className="mt-4" onClick={() => setConfirmReset(true)}>
          Reset demo
        </Button>
      </section>

      <Dialog open={confirmReset} onOpenChange={(open) => !resetting && setConfirmReset(open)}>
        <DialogContent>
          <DialogTitle>Reset the demo?</DialogTitle>
          <DialogDescription>
            All projects, generations, favourites, plan and credits in this browser are deleted. This cannot be undone.
          </DialogDescription>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={resetting}>
                Cancel
              </Button>
            </DialogClose>
            <Button variant="destructive" disabled={resetting} onClick={() => void reset()}>
              {resetting ? "Resetting…" : "Reset demo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
