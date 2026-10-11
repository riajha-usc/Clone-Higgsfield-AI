import "server-only";
import type { ModelDef } from "@/lib/catalog";
import type { Capabilities, GenerationType } from "@/lib/types";
import { geminiProvider } from "./gemini";
import { mockProvider } from "./mock";
import { pollinationsProvider } from "./pollinations";
import type { GenerationProvider } from "./types";

const PROVIDERS: Record<string, GenerationProvider> = {
  [mockProvider.name]: mockProvider,
  [pollinationsProvider.name]: pollinationsProvider,
  [geminiProvider.name]: geminiProvider,
};

export class ProviderUnavailableError extends Error {}

/**
 * "mock" (the default) routes every model of that type to the mock. Any other value
 * ("pollinations" for images, or "live") sends each model to its own provider, so
 * Soul 2 and FLUX go to Pollinations and Nano Banana to Gemini.
 */
function modeFor(type: GenerationType): "mock" | "live" {
  const value =
    type === "image" ? process.env.GENERATION_PROVIDER_IMAGE : process.env.GENERATION_PROVIDER_VIDEO;
  return (value?.trim() || "mock") === "mock" ? "mock" : "live";
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
    imageMode: modeFor("image"),
    videoMode: modeFor("video"),
  };
}
