import Link from "next/link";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export default function HomePage() {
  return (
    <main className="container">
      <h1>Carbon Calculator</h1>
      <p>Choose a survey mode to estimate your footprint.</p>
      <p>
        API health endpoint: <code>{apiBase}/health</code>
      </p>
      <p>
        <Link href="/accessible-survey">Start Accessible Survey</Link>
      </p>
      <p>
        <Link href="/monthly-survey">Start Monthly Survey</Link>
      </p>
      <p>
        <Link href="/methodology">View methodology</Link>
      </p>
      <p>
        Dashboard route: <code>/dashboard/&lt;survey-id&gt;</code>
      </p>
    </main>
  );
}
