import "server-only";
import type { GenerationProvider, JobState } from "./types";

/**
 * Motion preview: no AI video. The output is the start frame itself; the player
 * animates it with the chosen camera preset's CSS keyframes. Finishes on submit.
 */
export const motionProvider: GenerationProvider = {
  name: "motion",

  async submit(input) {
    if (!input.startFrameUrl) {
      return { jobId: input.generationId, state: { status: "failed", reason: "A motion preview needs a start frame" } };
    }
    return { jobId: input.generationId, state: { status: "succeeded", outputUrl: input.startFrameUrl } };
  },

  async poll(): Promise<JobState> {
    return { status: "failed", reason: "Motion previews finish on submit; there is nothing to poll" };
  },
};
