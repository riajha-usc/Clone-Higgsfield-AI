import "server-only";
import type { GenerationProvider, JobState } from "./types";

export const SAMPLE_FILES = [
  "/samples/01-neon-alley.png",
  "/samples/02-desert-dawn.png",
  "/samples/03-glass-portrait.png",
  "/samples/04-ocean-cliff.png",
  "/samples/05-forest-mist.png",
  "/samples/06-studio-product.png",
];

const MIN_DELAY_MS = 3_000;
const MAX_DELAY_MS = 8_000;
const PENDING_MS = 1_000;

/**
 * Returns a bundled sample after a random 3–8 s delay. Holds no state: the job id
 * encodes its start time, delay and chosen sample, so any server instance can poll it.
 */
export const mockProvider: GenerationProvider = {
  name: "mock",

  async submit(input) {
    const startedAt = Date.now();
    const delay = MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1));
    // A video with a bundled start frame animates that frame, like the motion preview does.
    const startFrame = input.startFrameUrl ? SAMPLE_FILES.indexOf(input.startFrameUrl) : -1;
    const sample =
      startFrame >= 0 ? startFrame : Math.floor(Math.random() * SAMPLE_FILES.length);
    return [startedAt.toString(36), delay.toString(36), sample.toString(36)].join(".");
  },

  async poll(jobId): Promise<JobState> {
    const [startedAt, delay, sample] = jobId.split(".").map((part) => parseInt(part, 36));
    if (
      [startedAt, delay, sample].some((n) => !Number.isFinite(n)) ||
      sample < 0 ||
      sample >= SAMPLE_FILES.length
    ) {
      return { status: "failed", reason: "Unknown mock job" };
    }
    const elapsed = Date.now() - startedAt;
    if (elapsed < PENDING_MS) return { status: "pending" };
    if (elapsed < delay) return { status: "running" };
    return { status: "succeeded", outputUrl: SAMPLE_FILES[sample] };
  },
};
