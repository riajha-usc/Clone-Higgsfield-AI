import { NextResponse } from "next/server";
import { getModel, isModelEnabled } from "@/lib/catalog";
import { getCapabilities, providerForModel, ProviderUnavailableError } from "@/lib/providers";
import type { GenerationParams } from "@/lib/types";

export const dynamic = "force-dynamic";
// Pollinations and Gemini render inside submit (Pollinations has a 20 s budget).
export const maxDuration = 60;

const MAX_PROMPT_LENGTH = 2000;
// Gemini outputs are data URLs; they can be start frames too.
const MAX_DATA_URL_LENGTH = 4_000_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function badRequest(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function parseParams(raw: unknown): GenerationParams | null {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const params: GenerationParams = {};
  for (const key of ["aspect", "quality", "presetId", "startFrameGenerationId"] as const) {
    const value = input[key];
    if (value === undefined) continue;
    if (typeof value !== "string" || value.length > 100) return null;
    params[key] = value;
  }
  for (const key of ["duration", "seed"] as const) {
    const value = input[key];
    if (value === undefined) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    params[key] = value;
  }
  return params;
}

function isStartFrameUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.startsWith("data:image/")) return value.length <= MAX_DATA_URL_LENGTH;
  return value.length <= 2048 && /^(\/samples\/|https:\/\/)/.test(value);
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON");
  }

  const { generationId, type, modelId, prompt } = body;
  if (typeof generationId !== "string" || !UUID.test(generationId)) {
    return badRequest("generationId must be a UUID");
  }
  if (type !== "image" && type !== "video") {
    return badRequest('type must be "image" or "video"');
  }
  const model = typeof modelId === "string" ? getModel(modelId) : undefined;
  if (!model) return badRequest("Unknown modelId");
  if (model.type !== type) return badRequest(`${model.displayName} does not make ${type}s`);
  if (!isModelEnabled(model, getCapabilities())) {
    return badRequest(`${model.displayName} is not enabled on this server`);
  }
  if (typeof prompt !== "string" || prompt.length > MAX_PROMPT_LENGTH) {
    return badRequest(`prompt must be a string of at most ${MAX_PROMPT_LENGTH} characters`);
  }
  if (prompt.trim() === "") return badRequest("prompt is empty");
  const params = parseParams(body.params);
  if (!params) return badRequest("params is malformed");
  const { startFrameUrl } = body;
  if (startFrameUrl !== undefined && !isStartFrameUrl(startFrameUrl)) {
    return badRequest("startFrameUrl must be a sample path, an https URL or an image data URL");
  }
  if (type === "video" && model.needsStartFrame && !startFrameUrl) {
    return badRequest(`${model.displayName} needs a start frame`);
  }

  try {
    const provider = providerForModel(model);
    const { jobId, state } = await provider.submit({
      generationId,
      type,
      modelId: model.id,
      prompt: prompt.trim(),
      params,
      startFrameUrl,
    });
    return NextResponse.json({ providerJobId: jobId, provider: provider.name, state: state ?? null });
  } catch (error) {
    if (error instanceof ProviderUnavailableError) return badRequest(error.message, 501);
    console.error("generate: submit failed", error);
    return badRequest("The provider could not start this job", 502);
  }
}
