import "server-only";
import { outputSize } from "@/lib/catalog";
import { BUSY, REJECTED, type GenerationProvider, type JobState } from "./types";

const DEFAULT_ENDPOINT = "https://image.pollinations.ai/prompt/";
const SUBMIT_BUDGET_MS = 20_000;
const POLL_ATTEMPTS = 3;
const POLL_ATTEMPT_BUDGET_MS = 12_000;
const POLL_GAP_MS = 6_000;

const BAD_KEY = "Provider rejected the server's key";
const NOT_FOUND = "Provider endpoint not found";

/**
 * POLLINATIONS_BASE_URL exists so a failure can be forced end to end (point it at
 * an address that refuses connections). An unknown model name does not fail:
 * Pollinations quietly falls back to its default model.
 */
function endpoint(): string {
  const value = process.env.POLLINATIONS_BASE_URL?.trim();
  if (!value) return DEFAULT_ENDPOINT;
  return value.endsWith("/") ? value : `${value}/`;
}

type Attempt = { ok: true } | { ok: false; retry: boolean; reason: string };

/**
 * Pollinations is synchronous: a GET on the prompt URL renders and returns the image.
 * The same URL (prompt, size, seed, model) returns the same image, so the URL itself
 * is the stored output. submit fetches it once to make sure it resolves; if that
 * runs out of time the URL becomes the job id and poll retries it.
 */
export const pollinationsProvider: GenerationProvider = {
  name: "pollinations",

  async submit(input) {
    const { width, height } = outputSize("image", input.params.aspect, input.params.quality);
    const seed = input.params.seed ?? Math.floor(Math.random() * 1_000_000);
    const query = new URLSearchParams({
      width: String(width),
      height: String(height),
      seed: String(seed),
      model: "flux",
      nologo: "true",
    });
    const url = `${endpoint()}${encodeURIComponent(input.prompt)}?${query}`;
    const jobId = Buffer.from(url).toString("base64url");

    const attempt = await fetchImage(url, SUBMIT_BUDGET_MS);
    if (attempt.ok) return { jobId, state: { status: "succeeded", outputUrl: url } };
    if (!attempt.retry) return { jobId, state: { status: "failed", reason: attempt.reason } };
    return { jobId, state: { status: "running" } };
  },

  /** Retries the URL up to three times, six seconds apart, then settles. */
  async poll(jobId): Promise<JobState> {
    const url = Buffer.from(jobId, "base64url").toString();
    // The job id comes from the browser; only ever fetch Pollinations URLs.
    if (!url.startsWith(endpoint())) return { status: "failed", reason: "Unknown Pollinations job" };

    let last: Attempt = { ok: false, retry: true, reason: BUSY };
    for (let i = 0; i < POLL_ATTEMPTS; i++) {
      if (i > 0) await sleep(POLL_GAP_MS);
      last = await fetchImage(url, POLL_ATTEMPT_BUDGET_MS);
      if (last.ok) return { status: "succeeded", outputUrl: url };
      if (!last.retry) break;
    }
    return { status: "failed", reason: last.ok ? BUSY : last.reason };
  },
};

async function fetchImage(url: string, budgetMs: number): Promise<Attempt> {
  const key = process.env.POLLINATIONS_KEY?.trim();
  let response: Response;
  try {
    response = await fetch(url, {
      headers: key ? { Authorization: `Bearer ${key}` } : undefined,
      signal: AbortSignal.timeout(budgetMs),
      cache: "no-store",
    });
  } catch {
    // Timeout or network error: the render may still finish, so try again later.
    return { ok: false, retry: true, reason: BUSY };
  }

  if (response.status === 200) {
    const type = response.headers.get("content-type") ?? "";
    const bytes = (await response.arrayBuffer().catch(() => new ArrayBuffer(0))).byteLength;
    if (bytes > 0 && type.startsWith("image/")) return { ok: true };
    return { ok: false, retry: true, reason: BUSY };
  }
  await response.body?.cancel().catch(() => {});
  if ([400, 422, 451].includes(response.status)) return { ok: false, retry: false, reason: REJECTED };
  if (response.status === 401 || response.status === 403) return { ok: false, retry: false, reason: BAD_KEY };
  if (response.status === 404) return { ok: false, retry: false, reason: NOT_FOUND };
  // 402 (anonymous quota used up), 429 and 5xx clear up on their own; retry.
  return { ok: false, retry: true, reason: BUSY };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
