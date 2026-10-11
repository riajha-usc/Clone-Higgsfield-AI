import "server-only";
import type { ModelDef } from "@/lib/catalog";
import type { Capabilities, GenerationType } from "@/lib/types";
import { mockProvider } from "./mock";
import type { GenerationProvider } from "./types";

const PROVIDERS: Record<string, GenerationProvider> = {
  [mockProvider.name]: mockProvider,
};

export class ProviderUnavailableError extends Error {}

/** "mock" routes every model of that type to the mock; "live" uses each model's own provider. */
function modeFor(type: GenerationType): string {
  const value =
    type === "image" ? process.env.GENERATION_PROVIDER_IMAGE : process.env.GENERATION_PROVIDER_VIDEO;
  return value?.trim() || "mock";
}

export function providerForModel(model: ModelDef): GenerationProvider {
  const name = modeFor(model.type) === "mock" ? "mock" : model.provider;
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new ProviderUnavailableError(`Provider "${name}" is not implemented yet`);
  }
  return provider;
}

export function providerByName(name: string): GenerationProvider | undefined {
  return Object.hasOwn(PROVIDERS, name) ? PROVIDERS[name] : undefined;
}

export function getCapabilities(): Capabilities {
  return {
    pollinations: Boolean(process.env.POLLINATIONS_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    fal: Boolean(process.env.FAL_KEY),
  };
}
