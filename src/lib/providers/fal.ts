import "server-only";
import { BUSY, REJECTED, type GenerationProvider, type JobState } from "./types";

const MODEL = "fal-ai/bytedance/seedance/v1.5/pro/image-to-video";
const ASPECTS = new Set(["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"]);
const RESOLUTIONS = new Set(["480p", "720p", "1080p"]);
const TIMEOUT_MS = 20_000;

/** FAL_QUEUE_BASE_URL exists only so tests can point this at a stand-in server. */
function queueBase(): string {
  return (process.env.FAL_QUEUE_BASE_URL?.trim() || "https://queue.fal.run").replace(/\/$/, "");
}

function headers() {
  const key = process.env.FAL_KEY?.trim();
  if (!key) throw new Error("FAL_KEY is not set");
  return { Authorization: `Key ${key}`, "Content-Type": "application/json" };
}

/** The job id carries the request id plus the status and result URLs fal returned. */
interface FalJob {
  id: string;
  status: string;
  response: string;
}

const encode = (job: FalJob) => Buffer.from(JSON.stringify(job)).toString("base64url");

function decode(jobId: string): FalJob | null {
  try {
    const job = JSON.parse(Buffer.from(jobId, "base64url").toString()) as FalJob;
    // The id comes back from the browser; only ever call fal's own queue.
    const base = queueBase();
    if (typeof job.id !== "string" || !job.status?.startsWith(base) || !job.response?.startsWith(base)) return null;
    return job;
  } catch {
    return null;
  }
}

/**
 * Seedance 1.5 Pro image-to-video through fal's queue API. submit posts the start
 * frame and prompt; poll reads the status endpoint and, once COMPLETED, the result
 * for the MP4 URL.
 */
export const falProvider: GenerationProvider = {
  name: "fal",

  async submit(input) {
    if (!input.startFrameUrl) {
      return { jobId: input.generationId, state: { status: "failed", reason: "Seedance needs a start frame" } };
    }
    const { aspect, quality, duration, seed } = input.params;
    const response = await fetch(`${queueBase()}/${MODEL}`, {
      method: "POST",
      headers: headers(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        prompt: input.prompt,
        image_url: input.startFrameUrl,
        resolution: quality && RESOLUTIONS.has(quality) ? quality : "480p",
        duration: String(duration ?? 5),
        ...(aspect && ASPECTS.has(aspect) && { aspect_ratio: aspect }),
        ...(seed !== undefined && { seed }),
        // A motion preview has no sound either, and audio costs extra.
        generate_audio: false,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || typeof body.request_id !== "string") {
      console.error(`fal: submit failed (${response.status})`, JSON.stringify(body).slice(0, 500));
      return { jobId: input.generationId, state: { status: "failed", reason: failureReason(response.status, body) } };
    }
    const job: FalJob = {
      id: body.request_id,
      status: body.status_url ?? `${queueBase()}/${MODEL}/requests/${body.request_id}/status`,
      response: body.response_url ?? `${queueBase()}/${MODEL}/requests/${body.request_id}`,
    };
    return { jobId: encode(job), state: { status: "pending" } };
  },

  async poll(jobId): Promise<JobState> {
    const job = decode(jobId);
    if (!job) return { status: "failed", reason: "Unknown fal job" };

    const statusResponse = await fetch(job.status, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!statusResponse.ok) {
      // A transient error keeps the job alive; the client gives up after repeated failures.
      if (statusResponse.status >= 500 || statusResponse.status === 429) throw new Error(`fal status ${statusResponse.status}`);
      const detail = await statusResponse.json().catch(() => ({}));
      console.error(`fal: status failed (${statusResponse.status})`, JSON.stringify(detail).slice(0, 500));
      return { status: "failed", reason: failureReason(statusResponse.status, detail) };
    }
    const status = (await statusResponse.json()) as { status?: string };
    if (status.status === "IN_QUEUE") return { status: "pending" };
    if (status.status !== "COMPLETED") return { status: "running" };

    const result = await fetch(job.response, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    const body = await result.json().catch(() => ({}));
    const url = body?.video?.url;
    if (result.ok && typeof url === "string") return { status: "succeeded", outputUrl: url };
    console.error(`fal: result failed (${result.status})`, JSON.stringify(body).slice(0, 500));
    return { status: "failed", reason: failureReason(result.status, body) };
  },
};

/** fal's error bodies carry a `detail` string (or a list of validation errors). */
function failureReason(status: number, body?: unknown): string {
  const detail = JSON.stringify((body as { detail?: unknown } | undefined)?.detail ?? "").toLowerCase();
  if (/balance|billing|locked|credit|payment/.test(detail)) {
    return "The fal.ai account has no balance left. Top it up at fal.ai/dashboard/billing";
  }
  if (status === 401) return "The server's fal key was refused";
  if (status === 403) return "fal.ai refused this request for the server's account";
  if (status === 422 || status === 400) return REJECTED;
  return BUSY;
}
