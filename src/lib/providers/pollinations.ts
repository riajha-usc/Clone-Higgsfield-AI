import "server-only";
import { outputSize } from "@/lib/catalog";
import { BUSY, REJECTED, type GenerationProvider, type JobState } from "./types";

/** Free, keyless endpoint. Anonymous requests get a small fallback model. */
const LEGACY_ENDPOINT = "https://image.pollinations.ai/prompt/";
/** Keyed endpoint: honours model, size and seed, and bills the key's balance. */
const KEYED_ENDPOINT = "https://gen.pollinations.ai/image/";
/** Our proxy for keyed images, so the secret key never reaches the browser. */
export const MEDIA_ROUTE = "/api/media/pollinations";

const SUBMIT_BUDGET_MS = 20_000;
const POLL_ATTEMPTS = 3;
const POLL_ATTEMPT_BUDGET_MS = 12_000;
const POLL_GAP_MS = 6_000;

/**
 * FLUX on Pollinations snaps large requests to a few fixed sizes, and not always to
 * the requested shape (1152x1536 comes back 768x1280). Asking for at most 768x1024
 * pixels keeps the aspect: 3:4 returns exactly 768x1024 and 16:9 1024x576. The real
 * size is read from the image and stored, so the drawer never claims a size it isn't.
 */
const MAX_PIXELS = 768 * 1024;

const BAD_KEY = "Provider rejected the server's key";
const NOT_FOUND = "Provider endpoint not found";

/** Everything that defines one Pollinations image. The same spec always gives the same image. */
export interface ImageSpec {
  prompt: string;
  width: number;
  height: number;
  seed: number;
  model: string;
}

function secretKey(): string | undefined {
  return process.env.POLLINATIONS_KEY?.trim() || undefined;
}

/**
 * POLLINATIONS_BASE_URL exists so a failure can be forced end to end (point it at
 * an address that refuses connections). An unknown model name does not fail:
 * Pollinations quietly falls back to its default model.
 */
function upstream(): string {
  const override = process.env.POLLINATIONS_BASE_URL?.trim();
  if (override) return override.endsWith("/") ? override : `${override}/`;
  return secretKey() ? KEYED_ENDPOINT : LEGACY_ENDPOINT;
}

export function upstreamUrl(spec: ImageSpec): string {
  const query = new URLSearchParams({
    width: String(spec.width),
    height: String(spec.height),
    seed: String(spec.seed),
    model: spec.model,
    nologo: "true",
  });
  return `${upstream()}${encodeURIComponent(spec.prompt)}?${query}`;
}

/** The URL stored on the record: the public image, or our proxy when a key is needed. */
function outputUrl(spec: ImageSpec): string {
  if (!secretKey()) return upstreamUrl(spec);
  const query = new URLSearchParams({
    prompt: spec.prompt,
    width: String(spec.width),
    height: String(spec.height),
    seed: String(spec.seed),
    model: spec.model,
  });
  return `${MEDIA_ROUTE}?${query}`;
}

/** Reads an ImageSpec back from untrusted input (a job id or the proxy's query). */
export function parseSpec(input: Record<string, unknown>): ImageSpec | null {
  const prompt = input.prompt;
  const [width, height, seed] = [input.width, input.height, input.seed].map(Number);
  const model = input.model;
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 2000) return null;
  if (typeof model !== "string" || !/^[\w./-]{1,60}$/.test(model)) return null;
  if (![width, height].every((n) => Number.isInteger(n) && n >= 64 && n <= 2048)) return null;
  if (!Number.isInteger(seed) || seed < 0) return null;
  return { prompt, width, height, seed, model };
}

/**
 * Pollinations is synchronous: a GET on the prompt URL renders and returns the image,
 * and the same URL returns the same image again. submit fetches it once to make sure
 * it resolves; if that runs out of time the spec becomes the job id and poll retries.
 */
export const pollinationsProvider: GenerationProvider = {
  name: "pollinations",

  async submit(input) {
    const requested = outputSize("image", input.params.aspect, input.params.quality);
    const scale = Math.min(1, Math.sqrt(MAX_PIXELS / (requested.width * requested.height)));
    const [width, height] = [requested.width, requested.height].map((n) => Math.round((n * scale) / 64) * 64);
    const spec: ImageSpec = {
      prompt: input.prompt,
      width,
      height,
      seed: input.params.seed ?? Math.floor(Math.random() * 1_000_000),
      model: "flux",
    };
    const jobId = Buffer.from(JSON.stringify(spec)).toString("base64url");

    const attempt = await fetchImage(upstreamUrl(spec), SUBMIT_BUDGET_MS);
    if (attempt.ok) return { jobId, state: { status: "succeeded", outputUrl: outputUrl(spec), ...attempt.size } };
    if (!attempt.retry) return { jobId, state: { status: "failed", reason: attempt.reason } };
    return { jobId, state: { status: "running" } };
  },

  /** Retries the image up to three times, six seconds apart, then settles. */
  async poll(jobId): Promise<JobState> {
    let spec: ImageSpec | null = null;
    try {
      spec = parseSpec(JSON.parse(Buffer.from(jobId, "base64url").toString()));
    } catch {
      // Not one of ours.
    }
    if (!spec) return { status: "failed", reason: "Unknown Pollinations job" };

    let last: Attempt = { ok: false, retry: true, reason: BUSY };
    for (let i = 0; i < POLL_ATTEMPTS; i++) {
      if (i > 0) await sleep(POLL_GAP_MS);
      last = await fetchImage(upstreamUrl(spec), POLL_ATTEMPT_BUDGET_MS);
      if (last.ok) return { status: "succeeded", outputUrl: outputUrl(spec), ...last.size };
      if (!last.retry) break;
    }
    return { status: "failed", reason: last.ok ? BUSY : last.reason };
  },
};

type Attempt =
  | { ok: true; size?: { width: number; height: number } }
  | { ok: false; retry: boolean; reason: string };

/** Pixel size from a JPEG or PNG header, or undefined for anything else. */
function imageSize(bytes: Uint8Array): { width: number; height: number } | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;
  let i = 2;
  while (i + 9 < bytes.length && bytes[i] === 0xff) {
    const marker = bytes[i + 1];
    const length = view.getUint16(i + 2);
    // SOF0–SOF2 carry the frame size.
    if (marker >= 0xc0 && marker <= 0xc2) return { width: view.getUint16(i + 7), height: view.getUint16(i + 5) };
    i += 2 + length;
  }
  return undefined;
}

/** Fetches with the key when there is one. Used by submit, poll and the media proxy. */
export async function fetchUpstream(url: string, budgetMs: number): Promise<Response> {
  const secret = secretKey();
  return fetch(url, {
    headers: secret ? { Authorization: `Bearer ${secret}` } : undefined,
    signal: AbortSignal.timeout(budgetMs),
    cache: "no-store",
  });
}

async function fetchImage(url: string, budgetMs: number): Promise<Attempt> {
  let response: Response;
  try {
    response = await fetchUpstream(url, budgetMs);
  } catch {
    // Timeout or network error: the render may still finish, so try again later.
    return { ok: false, retry: true, reason: BUSY };
  }

  if (response.status === 200) {
    const type = response.headers.get("content-type") ?? "";
    const bytes = new Uint8Array(await response.arrayBuffer().catch(() => new ArrayBuffer(0)));
    if (bytes.length > 0 && type.startsWith("image/")) return { ok: true, size: imageSize(bytes) };
    return { ok: false, retry: true, reason: BUSY };
  }
  await response.body?.cancel().catch(() => {});
  if ([400, 422, 451].includes(response.status)) return { ok: false, retry: false, reason: REJECTED };
  if (response.status === 401 || response.status === 403) return { ok: false, retry: false, reason: BAD_KEY };
  if (response.status === 404) return { ok: false, retry: false, reason: NOT_FOUND };
  // 402 (balance or anonymous quota), 429 and 5xx clear up on their own; retry.
  return { ok: false, retry: true, reason: BUSY };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
