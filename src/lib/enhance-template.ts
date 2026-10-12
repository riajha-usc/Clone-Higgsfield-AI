import type { GenerationType } from "@/lib/types";

/** A phrase picked when any of its keywords appears in the prompt. First match wins. */
interface Rule {
  keywords: RegExp;
  phrase: string;
}

const LIGHTING: Rule[] = [
  { keywords: /\b(neon|cyberpunk|city at night|nightclub)\b/i, phrase: "lit by saturated neon signage with glossy reflections" },
  { keywords: /\b(night|moon|midnight|stars?)\b/i, phrase: "under cool moonlight with deep blue shadows" },
  { keywords: /\b(sunset|sunrise|dawn|dusk|golden hour)\b/i, phrase: "in warm golden-hour backlight with long soft shadows" },
  { keywords: /\b(storm|rain|fog|mist|snow)\b/i, phrase: "in diffused overcast light with drifting atmospheric haze" },
  { keywords: /\b(studio|product|packshot|bottle)\b/i, phrase: "under clean softbox studio lighting with a gentle rim light" },
  { keywords: /\b(forest|jungle|woods)\b/i, phrase: "with dappled sunlight filtering through the canopy" },
  { keywords: /\b(interior|room|kitchen|cafe|office)\b/i, phrase: "in soft natural window light with warm practical lamps" },
];
const DEFAULT_LIGHTING = "in soft, directional natural light";

const LENS: Rule[] = [
  { keywords: /\b(portrait|face|woman|man|girl|boy|person|close-?up)\b/i, phrase: "shot on an 85mm lens at f/1.8 with creamy background bokeh" },
  { keywords: /\b(landscape|mountains?|desert|ocean|valley|dunes?|skyline|aerial)\b/i, phrase: "shot on a 24mm wide-angle lens with deep focus" },
  { keywords: /\b(product|macro|detail|jewel|watch|insect)\b/i, phrase: "shot on a 100mm macro lens with crisp fine detail" },
  { keywords: /\b(street|alley|crowd|market)\b/i, phrase: "shot on a 35mm lens at eye level" },
];
const DEFAULT_LENS = "shot on a 50mm lens";

const TEXTURE: Rule[] = [
  { keywords: /\b(wet|rain|ocean|water|puddle)\b/i, phrase: "slick wet surfaces and fine droplets" },
  { keywords: /\b(snow|ice|frost)\b/i, phrase: "powdery snow and crystalline frost texture" },
  { keywords: /\b(desert|sand|dunes?)\b/i, phrase: "rippled sand grain and heat shimmer" },
  { keywords: /\b(metal|robot|car|chrome)\b/i, phrase: "brushed metal and sharp specular highlights" },
];
const DEFAULT_TEXTURE = "rich natural textures and subtle film grain";

const MOOD: Rule[] = [
  { keywords: /\b(storm|dark|horror|lonely|lone|abandoned)\b/i, phrase: "a brooding, cinematic mood" },
  { keywords: /\b(calm|peaceful|serene|quiet|morning)\b/i, phrase: "a calm, serene mood" },
  { keywords: /\b(party|festival|vibrant|colorful|joy)\b/i, phrase: "an energetic, vibrant mood" },
];
const DEFAULT_MOOD = "a quietly cinematic mood";

const CAMERA_MOVE = "with a slow, steady camera move";

function pick(rules: Rule[], text: string, fallback: string): string {
  return rules.find((rule) => rule.keywords.test(text))?.phrase ?? fallback;
}

/**
 * Deterministic prompt expansion used when no Gemini key is configured. The same
 * prompt always produces the same paragraph, and every word of the original stays.
 */
export function templateEnhance(prompt: string, type: GenerationType): string {
  const base = prompt.trim().replace(/[.\s]+$/, "");
  const parts = [
    pick(LIGHTING, base, DEFAULT_LIGHTING),
    pick(LENS, base, DEFAULT_LENS),
    ...(type === "video" ? [CAMERA_MOVE] : []),
  ];
  return `${base}, ${parts.join(", ")}. Details show ${pick(TEXTURE, base, DEFAULT_TEXTURE)}, with balanced contrast and true-to-life color, creating ${pick(MOOD, base, DEFAULT_MOOD)}.`;
}
