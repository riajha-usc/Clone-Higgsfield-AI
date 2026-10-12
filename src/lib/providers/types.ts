import type { GenerationParams, GenerationType } from "@/lib/types";

export interface ProviderInput {
  generationId: string;
  type: GenerationType;
  modelId: string;
  prompt: string;
  params: GenerationParams;
  /** Output URL of the start frame generation, for video jobs that have one. */
  startFrameUrl?: string;
}

export type JobState =
  | { status: "pending" }
  | { status: "running" }
  /** width and height, when known, are the output's real pixel size. */
  | { status: "succeeded"; outputUrl: string; width?: number; height?: number }
  | { status: "failed"; reason: string };

/** Readable failure reasons shared by the real providers. */
export const BUSY = "Provider busy, try again";
export const REJECTED = "Prompt rejected by provider";

export type JobStatus = JobState["status"];

export interface SubmitResult {
  jobId: string;
  /**
   * Set when the provider already knows the outcome (synchronous providers).
   * Absent or non-terminal means the client polls the job.
   */
  state?: JobState;
}

export interface GenerationProvider {
  /** Stable name; the client sends it back in /api/jobs/[provider]/[jobId]. */
  readonly name: string;
  /** Starts a job. May finish it outright, in which case the result carries the final state. */
  submit(input: ProviderInput): Promise<SubmitResult>;
  poll(jobId: string): Promise<JobState>;
}

export function isTerminal(state: JobState): boolean {
  return state.status === "succeeded" || state.status === "failed";
}
