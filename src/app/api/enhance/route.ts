import { ApiError, GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { templateEnhance } from "@/lib/enhance-template";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_PROMPT_LENGTH = 2000;
/**
 * gemini-2.5-flash is the intended model, but Google no longer offers it to new
 * keys (404). Then the next one is tried, and the first that works is remembered for
 * this server instance. flash-lite comes next because a rewrite takes it 2–5 s,
 * against 8–25 s on gemini-3.8-flash.
 */
const MODELS = ["gemini-2.5-flash", "gemini-3.1-flash-lite", "gemini-3.8-flash"];
let firstModel = 0;
const TIMEOUT_MS = 25_000;
const INSTRUCTION =
  "Rewrite this image or video prompt into a single vivid paragraph of 60 to 90 words that preserves every stated subject, setting, and style and adds concrete lighting, lens, and texture detail. Return only the paragraph.";

export type EnhanceSource = "gemini" | "template";

/**
 * Expands a prompt into one detailed paragraph. Uses Gemini when GEMINI_API_KEY is
 * set and falls back to a keyword template when it is missing or the call fails.
 * The response says which one wrote it.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const { prompt, type } = body;
  if (typeof prompt !== "string" || prompt.trim() === "" || prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json(
      { error: `prompt must be a non-empty string of at most ${MAX_PROMPT_LENGTH} characters` },
      { status: 400 },
    );
  }
  if (type !== "image" && type !== "video") {
    return NextResponse.json({ error: 'type must be "image" or "video"' }, { status: 400 });
  }

  const fromGemini = await withGemini(prompt.trim());
  const enhancedPrompt = fromGemini ?? templateEnhance(prompt, type);
  const source: EnhanceSource = fromGemini ? "gemini" : "template";
  return NextResponse.json({ enhancedPrompt, source }, { headers: { "Cache-Control": "no-store" } });
}

async function withGemini(prompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: TIMEOUT_MS } });
  for (let i = firstModel; i < MODELS.length; i++) {
    try {
      const response = await ai.models.generateContent({
        model: MODELS[i],
        contents: prompt,
        config: {
          systemInstruction: INSTRUCTION,
          // A rewrite needs no reasoning budget; keeps latency down.
          thinkingConfig: { thinkingBudget: 0 },
        },
      });
      firstModel = i;
      const text = response.text?.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, " ");
      return text && text.length <= MAX_PROMPT_LENGTH ? text : null;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404 && i + 1 < MODELS.length) continue;
      console.error(`enhance: Gemini (${MODELS[i]}) failed, using the template`, error);
      return null;
    }
  }
  return null;
}
