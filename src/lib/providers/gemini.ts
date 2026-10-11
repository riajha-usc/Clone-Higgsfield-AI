import "server-only";
import { ApiError, GoogleGenAI } from "@google/genai";
import { BUSY, REJECTED, type GenerationProvider, type JobState } from "./types";

const MODEL = "gemini-2.5-flash-image";
const TIMEOUT_MS = 50_000;
const BLOCKED = new Set(["SAFETY", "PROHIBITED_CONTENT", "IMAGE_SAFETY", "BLOCKLIST", "SPII", "RECITATION"]);

let client: GoogleGenAI | null = null;
function gemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  client ??= new GoogleGenAI({ apiKey, httpOptions: { timeout: TIMEOUT_MS } });
  return client;
}

/**
 * Gemini 2.5 Flash Image, called synchronously from submit. The image comes back
 * inline and is returned as a data URL, which the client stores on the record.
 * Nothing is left to poll.
 */
export const geminiProvider: GenerationProvider = {
  name: "gemini",

  async submit(input) {
    const jobId = input.generationId;
    return { jobId, state: await render(input.prompt, input.params.aspect) };
  },

  async poll(): Promise<JobState> {
    return { status: "failed", reason: "Gemini jobs finish on submit; there is nothing to poll" };
  },
};

async function render(prompt: string, aspect: string | undefined): Promise<JobState> {
  try {
    const response = await gemini().models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseModalities: ["IMAGE"],
        ...(aspect && { imageConfig: { aspectRatio: aspect } }),
      },
    });
    if (response.promptFeedback?.blockReason) return { status: "failed", reason: REJECTED };
    const candidate = response.candidates?.[0];
    const image = candidate?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
    if (image?.data) {
      return { status: "succeeded", outputUrl: `data:${image.mimeType ?? "image/png"};base64,${image.data}` };
    }
    const finish = String(candidate?.finishReason ?? "");
    return { status: "failed", reason: BLOCKED.has(finish) ? REJECTED : BUSY };
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) {
      const badKey = /api key/i.test(error.message);
      return { status: "failed", reason: badKey ? "The server's Gemini key is not valid" : REJECTED };
    }
    console.error("gemini: generateContent failed", error);
    return { status: "failed", reason: BUSY };
  }
}
