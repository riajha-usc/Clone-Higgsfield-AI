import type { GenerationParams, GenerationType } from "@/lib/types";

export interface ProviderInput {
  generationId: string;
  type: GenerationType;
  modelId: string;
  prompt: string;
  params: GenerationParams;
}

export type JobState =
  | { status: "pending" }
  | { status: "running" }
  | { status: "succeeded"; outputUrl: string }
  | { status: "failed"; reason: string };

export type JobStatus = JobState["status"];

export interface GenerationProvider {
  /** Stable name; the client sends it back in /api/jobs/[provider]/[jobId]. */
  readonly name: string;
  /** Starts a job and returns its id. */
  submit(input: ProviderInput): Promise<string>;
  poll(jobId: string): Promise<JobState>;
}

export function isTerminal(state: JobState): boolean {
  return state.status === "succeeded" || state.status === "failed";
}
