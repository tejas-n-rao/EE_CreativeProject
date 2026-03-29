import { NextResponse } from "next/server";

import { calculateSurvey } from "@/lib/server/carbon-api";

type RouteContext = {
  params: {
    surveyId: string;
  };
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const result = await calculateSurvey(context.params.surveyId);
    return NextResponse.json(result);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Failed to calculate survey.";
    return NextResponse.json({ detail }, { status: 400 });
  }
}
