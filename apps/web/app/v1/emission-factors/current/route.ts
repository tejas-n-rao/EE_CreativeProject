import { NextResponse } from "next/server";

import { getCurrentEmissionFactors } from "@/lib/server/carbon-api";

export async function GET() {
  try {
    const factors = await getCurrentEmissionFactors();
    return NextResponse.json(factors);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Failed to load emission factors.";
    return NextResponse.json({ detail }, { status: 500 });
  }
}
