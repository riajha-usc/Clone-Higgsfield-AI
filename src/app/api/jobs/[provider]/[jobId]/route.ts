import { NextResponse } from "next/server";
import { providerByName } from "@/lib/providers";

export const dynamic = "force-dynamic";
// A Pollinations poll retries up to three times, six seconds apart.
export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provider: string; jobId: string }> },
) {
  const { provider: providerName, jobId } = await params;
  const provider = providerByName(providerName);
  if (!provider) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }
  try {
    const state = await provider.poll(jobId);
    return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(`jobs: poll failed for ${providerName}`, error);
    return NextResponse.json({ error: "Polling failed" }, { status: 502 });
  }
}
