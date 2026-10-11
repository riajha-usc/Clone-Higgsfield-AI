"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { listModels } from "@/lib/catalog";
import { useLive } from "@/lib/hooks/use-live";
import {
  chargeFor,
  formatCredits,
  formatUsd,
  FREE_PLAN,
  PAID_PLANS,
  type PlanDef,
} from "@/lib/plans";
import { getSettings } from "@/lib/repo";
import { useAppStore } from "@/lib/store";
import type { Settings, Term } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Pricing() {
  const [term, setTerm] = useState<Term>("monthly");
  const settings = useLive(() => getSettings(), []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pricing</h1>
          <p className="mt-2 max-w-xl text-sm text-text-muted">
            Every generation costs credits. Plans add credits each month. The same price applies whether you pay
            monthly or for a year up front.
          </p>
        </div>
        <TermToggle value={term} onChange={setTerm} />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {PAID_PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} term={term} settings={settings} />
        ))}
      </div>

      <FreeRow settings={settings} />
    </div>
  );
}

function TermToggle({ value, onChange }: { value: Term; onChange: (term: Term) => void }) {
  return (
    <div role="radiogroup" aria-label="Billing term" className="inline-flex self-start rounded-pill border border-line bg-panel p-1">
      {(["monthly", "annual"] as const).map((term) => (
        <button
          key={term}
          type="button"
          role="radio"
          aria-checked={value === term}
          onClick={() => onChange(term)}
          className={cn(
            "rounded-pill px-4 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring",
            value === term ? "bg-text font-medium text-bg" : "text-text-muted hover:text-text",
          )}
        >
          {term === "monthly" ? "Monthly" : "Annual"}
        </button>
      ))}
    </div>
  );
}

function PlanCard({ plan, term, settings }: { plan: PlanDef; term: Term; settings: Settings | undefined }) {
  const current = settings?.plan === plan.id;
  const perCredit = plan.monthlyPrice / plan.credits;

  return (
    <section
      aria-labelledby={`plan-${plan.id}`}
      className={cn("flex flex-col rounded-card border bg-panel p-6", current ? "border-text-muted" : "border-line")}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={`plan-${plan.id}`} className="text-lg font-semibold">
          {plan.displayName}
        </h2>
        {current && (
          <span className="rounded-pill border border-line px-2 py-0.5 text-xs text-text-muted">
            Current plan{settings ? `, ${settings.term}` : ""}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-text-muted">{plan.tagline}</p>

      <div className="mt-6 space-y-1 text-2xl font-semibold tabular-nums" data-testid={`price-${plan.id}`}>
        <p>
          {formatUsd(plan.monthlyPrice)}
          <span className="text-text-muted"> per month</span>
        </p>
        {term === "annual" && (
          <p>
            {formatUsd(chargeFor(plan, "annual"))}
            <span className="text-text-muted"> per year</span>
          </p>
        )}
      </div>
      <p className="mt-2 text-xs text-text-muted">
        {term === "annual" ? "Charged once a year, up front." : "Charged every month until you cancel."}{" "}
        ${perCredit.toFixed(3)} per credit.
      </p>

      <Link
        href={`/pricing/confirm?plan=${plan.id}&term=${term}`}
        className="mt-6 flex h-11 items-center justify-center rounded-xl bg-lime text-sm font-semibold text-lime-foreground transition-[filter] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
      >
        {current ? `Renew ${plan.displayName}` : `Choose ${plan.displayName}`}
      </Link>

      <div className="mt-6 border-t border-line pt-5">
        <p className="text-sm font-medium">{formatCredits(plan.credits)} credits every month</p>
        <CreditsBuy credits={plan.credits} />
      </div>
    </section>
  );
}

/** The plan's credits converted into generations at each model's real cost. */
function CreditsBuy({ credits, compact = false }: { credits: number; compact?: boolean }) {
  const capabilities = useAppStore((s) => s.capabilities);
  const models = listModels(capabilities).filter((m) => m.enabled);
  const soul = models.find((m) => m.id === "soul-2");
  const motion = models.find((m) => m.id === "motion-preview");
  const count = (cost: number) => formatCredits(Math.floor(credits / cost));

  const summary =
    soul && motion
      ? `About ${count(soul.costPerGeneration)} Soul 2 images or ${count(motion.costPerGeneration)} motion previews.`
      : null;

  if (compact) return summary ? <span>{summary}</span> : null;

  return (
    <>
      {summary && <p className="mt-1 text-sm text-text-muted">{summary}</p>}
      <ul className="mt-4 space-y-2 text-sm">
        {models.map((model) => (
          <li key={model.id} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-text-muted" />
            <span>
              {count(model.costPerGeneration)} {model.displayName.replace(/\s*\(.*\)$/, "")}{" "}
              <span className="text-text-muted">
                {model.type === "image" ? "images" : "videos"} at {model.costPerGeneration} each
              </span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function FreeRow({ settings }: { settings: Settings | undefined }) {
  const current = settings?.plan === "free";
  return (
    <section
      aria-labelledby="plan-free"
      className="mt-4 flex flex-col gap-2 rounded-card border border-line bg-panel px-6 py-4 text-sm sm:flex-row sm:items-center sm:gap-6"
    >
      <h2 id="plan-free" className="font-semibold">
        {FREE_PLAN.displayName}
      </h2>
      <p className="tabular-nums">{formatUsd(0)}</p>
      <p>{FREE_PLAN.credits} credits, one time</p>
      <p className="text-text-muted">
        <CreditsBuy credits={FREE_PLAN.credits} compact />
      </p>
      {current && (
        <span className="rounded-pill border border-line px-2 py-0.5 text-xs text-text-muted sm:ml-auto">Current plan</span>
      )}
    </section>
  );
}
