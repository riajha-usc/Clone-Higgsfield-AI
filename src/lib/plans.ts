import { MODELS } from "@/lib/catalog";
import type { Plan, Term } from "@/lib/types";

export interface PlanDef {
  id: Plan;
  displayName: string;
  /** USD per month. Annual is the same rate billed as twelve months up front. */
  monthlyPrice: number;
  /** Credits granted per month (free: once, at first visit). */
  credits: number;
  tagline: string;
}

export const FREE_PLAN: PlanDef = {
  id: "free",
  displayName: "Free",
  monthlyPrice: 0,
  credits: 10,
  tagline: "10 credits, one time, when you first open the app.",
};

export const PAID_PLANS: PlanDef[] = [
  { id: "starter", displayName: "Starter", monthlyPrice: 19, credits: 270, tagline: "For trying ideas every week." },
  { id: "plus", displayName: "Plus", monthlyPrice: 59, credits: 1200, tagline: "For regular image and video work." },
  { id: "ultra", displayName: "Ultra", monthlyPrice: 129, credits: 3000, tagline: "For high volume projects." },
];

export function getPlan(id: string | null | undefined): PlanDef | undefined {
  if (id === FREE_PLAN.id) return FREE_PLAN;
  return PAID_PLANS.find((plan) => plan.id === id);
}

export function isTerm(value: string | null | undefined): value is Term {
  return value === "monthly" || value === "annual";
}

/** What is charged today for this term. */
export function chargeFor(plan: PlanDef, term: Term): number {
  return term === "annual" ? plan.monthlyPrice * 12 : plan.monthlyPrice;
}

/** "$708" or "$19.50": whole dollars without cents. */
export function formatUsd(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  });
}

export function formatCredits(value: number): string {
  return value.toLocaleString("en-US");
}

/** How many generations a credit amount buys on each model, from the real catalog costs. */
export function whatCreditsBuy(credits: number) {
  return MODELS.map((model) => ({
    model,
    count: Math.floor(credits / model.costPerGeneration),
  }));
}
