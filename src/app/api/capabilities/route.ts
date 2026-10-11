import { NextResponse } from "next/server";
import { getCapabilities } from "@/lib/providers";

export const dynamic = "force-dynamic";

/** Reports which optional keys are configured, as booleans. Never returns the keys. */
export function GET() {
  return NextResponse.json(getCapabilities(), { headers: { "Cache-Control": "no-store" } });
}
