import Link from "next/link";
import { notFound } from "next/navigation";

import DashboardClient, { type DashboardPayload } from "./DashboardClient";

const apiBase =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

type PageProps = {
  params: {
    surveyId: string;
  };
};

async function getDashboard(surveyId: string): Promise<DashboardPayload> {
  const response = await fetch(`${apiBase}/v1/surveys/${surveyId}/dashboard`, {
    cache: "no-store",
  });

  if (response.status === 404) {
    notFound();
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch dashboard (${response.status})`);
  }

  return (await response.json()) as DashboardPayload;
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
