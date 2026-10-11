export type GenerationType = "image" | "video";
export type GenerationStatus = "queued" | "running" | "succeeded" | "failed";
export type Plan = "free" | "starter" | "plus" | "ultra";
export type Term = "monthly" | "annual";
export type LedgerReason =
  | "signup_grant"
  | "generation_debit"
  | "generation_refund"
  | "upgrade_grant";

export interface Settings {
  id: "settings";
  plan: Plan;
  term: Term;
  createdAt: number;
  enhancePromptDefault: boolean;
}

export interface LedgerEntry {
  id: string;
  delta: number;
  reason: LedgerReason;
  generationId: string | null;
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface GenerationParams {
  aspect?: string;
  quality?: string;
  duration?: number;
  seed?: number;
  presetId?: string;
  startFrameGenerationId?: string;
}

export interface Generation {
  id: string;
  projectId: string;
  type: GenerationType;
  status: GenerationStatus;
  prompt: string;
  enhancedPrompt: string | null;
  modelId: string;
  params: GenerationParams;
  cost: number;
  provider: string;
  providerJobId: string | null;
  outputUrl: string | null;
  thumbnailUrl: string | null;
  error: string | null;
  parentGenerationId: string | null;
  favourite: boolean;
  createdAt: number;
  completedAt: number | null;
}

/** Which optional server keys exist. Returned by GET /api/capabilities; never the keys themselves. */
export interface Capabilities {
  pollinations: boolean;
  gemini: boolean;
  fal: boolean;
  /** "mock" when that type returns bundled samples, "live" when it calls real providers. */
  imageMode: "mock" | "live";
  videoMode: "mock" | "live";
}
