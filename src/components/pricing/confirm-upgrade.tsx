"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { chargeFor, formatCredits, formatUsd, getPlan, isTerm } from "@/lib/plans";
import { listProjects, upgradePlan } from "@/lib/repo";
import { useAppStore } from "@/lib/store";

export function ConfirmUpgrade({ planId, termValue }: { planId: string | undefined; termValue: string | undefined }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  // Settings must exist (first-run seeding) before the plan can be stored.
  const ready = useAppStore((s) => s.ready);
  const plan = getPlan(planId);
  const term = isTerm(termValue) ? termValue : undefined;

  if (!plan || plan.id === "free" || !term) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold tracking-tight">Nothing to confirm</h1>
        <p className="mt-3 text-sm text-text-muted">That plan or billing term does not exist.</p>
        <Link href="/pricing" className="mt-6 inline-block text-sm underline underline-offset-2">
          See plans
        </Link>
      </Shell>
    );
  }

  const charge = formatUsd(chargeFor(plan, term));
  const credits = formatCredits(plan.credits);

  async function confirm() {
    if (!plan || !term || busy || !ready) return;
    setBusy(true);
    try {
      await upgradePlan(plan.id, term, plan.credits);
      // Back to the Studio, in the project used most recently.
      const projects = await listProjects();
      const recent = projects.slice().sort((a, b) => b.updatedAt - a.updatedAt)[0];
      toast.success(`${credits} credits added`);
      router.push(recent ? `/p/${recent.id}` : "/");
    } catch {
      toast.error("Could not complete the upgrade");
      setBusy(false);
    }
  }

  return (
    <Shell>
      <h1 className="text-2xl font-semibold tracking-tight">Confirm {plan.displayName}</h1>

      <div className="mt-6 rounded-card border border-line bg-panel p-6">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Plan</dt>
            <dd>
              {plan.displayName}, {term}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Credits</dt>
            <dd className="tabular-nums">{credits} each month</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Due today</dt>
            <dd className="font-semibold tabular-nums">{charge}</dd>
          </div>
        </dl>

        <p className="mt-6 text-base" data-testid="charge-statement">
          {term === "monthly"
            ? `You will be charged ${charge} today and every month until you cancel. You get ${credits} credits each month.`
            : `You will be charged ${charge} today for 12 months. You get ${credits} credits each month.`}
        </p>

        <button
          type="button"
          onClick={() => void confirm()}
          disabled={busy || !ready}
          className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-lime text-sm font-semibold text-lime-foreground transition-[filter,opacity] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime disabled:opacity-50"
        >
          Confirm upgrade
        </button>
        <p className="mt-3 text-center text-xs text-text-muted">
          Demo: no payment is taken. Credits are added to this browser.
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <Link
        href="/pricing"
        className="mb-8 inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-text"
      >
        <ChevronLeft className="size-4" />
        Plans
      </Link>
      {children}
    </div>
  );
}
