import Link from "next/link";

type MethodologyItem = {
  id?: string;
  version_name?: string;
  equation_string?: string;
  description?: string | null;
  created_at?: string;
  source_name?: string;
  source_url?: string;
  citations?: Array<{ title?: string; url?: string }>;
};

type EmissionFactorSource = {
  name: string;
  url: string;
};

type MethodologyApiPayload =
  | MethodologyItem[]
  | {
      methodology?: MethodologyItem[];
      emission_factor_sources?: Array<{
        source_name?: string;
        name?: string;
        source_url?: string;
        url?: string;
      }>;
    };

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const FALLBACK_EQUATION = "Emissions = Activity Data × Emission Factor";

function asMethodologyItems(payload: MethodologyApiPayload): MethodologyItem[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload.methodology)) {
    return payload.methodology;
  }
  return [];
}

function extractSourceList(
  payload: MethodologyApiPayload,
  items: MethodologyItem[],
): EmissionFactorSource[] {
  const seen = new Set<string>();
  const sources: EmissionFactorSource[] = [];

  const addSource = (name?: string, url?: string) => {
    const sourceName = (name || "").trim();
    const sourceUrl = (url || "").trim();
    if (!sourceName || !sourceUrl) {
      return;
    }

    const key = `${sourceName}::${sourceUrl}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    sources.push({ name: sourceName, url: sourceUrl });
  };

  if (!Array.isArray(payload)) {
    for (const source of payload.emission_factor_sources || []) {
      addSource(source.source_name || source.name, source.source_url || source.url);
    }
  }

  for (const item of items) {
    addSource(item.source_name, item.source_url);

    for (const citation of item.citations || []) {
      addSource(citation.title, citation.url);
    }
  }

  return sources;
}

async function getMethodologyData(): Promise<{
  equation: string;
  methodology: MethodologyItem[];
  sources: EmissionFactorSource[];
  errorMessage: string | null;
}> {
  try {
    const response = await fetch(`${apiBase}/v1/methodology`, { cache: "no-store" });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const detail = typeof body?.detail === "string" ? body.detail : null;
      return {
        equation: FALLBACK_EQUATION,
        methodology: [],
        sources: [],
        errorMessage:
          detail || `Methodology API returned ${response.status}. Check API setup and seed data.`,
      };
    }

    const payload = (await response.json()) as MethodologyApiPayload;
    const methodology = asMethodologyItems(payload);
    const sources = extractSourceList(payload, methodology);

    const equation = methodology[0]?.equation_string || FALLBACK_EQUATION;

    return { equation, methodology, sources, errorMessage: null };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown fetch error";
    return {
      equation: FALLBACK_EQUATION,
      methodology: [],
      sources: [],
      errorMessage: `Could not reach API at ${apiBase}. ${reason}`,
    };
  }
}

export default async function MethodologyPage() {
  const { equation, methodology, sources, errorMessage } = await getMethodologyData();

  return (
    <main className="methodology-page">
      <header className="methodology-hero">
        <p className="eyebrow">Methodology</p>
        <h1>How This Calculator Works</h1>
        <p>
          Transparent logic for greenhouse-gas accounting and benchmark interpretation.
        </p>
        <Link href="/" className="back-link">
          Back to home
        </Link>
      </header>

      {errorMessage && (
        <section className="inline-warning">
          <p>
            <strong>Methodology data is unavailable:</strong> {errorMessage}
          </p>
          <p>
            Run <code>alembic upgrade head</code> and <code>python scripts/seed_data.py</code>{" "}
            in <code>apps/api</code>, then reload this page.
          </p>
        </section>
      )}

      <section className="methodology-section">
        <h2>1) Calculation Method</h2>
        <p className="equation">{equation}</p>
        <ul>
          <li>
            <strong>Activity data:</strong> User-reported consumption or travel values from
            the survey (for example, kWh or km).
          </li>
          <li>
            <strong>Emission factors:</strong> Category and region-specific factors from the
            API that convert each activity unit into kgCO2e.
          </li>
          <li>
            <strong>Aggregation:</strong> Category-level emissions are calculated first, then
            summed into total monthly footprint.
          </li>
        </ul>

        {methodology.length > 0 && (
          <div className="methodology-cards">
            {methodology.map((item, index) => (
              <article
                key={item.id || `${item.version_name}-${index}`}
                className="methodology-card"
              >
                <h3>{item.version_name || `Methodology ${index + 1}`}</h3>
                <p>{item.description || "No description provided by API."}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="methodology-section">
        <h2>2) Data Sources</h2>
        {sources.length > 0 ? (
          <ul>
            {sources.map((source) => (
              <li key={`${source.name}-${source.url}`}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.name}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            No emission factor source records were included in the current{" "}
            <code>/v1/methodology</code> response.
          </p>
        )}
      </section>

      <section className="methodology-section">
        <h2>3) Benchmarks</h2>
        <p>
          The app annualizes monthly emissions and compares them to per-capita annual
          benchmarks for India and the world. Carbon indexes are computed as ratio-based
          scores where 100 represents benchmark parity.
        </p>
      </section>

      <section className="methodology-section">
        <h2>4) Limitations</h2>
        <ul>
          <li>
            <strong>Averages:</strong> Per-capita benchmarks are population averages and do
            not fully represent individual contexts.
          </li>
          <li>
            <strong>Uncertainty:</strong> Emission factors can vary by source year, region,
            and data methodology.
          </li>
          <li>
            <strong>Simplified assumptions:</strong> The model uses simplified inputs and
            direct factors, so real-world lifecycle effects may differ.
          </li>
        </ul>
      </section>
    </main>
  );
}
