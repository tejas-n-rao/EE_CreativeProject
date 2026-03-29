import { NextResponse } from "next/server";

import { createSurvey } from "@/lib/server/carbon-api";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { country?: string; answers_json?: Record<string, unknown> };

    const survey = await createSurvey({
      country: String(body.country || "").trim(),
      answers_json: (body.answers_json || {}) as Record<string, unknown>,
    });

    return NextResponse.json(survey, { status: 201 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Failed to create survey.";
    return NextResponse.json({ detail }, { status: 400 });
  }
}
