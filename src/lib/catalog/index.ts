import type { Capabilities, GenerationParams, GenerationType } from "@/lib/types";
import modelsJson from "./models.json";
import presetsJson from "./presets.json";

export interface ModelDef {
  id: string;
  displayName: string;
  type: GenerationType;
  provider: string;
  costPerGeneration: number;
  /** Optional server key this model needs; null means always available. */
  requiresCapability: keyof Capabilities | null;
  defaultParams: GenerationParams;
  /** Video models that cannot do text-to-video and need a start frame. */
  needsStartFrame: boolean;
  sortOrder: number;
}

export interface Model extends ModelDef {
  enabled: boolean;
}

export interface Preset {
  id: string;
  displayName: string;
  description: string;
  cssKeyframesName: string;
  sortOrder: number;
}

export const MODELS = (modelsJson as ModelDef[]).slice().sort((a, b) => a.sortOrder - b.sortOrder);
export const PRESETS = (presetsJson as Preset[]).slice().sort((a, b) => a.sortOrder - b.sortOrder);

export function getModel(id: string): ModelDef | undefined {
  return MODELS.find((m) => m.id === id);
}

export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}

export function isModelEnabled(model: ModelDef, caps: Capabilities | null): boolean {
  if (!model.requiresCapability) return true;
  return caps?.[model.requiresCapability] ?? false;
}

export function listModels(caps: Capabilities | null): Model[] {
  return MODELS.map((m) => ({ ...m, enabled: isModelEnabled(m, caps) }));
}

export const ASPECTS = ["1:1", "3:4", "4:3", "16:9", "9:16"] as const;
export const QUALITIES: Record<GenerationType, readonly string[]> = {
  image: ["1k", "2k"],
  video: ["480p", "720p"],
};
export const DURATIONS = [5, 8] as const;

export const PROVIDER_LABELS: Record<string, string> = {
  pollinations: "Pollinations",
  gemini: "Gemini",
  fal: "fal.ai",
  motion: "Motion",
  mock: "Mock",
};

/** "16:9" -> 16/9. Falls back to 1 for anything malformed. */
export function aspectRatio(aspect: string | undefined): number {
  const [w, h] = (aspect ?? "").split(":").map(Number);
  return w > 0 && h > 0 ? w / h : 1;
}

/**
 * Output pixel size. Image quality sets the long side (1k = 1024, 2k = 2048);
 * video quality sets the short side (480p, 720p).
 */
export function outputSize(type: GenerationType, aspect: string | undefined, quality: string | undefined) {
  const ratio = aspectRatio(aspect);
  const even = (n: number) => Math.round(n / 2) * 2;
  if (type === "image") {
    const long = quality === "1k" ? 1024 : 2048;
    return ratio >= 1 ? { width: long, height: even(long / ratio) } : { width: even(long * ratio), height: long };
  }
  const short = parseInt(quality ?? "", 10) || 480;
  return ratio >= 1 ? { width: even(short * ratio), height: short } : { width: short, height: even(short / ratio) };
}
