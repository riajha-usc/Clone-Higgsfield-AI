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
