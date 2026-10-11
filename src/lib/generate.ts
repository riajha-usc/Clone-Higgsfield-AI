/**
 * Client-side generation flow. The browser owns the generation record and the
 * ledger; the server only proxies the provider.
 */
import { getModel } from "@/lib/catalog";
import type { JobState } from "@/lib/providers/types";
import {
  addLedgerEntry,
  createGeneration,
  getBalance,
  getGeneration,
  listGenerations,
  updateGeneration,
} from "@/lib/repo";
import type { Generation, GenerationParams, GenerationType } from "@/lib/types";

const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_DURATION_MS = 10 * 60 * 1000;
const MAX_CONSECUTIVE_POLL_ERRORS = 5;

export class InsufficientCreditsError extends Error {
  constructor(
    readonly balance: number,
    readonly cost: number,
  ) {
    super(`This costs ${cost} credits but you have ${balance}`);
    this.name = "InsufficientCreditsError";
  }
}

export interface GenerateRequest {
  projectId: string;
  type: GenerationType;
  modelId: string;
  prompt: string;
  params?: GenerationParams;
  parentGenerationId?: string | null;
}

/** Generations this tab is currently polling, so a resume never doubles up. */
const active = new Set<string>();

/**
 * Debits the model cost, submits the job and polls it to completion. Resolves with
 * the final generation (succeeded or failed); a failure refunds the full cost.
 * Throws InsufficientCreditsError, without creating anything, if the balance is short.
 */
export async function generate(request: GenerateRequest): Promise<Generation> {
  const model = getModel(request.modelId);
  if (!model) throw new Error(`Unknown model "${request.modelId}"`);
  if (model.type !== request.type) {
    throw new Error(`${model.displayName} does not make ${request.type}s`);
  }

  const cost = model.costPerGeneration;
  const balance = await getBalance();
  if (balance < cost) throw new InsufficientCreditsError(balance, cost);

  const params = { ...model.defaultParams, ...request.params };
  const generation = await createGeneration({
    projectId: request.projectId,
    type: request.type,
    prompt: request.prompt,
    modelId: model.id,
    params,
    cost,
    parentGenerationId: request.parentGenerationId ?? null,
  });
  await addLedgerEntry({ delta: -cost, reason: "generation_debit", generationId: generation.id });
  active.add(generation.id);

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationId: generation.id,
        type: generation.type,
        modelId: generation.modelId,
        prompt: generation.prompt,
        params,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      return await fail(generation.id, body.error ?? `Submit failed (${response.status})`);
    }
    await updateGeneration(generation.id, {
      status: "running",
      provider: body.provider,
      providerJobId: body.providerJobId,
    });
    return await pollUntilDone(generation.id, body.provider, body.providerJobId);
  } catch (error) {
    return await fail(generation.id, error instanceof Error ? error.message : "Generation failed");
  } finally {
    active.delete(generation.id);
  }
}

/**
 * Picks up generations left unfinished by a reload or a closed tab. Submitted jobs
 * resume polling; anything that never reached the provider is failed and refunded.
 */
export async function resumePendingGenerations(): Promise<void> {
  const pending = (await listGenerations()).filter(
    (g) => (g.status === "queued" || g.status === "running") && !active.has(g.id),
  );
  await Promise.all(
    pending.map(async (g) => {
      active.add(g.id);
      try {
        if (g.provider && g.providerJobId) {
          await pollUntilDone(g.id, g.provider, g.providerJobId);
        } else {
          await fail(g.id, "Interrupted before it reached the provider");
        }
      } catch (error) {
        await fail(g.id, error instanceof Error ? error.message : "Generation failed");
      } finally {
        active.delete(g.id);
      }
    }),
  );
}

async function pollUntilDone(id: string, provider: string, jobId: string): Promise<Generation> {
  const deadline = Date.now() + MAX_POLL_DURATION_MS;
  const url = `/api/jobs/${encodeURIComponent(provider)}/${encodeURIComponent(jobId)}`;
  let consecutiveErrors = 0;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    let state: JobState;
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`Polling failed (${response.status})`);
      state = await response.json();
      consecutiveErrors = 0;
    } catch (error) {
      if (++consecutiveErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
        return fail(id, error instanceof Error ? error.message : "Lost contact with the provider");
      }
      continue;
    }

    if (state.status === "succeeded") {
      await updateGeneration(id, {
        status: "succeeded",
        outputUrl: state.outputUrl,
        thumbnailUrl: state.outputUrl,
        error: null,
        completedAt: Date.now(),
      });
      return (await getGeneration(id))!;
    }
    if (state.status === "failed") return fail(id, state.reason);
  }
  return fail(id, "Timed out waiting for the provider");
}

/** Marks a generation failed and refunds its full cost, once. */
async function fail(id: string, reason: string): Promise<Generation> {
  const current = await getGeneration(id);
  if (!current) throw new Error(`Generation ${id} disappeared`);
  if (current.status === "succeeded" || current.status === "failed") return current;

  await updateGeneration(id, { status: "failed", error: reason, completedAt: Date.now() });
  await addLedgerEntry({ delta: current.cost, reason: "generation_refund", generationId: id });
  return (await getGeneration(id))!;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
