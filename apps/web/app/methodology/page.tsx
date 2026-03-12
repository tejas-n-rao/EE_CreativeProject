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
const BENCHMARK_CITATIONS = [
  {
    label: "OWID per-capita GHG emissions (including land-use change)",
    url: "https://ourworldindata.org/grapher/per-capita-ghg-emissions.csv",
  },
  {
    label: "OWID transport CO2 emissions per capita",
    url: "https://ourworldindata.org/grapher/per-capita-co2-transport.csv",
  },
  {
    label: "OWID emissions from food",
    url: "https://ourworldindata.org/grapher/emissions-from-food.csv",
  },
  {
    label: "World Bank population (SP.POP.TOTL)",
    url: "https://api.worldbank.org/v2/country/IND;WLD/indicator/SP.POP.TOTL?format=json&per_page=400",
  },
  {
    label: "World Bank total freshwater withdrawals (ER.H2O.FWTL.K3)",
    url: "https://api.worldbank.org/v2/country/IND;WLD/indicator/ER.H2O.FWTL.K3?format=json&per_page=400",
  },
  {
    label: "World Bank domestic freshwater withdrawal share (ER.H2O.FWDM.ZS)",
    url: "https://api.worldbank.org/v2/country/IND;WLD/indicator/ER.H2O.FWDM.ZS?format=json&per_page=400",
  },
];

type ActivityFactorRow = {
  category: string;
  activity: string;
  unit: string;
  factor: string;
  region: string;
  source_name: string;
  source_url: string;
};

const ACTIVITY_FACTOR_ROWS: ActivityFactorRow[] = [
  {
    category: "electricity",
    activity: "Electricity",
    unit: "kWh",
    factor: "0.700",
    region: "IN",
    source_name: "Placeholder electricity factor (i2SEA-inspired)",
    source_url: "https://depts.washington.edu/i2sea/iscfc/fpcalc.php?version=full",
  },
  {
    category: "water_supply_m3",
    activity: "Water Supply",
    unit: "m3",
    factor: "0.344",
    region: "WORLD",
    source_name: "Placeholder water treatment factor",
    source_url: "https://depts.washington.edu/i2sea/iscfc/fpcalc.php?version=full",
  },
  {
    category: "petrol_car_km",
    activity: "Petrol Car",
    unit: "km",
    factor: "0.192",
    region: "WORLD",
    source_name: "Placeholder passenger vehicle factor",
    source_url: "https://depts.washington.edu/i2sea/iscfc/fpcalc.php?version=full",
  },
  {
    category: "diesel_car_km",
    activity: "Diesel Car",
    unit: "km",
    factor: "0.171",
    region: "WORLD",
    source_name: "Placeholder diesel vehicle factor",
    source_url: "https://depts.washington.edu/i2sea/iscfc/fpcalc.php?version=full",
  },
  {
    category: "bus_km",
    activity: "Bus",
    unit: "km",
    factor: "0.089",
    region: "WORLD",
    source_name: "Placeholder bus transit factor",
    source_url: "https://depts.washington.edu/i2sea/iscfc/fpcalc.php?version=full",
  },
  {
    category: "metro_km",
    activity: "Metro",
    unit: "km",
    factor: "0.041",
    region: "WORLD",
    source_name: "Placeholder metro transit factor",
    source_url: "https://depts.washington.edu/i2sea/iscfc/fpcalc.php?version=full",
  },
  {
    category: "rail_km",
    activity: "Rail",
    unit: "km",
    factor: "0.035",
    region: "WORLD",
    source_name: "Placeholder rail transit factor",
    source_url: "https://depts.washington.edu/i2sea/iscfc/fpcalc.php?version=full",
  },
  {
    category: "two_wheeler_km",
    activity: "Two-wheeler",
    unit: "km",
    factor: "0.072",
    region: "WORLD",
    source_name: "Placeholder two-wheeler factor",
    source_url: "https://depts.washington.edu/i2sea/iscfc/fpcalc.php?version=full",
  },
  {
    category: "ride_hailing_km",
    activity: "Ride-hailing",
    unit: "km",
    factor: "0.180",
    region: "WORLD",
    source_name: "Placeholder ride-hailing factor",
    source_url: "https://depts.washington.edu/i2sea/iscfc/fpcalc.php?version=full",
  },
  {
    category: "flight_shorthaul",
    activity: "Short-haul flight",
    unit: "passenger_km",
    factor: "0.158",
    region: "WORLD",
    source_name: "Placeholder short-haul flight factor",
    source_url: "https://depts.washington.edu/i2sea/iscfc/fpcalc.php?version=full",
  },
  {
    category: "lpg_kg",
    activity: "Cooking Gas (LPG)",
    unit: "kg",
    factor: "2.983",
    region: "WORLD",
    source_name: "Placeholder LPG factor",
    source_url: "https://depts.washington.edu/i2sea/iscfc/fpcalc.php?version=full",
  },
  {
    category: "diet_plant_based_day",
    activity: "Diet (Plant-based)",
    unit: "person_day",
    factor: "1.800",
    region: "WORLD",
    source_name: "Placeholder low-carbon diet factor",
    source_url: "https://depts.washington.edu/i2sea/iscfc/fpcalc.php?version=full",
  },
  {
    category: "diet_mixed_day",
    activity: "Diet (Mixed)",
    unit: "person_day",
    factor: "2.800",
    region: "WORLD",
    source_name: "Placeholder mixed diet factor",
    source_url: "https://depts.washington.edu/i2sea/iscfc/fpcalc.php?version=full",
  },
  {
    category: "diet_meat_heavy_day",
    activity: "Diet (Meat-heavy)",
    unit: "person_day",
    factor: "4.200",
    region: "WORLD",
    source_name: "Placeholder high-meat diet factor",
    source_url: "https://depts.washington.edu/i2sea/iscfc/fpcalc.php?version=full",
  },
];

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
        <h2>2) Activity Reference Factors (kgCO2e per unit)</h2>
        <p>
          Current seed factors used by the calculator. These values are placeholders for
          development and should be replaced with validated regional datasets before production use.
        </p>
        <div className="methodology-table-wrap">
          <table className="methodology-table">
            <thead>
              <tr>
                <th>Activity</th>
                <th>Category Key</th>
                <th>Unit</th>
                <th>Factor (kgCO2e/unit)</th>
                <th>Region</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {ACTIVITY_FACTOR_ROWS.map((row) => (
                <tr key={`${row.category}-${row.region}-${row.unit}`}>
                  <td>{row.activity}</td>
                  <td>
                    <code>{row.category}</code>
                  </td>
                  <td>
                    <code>{row.unit}</code>
                  </td>
                  <td>{row.factor}</td>
                  <td>{row.region}</td>
                  <td>
                    <a href={row.source_url} target="_blank" rel="noreferrer">
                      {row.source_name}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
            No emission factor source records were included in the current{" "}
            <code>/v1/methodology</code> response.
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
        <h2>5) Benchmark Citations (from README)</h2>
        <p>Verified reference links used for benchmark derivations and comparisons.</p>
        <ul>
          {BENCHMARK_CITATIONS.map((citation) => (
            <li key={citation.url}>
              <a href={citation.url} target="_blank" rel="noreferrer">
                {citation.label}
              </a>
            </li>
          ))}
        </ul>
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
        </ul>
      </section>
    </main>
  );
}
