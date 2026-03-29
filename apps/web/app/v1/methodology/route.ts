import { NextResponse } from "next/server";

import { getMethodology } from "@/lib/server/carbon-api";

export async function GET() {
  try {
    const methodology = await getMethodology();
    return NextResponse.json(methodology);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Failed to load methodology.";
    return NextResponse.json({ detail }, { status: 500 });
  }
}
