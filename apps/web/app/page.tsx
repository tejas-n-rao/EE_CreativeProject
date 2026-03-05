const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export default function HomePage() {
  return (
    <main className="container">
      <h1>Carbon Calculator</h1>
      <p>Monorepo scaffold is ready.</p>
      <p>
        API health endpoint: <code>{apiBase}/health</code>
      </p>
    </main>
  );
}
