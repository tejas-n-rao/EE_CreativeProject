import { NextResponse } from "next/server";

import { getSurveyDashboard } from "@/lib/server/carbon-api";

type RouteContext = {
  params: {
    surveyId: string;
  };
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const dashboard = await getSurveyDashboard(context.params.surveyId);
    return NextResponse.json(dashboard);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Failed to load survey dashboard.";
    return NextResponse.json({ detail }, { status: 404 });
  }
}
