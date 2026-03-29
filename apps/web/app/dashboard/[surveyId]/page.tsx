import Link from "next/link";
import { notFound } from "next/navigation";

import { getSurveyDashboard } from "@/lib/server/carbon-api";
import DashboardClient, { type DashboardPayload } from "./DashboardClient";

type PageProps = {
  params: {
    surveyId: string;
  };
};

async function getDashboard(surveyId: string): Promise<DashboardPayload> {
  try {
    const payload = await getSurveyDashboard(surveyId);
    return payload as DashboardPayload;
  } catch {
    notFound();
  }
}

export default async function DashboardPage({ params }: PageProps) {
  const dashboard = await getDashboard(params.surveyId);

  return (
    <main className="dashboard-page">
      <header className="dashboard-hero">
        <p className="eyebrow">Dashboard</p>
        <h1>Survey Carbon Dashboard</h1>
        <Link href="/methodology" className="back-link">
          View methodology
        </Link>
      </header>

      <DashboardClient data={dashboard} />
    </main>
  );
}
