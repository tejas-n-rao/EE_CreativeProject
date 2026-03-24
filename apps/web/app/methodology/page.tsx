import Link from "next/link";
import { readFile } from "node:fs/promises";
import path from "node:path";

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

type EffectiveEmissionFactor = {
  activity_name: string;
  category: string;
  region: string;
  unit_activity: string;
  effective_factor_kgco2e_per_unit: number | string;
  effective_source_name: string;
  effective_source_url: string;
  effective_source_year?: number | null;
  uses_custom_override: boolean;
  default_factor_kgco2e_per_unit: number | string;
  default_source_name: string;
  default_source_url: string;
  default_source_year?: number | null;
  custom_factor_kgco2e_per_unit?: number | string | null;
  custom_source_name?: string | null;
  custom_source_url?: string | null;
  custom_source_year?: number | null;
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
async function loadCustomEstimationMarkdown(): Promise<string | null> {
  const candidates = ["Custom_Estimation.md", "Custome_Estimation.md"];
  const roots = [
    process.cwd(),
    path.resolve(process.cwd(), ".."),
    path.resolve(process.cwd(), "..", ".."),
  ];

  for (const root of roots) {
    for (const fileName of candidates) {
      const fullPath = path.join(root, "data", fileName);
      try {
        return await readFile(fullPath, "utf-8");
      } catch {
        // Try next candidate filename/location.
      }
    }
  }
  return null;
}

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
  factors: EffectiveEmissionFactor[],
): EmissionFactorSource[] {
  const seen = new Set<string>();
  const sources: EmissionFactorSource[] = [];

  const addSource = (name?: string, url?: string) => {
    const sourceName = (name || "").trim();
    const sourceUrl = (url || "").trim();
    if (!sourceUrl) {
      return;
    }
    const displayName = !sourceName || sourceName.toLowerCase() === "custom" ? sourceUrl : sourceName;

    const key = `${displayName}::${sourceUrl}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    sources.push({ name: displayName, url: sourceUrl });
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

  for (const factor of factors) {
    addSource(factor.effective_source_name, factor.effective_source_url);
  }

  return sources;
}

function formatFactor2dp(value: number | string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return String(value);
  }
  return parsed.toFixed(2);
}

function formatSourceLabel(name: string, fallback = "-"): string {
  const cleaned = (name || "").trim();
  if (!cleaned || cleaned.toLowerCase() === "custom") {
    return fallback;
  }
  return cleaned;
}

async function getMethodologyData(): Promise<{
  equation: string;
  methodology: MethodologyItem[];
  factors: EffectiveEmissionFactor[];
  sources: EmissionFactorSource[];
  errorMessage: string | null;
}> {
  let payload: MethodologyApiPayload = [];
  let methodology: MethodologyItem[] = [];
  let factors: EffectiveEmissionFactor[] = [];
  const errors: string[] = [];

  try {
    const response = await fetch(`${apiBase}/v1/methodology`, { cache: "no-store" });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const detail = typeof body?.detail === "string" ? body.detail : null;
      errors.push(detail || `Methodology API returned ${response.status}.`);
    } else {
      payload = (await response.json()) as MethodologyApiPayload;
      methodology = asMethodologyItems(payload);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown fetch error";
    errors.push(`Could not load methodology data. ${reason}`);
  }

  try {
    const factorResponse = await fetch(`${apiBase}/v1/emission-factors/current`, {
      cache: "no-store",
    });
    if (!factorResponse.ok) {
      const body = await factorResponse.json().catch(() => null);
      const detail = typeof body?.detail === "string" ? body.detail : null;
      errors.push(detail || `Emission factor API returned ${factorResponse.status}.`);
    } else {
      factors = (await factorResponse.json()) as EffectiveEmissionFactor[];
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown fetch error";
    errors.push(`Could not load emission factors. ${reason}`);
  }

  const sources = extractSourceList(payload, methodology, factors);
  const equation = methodology[0]?.equation_string || FALLBACK_EQUATION;
  const errorMessage = errors.length > 0 ? errors.join(" ") : null;
  return { equation, methodology, factors, sources, errorMessage };
}

export default async function MethodologyPage() {
  const { equation, methodology, factors, sources, errorMessage } = await getMethodologyData();
  const customEstimationMarkdown = await loadCustomEstimationMarkdown();

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
        <h2>2) Activity Reference Factors (kgCO2e per unit)</h2>
        <p>
          These factors are read live from <code>data/emission_factors.xlsx</code>. Edit the
          custom factor/source columns in that sheet to override the defaults used by calculations.
        </p>
        {factors.length > 0 ? (
          <div className="methodology-table-wrap">
            <table className="methodology-table">
              <thead>
                <tr>
                  <th>Activity</th>
                  <th>Unit</th>
                  <th>Factor (kgCO2e/unit)</th>
                  <th>Region</th>
                  <th>Source</th>
                  <th>Source Link</th>
                </tr>
              </thead>
              <tbody>
                {factors.map((row) => (
                  <tr key={`${row.category}-${row.region}-${row.unit_activity}`}>
                    <td>{row.activity_name}</td>
                    <td>
                      <code>{row.unit_activity}</code>
                    </td>
                    <td>{formatFactor2dp(row.effective_factor_kgco2e_per_unit)}</td>
                    <td>{row.region}</td>
                    <td>{formatSourceLabel(row.effective_source_name)}</td>
                    <td>
                      {row.effective_source_url ? (
                        <a href={row.effective_source_url} target="_blank" rel="noreferrer">
                          {row.effective_source_url}
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No emission factor rows were returned by the API.</p>
        )}
      </section>

      <section className="methodology-section">
        <h2>3) Data Sources</h2>
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
            No emission factor source records were included in the current API responses (
            <code>/v1/methodology</code> and <code>/v1/emission-factors/current</code>).
          </p>
        )}
      </section>

      <section className="methodology-section">
        <h2>4) Benchmarks</h2>
        <p>
          The app annualizes monthly emissions and compares them to per-capita annual
          benchmarks for India and the world. Carbon indexes are computed as ratio-based
          scores where 100 represents benchmark parity.
        </p>
      </section>

      <section className="methodology-section">
        <h2>5) Emission Factor Estimation Notes</h2>
        <p>
          The following content is loaded directly from <code>data/Custom_Estimation.md</code>{" "}
          and used as the methodology reference for deriving and justifying emission-factor
          estimates.
        </p>
        {customEstimationMarkdown ? (
          <pre className="methodology-markdown">{customEstimationMarkdown}</pre>
        ) : (
          <p>
            Could not load <code>data/Custom_Estimation.md</code>.
          </p>
        )}
      </section>

      <section className="methodology-section">
        <h2>6) Limitations</h2>
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
          <li>
            <strong>Custom EF estimation:</strong> Diet and LPG factors include modeled assumptions
            from project-specific estimation methods.
          </li>
        </ul>
      </section>
    </main>
  );
}
