import { NextResponse } from "next/server";
import { fetchUpstream, parseSpec, upstreamUrl } from "@/lib/providers/pollinations";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Serves a keyed Pollinations image. The URL holds only the image's spec (prompt,
 * size, seed, model); the key is added here on the server. A year-long immutable
 * cache lets the CDN answer repeat views without asking Pollinations again.
 */
export async function GET(request: Request) {
  const spec = parseSpec(Object.fromEntries(new URL(request.url).searchParams));
  if (!spec) return NextResponse.json({ error: "Not a valid image" }, { status: 400 });

  let upstream: Response;
  try {
    upstream = await fetchUpstream(upstreamUrl(spec), 25_000);
  } catch {
    return NextResponse.json({ error: "The image service didn't answer in time" }, { status: 504 });
  }
  const type = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || !type.startsWith("image/") || !upstream.body) {
    await upstream.body?.cancel().catch(() => {});
    return NextResponse.json(
      { error: "The image service couldn't return this image" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
  return new Response(upstream.body, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
