/**
 * Client-side generation flow. The browser owns the generation record and the
 * ledger; the server only proxies the provider.
 */
import { getModel } from "@/lib/catalog";
import { formatBalance, formatCost } from "@/lib/format";
import type { JobState } from "@/lib/providers/types";
import {
  addLedgerEntry,
  createGeneration,
  elementImageUrl,
  getElement,
  getBalance,
  getGeneration,
  listGenerations,
  updateGeneration,
} from "@/lib/repo";
import { useAppStore } from "@/lib/store";
import type { Generation, GenerationParams, GenerationType } from "@/lib/types";

const NETWORK = "Couldn't reach the server. Check your connection and try again";

/** A failed /api/generate answer, in words. Server error bodies are for developers. */
function submitFailure(status: number): string {
  if (status === 400) return "The server couldn't read this request. Reload the page and try again";
  if (status === 501) return "This model isn't set up on the server yet. Pick another one";
  if (status >= 500) return "The generation service couldn't start this job. Try again in a moment";
  return `The server turned this request down (error ${status}). Try again`;
}

/** fetch, with network failures turned into a sentence a person can act on. */
async function fetchOrExplain(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error(NETWORK);
  }
}

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
    super(
      `This costs ${formatCost(cost)} ${cost === 1 ? "credit" : "credits"} and you have ${formatBalance(balance)}. Upgrade or pick a cheaper model.`,
    );
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
  if (!model) throw new Error("That model is no longer available. Pick another one.");
  if (model.type !== request.type) {
    throw new Error(`${model.displayName} can't make ${request.type}s. Pick a ${request.type} model.`);
  }

  const cost = model.costPerGeneration;
  const balance = await getBalance();
  if (balance < cost) throw new InsufficientCreditsError(balance, cost);

  const params = { ...model.defaultParams, ...request.params };
  // Stored with the record so the same image can be reproduced later.
  if (model.type === "image" && params.seed === undefined) params.seed = Math.floor(Math.random() * 1_000_000);
  const startFrameUrl = await startFrameUrlFor(params);
  if ((params.startFrameGenerationId || params.startFrameElementId) && !startFrameUrl) {
    throw new Error("The start frame was deleted or hasn't finished. Choose another one.");
  }
  if (model.type === "video" && model.needsStartFrame && !startFrameUrl) {
    throw new Error(`${model.displayName} needs a start frame. Add an image first.`);
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
        startFrameUrl: startFrameUrl ?? undefined,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      return await fail(generation.id, submitFailure(response.status));
    }
    await updateGeneration(generation.id, {
      status: "running",
      provider: body.provider,
      providerJobId: body.providerJobId,
    });
    // Synchronous providers (Pollinations, Gemini) usually answer on submit.
    const state = body.state as JobState | null;
    if (state?.status === "succeeded") return await succeed(generation.id, state.outputUrl, state);
    if (state?.status === "failed") return await fail(generation.id, state.reason);
    return await pollUntilDone(generation.id, body.provider, body.providerJobId);
  } catch (error) {
    // fetch rejects with a TypeError when the network is down; anything else is ours.
    return await fail(
      generation.id,
      error instanceof TypeError ? NETWORK : "Something went wrong while starting this generation",
    );
  } finally {
    active.delete(generation.id);
  }
}

/**
 * Picks up generations left unfinished by a reload or a closed tab. Submitted jobs
 * resume polling; anything that never reached the provider is failed and refunded.
 */
export async function resumePendingGenerations(): Promise<Generation[]> {
  const pending = (await listGenerations()).filter(
    (g) => (g.status === "queued" || g.status === "running") && !active.has(g.id),
  );
  return Promise.all(
    pending.map(async (g) => {
      active.add(g.id);
      try {
        if (g.provider && g.providerJobId) return await pollUntilDone(g.id, g.provider, g.providerJobId);
        return await fail(g.id, "The page was closed before this generation started");
      } catch {
        return await fail(g.id, NETWORK);
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
    } catch {
      if (++consecutiveErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
        return fail(id, "Lost contact with the server while waiting for the result");
      }
      continue;
    }

    if (state.status === "succeeded") return succeed(id, state.outputUrl, state);
    if (state.status === "failed") return fail(id, state.reason);
  }
  return fail(id, "The provider took more than 10 minutes, so it was stopped");
}

/** The start frame's image: a generation's output or an element's image. */
async function startFrameUrlFor(params: GenerationParams): Promise<string | null> {
  if (params.startFrameGenerationId) return (await getGeneration(params.startFrameGenerationId))?.outputUrl ?? null;
  if (params.startFrameElementId) {
    const element = await getElement(params.startFrameElementId);
    return element ? elementImageUrl(element) : null;
  }
  return null;
}

async function succeed(
  id: string,
  providerUrl: string,
  size?: { width?: number; height?: number },
): Promise<Generation> {
  const current = await getGeneration(id);
  if (!current) throw new Error(`Generation ${id} disappeared`);
  // A motion preview's artifact is its start frame; the player animates it.
  const startFrameUrl = (await startFrameUrlFor(current.params)) ?? undefined;
  let outputUrl = providerUrl;
  if (getModel(current.modelId)?.provider === "motion" && startFrameUrl) outputUrl = startFrameUrl;
  // An <img> cannot show an MP4, so a real video's thumbnail is its start frame.
  const isVideoFile = /\.(mp4|webm|mov)(\?|$)/i.test(outputUrl);
  await updateGeneration(id, {
    status: "succeeded",
    ...(size?.width && size.height && { params: { ...current.params, outputWidth: size.width, outputHeight: size.height } }),
    outputUrl,
    thumbnailUrl: isVideoFile ? (startFrameUrl ?? null) : outputUrl,
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
  const response = await fetchOrExplain("/api/enhance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, type }),
    signal,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Couldn't write the enhanced prompt");
  return body as Enhancement;
}
