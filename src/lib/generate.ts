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
import { useAppStore } from "@/lib/store";
import type { Generation, GenerationParams, GenerationType } from "@/lib/types";

const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_DURATION_MS = 10 * 60 * 1000;
const MAX_CONSECUTIVE_POLL_ERRORS = 5;
/** Pollinations allows about one request every five seconds per IP. */
const POLLINATIONS_GAP_MS = 5_000;

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
  /** When set, this is what the provider receives; prompt stays as the user wrote it. */
  enhancedPrompt?: string | null;
  params?: GenerationParams;
  parentGenerationId?: string | null;
  /**
   * Called once the generation row and its debit exist, before the provider is
   * contacted. startsInMs is above zero when the request waits for a rate-limit slot.
   */
  onQueued?: (generation: Generation, startsInMs: number) => void;
}

/** Generations this tab is currently polling, so a resume never doubles up. */
const active = new Set<string>();

/** When the next Pollinations request may go out from this tab. */
let nextPollinationsSlot = 0;

/** Reserves the next free slot and returns how long to wait for it. */
function reservePollinationsSlot(): number {
  const now = Date.now();
  const startAt = Math.max(now, nextPollinationsSlot);
  nextPollinationsSlot = startAt + POLLINATIONS_GAP_MS;
  return startAt - now;
}

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
  // Stored with the record so the same image can be reproduced later.
  if (model.type === "image" && params.seed === undefined) params.seed = Math.floor(Math.random() * 1_000_000);
  const startFrame = params.startFrameGenerationId
    ? await getGeneration(params.startFrameGenerationId)
    : undefined;
  if (params.startFrameGenerationId && !startFrame?.outputUrl) {
    throw new Error("The start frame is missing or not finished");
  }
  if (model.type === "video" && model.needsStartFrame && !startFrame) {
    throw new Error(`${model.displayName} needs a start frame`);
  }
  const generation = await createGeneration({
    projectId: request.projectId,
    type: request.type,
    prompt: request.prompt,
    enhancedPrompt: request.enhancedPrompt?.trim() || null,
    modelId: model.id,
    params,
    cost,
    parentGenerationId: request.parentGenerationId ?? null,
  });
  await addLedgerEntry({ delta: -cost, reason: "generation_debit", generationId: generation.id });
  active.add(generation.id);

  const throttled = model.provider === "pollinations" && useAppStore.getState().capabilities?.imageMode === "live";
  const waitMs = throttled ? reservePollinationsSlot() : 0;
  request.onQueued?.(generation, waitMs);

  try {
    if (waitMs > 0) {
      const { setQueuedUntil } = useAppStore.getState();
      setQueuedUntil(generation.id, Date.now() + waitMs);
      await sleep(waitMs);
      setQueuedUntil(generation.id, null);
    }
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationId: generation.id,
        type: generation.type,
        modelId: generation.modelId,
        prompt: generation.enhancedPrompt ?? generation.prompt,
        params,
        startFrameUrl: startFrame?.outputUrl ?? undefined,
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
    // Synchronous providers (Pollinations, Gemini) usually answer on submit.
    const state = body.state as JobState | null;
    if (state?.status === "succeeded") return await succeed(generation.id, state.outputUrl);
    if (state?.status === "failed") return await fail(generation.id, state.reason);
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

    if (state.status === "succeeded") return succeed(id, state.outputUrl);
    if (state.status === "failed") return fail(id, state.reason);
  }
  return fail(id, "Timed out waiting for the provider");
}

async function succeed(id: string, providerUrl: string): Promise<Generation> {
  const current = await getGeneration(id);
  if (!current) throw new Error(`Generation ${id} disappeared`);
  // A motion preview's artifact is its start frame; the player animates it.
  let outputUrl = providerUrl;
  if (getModel(current.modelId)?.provider === "motion" && current.params.startFrameGenerationId) {
    outputUrl = (await getGeneration(current.params.startFrameGenerationId))?.outputUrl ?? providerUrl;
  }
  await updateGeneration(id, {
    status: "succeeded",
    outputUrl,
    thumbnailUrl: outputUrl,
    error: null,
    completedAt: Date.now(),
  });
  return (await getGeneration(id))!;
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

export interface Enhancement {
  enhancedPrompt: string;
  source: "gemini" | "template";
}

/** Asks the server to expand a prompt into one detailed paragraph. */
export async function enhancePrompt(prompt: string, type: GenerationType, signal?: AbortSignal): Promise<Enhancement> {
  const response = await fetch("/api/enhance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, type }),
    signal,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `Enhance failed (${response.status})`);
  return body as Enhancement;
}
