"use client";

import { useEffect, useMemo, useState } from "react";

export type DashboardPayload = {
  survey: {
    id: string;
    country: string;
    answers_json: Record<string, unknown>;
    created_at: string;
  };
  calculation: {
    id: string;
    total_kgco2e: number | string;
    breakdown_json?: {
      total_kgco2e?: number | string;
      lines?: BreakdownLine[];
    };
    created_at: string;
  } | null;
  carbon_index: {
    india_index: number | string;
    world_index: number | string;
    interpretation: string;
  } | null;
  benchmarks: Array<{
    metric: string;
    region: string;
    year: number;
    value_tonnes_per_person: number | string;
  }>;
  facts: Array<{
    id: string;
    rendered_text: string;
  }>;
};

type BreakdownLine = {
  category: string;
  activity_value: number | string;
  activity_unit: string;
  emission_factor: number | string;
  factor_unit: string;
  result_kgco2e: number | string;
  formula_string: string;
};

type PieSlice = {
  category: string;
  value: number;
  formula: string;
  color: string;
  startAngle: number;
  endAngle: number;
};

type TooltipCardProps = {
  label: string;
  value: string;
  unit: string;
  formula: string;
};

const PIE_COLORS = ["#2c7da0", "#70a37f", "#f2c14e", "#e46c5c", "#7d6ee7", "#008585"];
const CATEGORY_LABELS: Record<string, string> = {
  electricity: "Electricity",
  water_supply_m3: "Water Supply",
  lpg_kg: "Cooking Gas (LPG)",
  petrol_car_km: "Petrol Car",
  diesel_car_km: "Diesel Car",
  two_wheeler_km: "Two-wheeler",
  bus_km: "Bus",
  metro_km: "Metro",
  rail_km: "Rail",
  ride_hailing_km: "Ride-hailing",
  flight_shorthaul: "Short-haul Flight",
  diet_plant_based_day: "Diet (Plant-based)",
  diet_mixed_day: "Diet (Mixed)",
  diet_meat_heavy_day: "Diet (Meat-heavy)",
};
const TRANSPORT_CATEGORIES = new Set([
  "petrol_car_km",
  "diesel_car_km",
  "two_wheeler_km",
  "bus_km",
  "metro_km",
  "rail_km",
  "ride_hailing_km",
  "flight_shorthaul",
]);
const FOOD_CATEGORIES = new Set([
  "diet_plant_based_day",
  "diet_mixed_day",
  "diet_meat_heavy_day",
  "lpg_kg",
]);
const WATER_CATEGORIES = new Set(["water_supply_m3"]);
const CLASS_LABELS = {
  transport: "Transportation",
  food: "Food",
  water: "Water Consumption",
} as const;
const CLASS_BENCHMARK_METRICS = {
  transport: "transport_per_capita_emissions",
  food: "food_per_capita_emissions",
  water: "water_per_capita_emissions",
} as const;
const DEFAULT_PIE_TOOLTIP =
  "Hover slices or legend items to see category, class, percentage, and formula.";
const DEFAULT_COMPARISON_TOOLTIP = "Hover bars to see comparison formulas.";

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value: number, maxFraction = 2): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFraction,
  }).format(value);
}

function formatCategory(category: string): string {
  return CATEGORY_LABELS[category] || category.replace(/_/g, " ");
}

function classifyCategory(category: string): keyof typeof CLASS_LABELS | null {
  if (TRANSPORT_CATEGORIES.has(category)) {
    return "transport";
  }
  if (FOOD_CATEGORIES.has(category)) {
    return "food";
  }
  if (WATER_CATEGORIES.has(category)) {
    return "water";
  }
  return null;
}

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function arcPath(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

function buildPieSlices(lines: BreakdownLine[]): PieSlice[] {
  const values = lines.map((line) => Math.max(toNumber(line.result_kgco2e), 0));
  const total = values.reduce((sum, value) => sum + value, 0);

  if (total <= 0) {
    return [];
  }

  let cursor = -Math.PI / 2;
  return lines.map((line, index) => {
    const value = values[index];
    const angle = (value / total) * Math.PI * 2;
    const slice: PieSlice = {
      category: line.category,
      value,
      formula: line.formula_string,
      color: PIE_COLORS[index % PIE_COLORS.length],
      startAngle: cursor,
      endAngle: cursor + angle,
    };
    cursor += angle;
    return slice;
  });
}

function TooltipCard({ label, value, unit, formula }: TooltipCardProps) {
  return (
    <article className="dashboard-card">
      <header className="dashboard-card-header">
        <h3>{label}</h3>
        <button type="button" className="tooltip-trigger" aria-label={`${label} formula`}>
          i<span className="tooltip-bubble">{formula}</span>
        </button>
      </header>
      <p className="dashboard-card-value">
        {value}
        <span>{unit}</span>
      </p>
    </article>
  );
}

function actionHintForCategory(category: string): string {
  if (category === "petrol_car_km" || category === "diesel_car_km") {
    return "Shift a share of weekly car travel to transit or pooled rides.";
  }
  if (category === "two_wheeler_km" || category === "ride_hailing_km") {
    return "Batch short trips and replace a few with walking/cycling.";
  }
  if (category === "electricity") {
    return "Reduce AC runtime and improve appliance efficiency settings.";
  }
  if (category === "flight_shorthaul") {
    return "Consolidate short flights and prioritize rail for feasible routes.";
  }
  if (category === "lpg_kg") {
    return "Improve cooking fuel efficiency through meal batching.";
  }
  if (category === "water_supply_m3") {
    return "Lower shower and laundry water demand where possible.";
  }
  if (category.startsWith("diet_")) {
    return "Increase lower-emission meals and reduce high-footprint food waste.";
  }
  return "Trim this activity category with a weekly reduction target.";
}

export default function DashboardClient({ data }: { data: DashboardPayload }) {
  const [pieTooltip, setPieTooltip] = useState(DEFAULT_PIE_TOOLTIP);
  const [barTooltip, setBarTooltip] = useState(DEFAULT_COMPARISON_TOOLTIP);
  const [classTooltips, setClassTooltips] = useState<Record<string, string>>({});
  const [scenarioCategory, setScenarioCategory] = useState("");
  const [scenarioReductionPct, setScenarioReductionPct] = useState(30);

  const lines = useMemo<BreakdownLine[]>(
    () => data.calculation?.breakdown_json?.lines ?? [],
    [data.calculation?.breakdown_json?.lines],
  );
  const monthlyFootprint = toNumber(
    data.calculation?.total_kgco2e ?? data.calculation?.breakdown_json?.total_kgco2e,
  );
  const annualFootprint = monthlyFootprint * 12;
  const annualTonnes = annualFootprint / 1000;

  const indiaBenchmark = toNumber(
    data.benchmarks.find(
      (item) => item.metric === "annual_per_capita_emissions" && item.region === "IN",
    )?.value_tonnes_per_person,
  );
  const worldBenchmark = toNumber(
    data.benchmarks.find(
      (item) => item.metric === "annual_per_capita_emissions" && item.region === "WORLD",
    )?.value_tonnes_per_person,
  );

  const derivedIndiaIndex = indiaBenchmark > 0 ? (annualTonnes / indiaBenchmark) * 100 : 0;
  const derivedWorldIndex = worldBenchmark > 0 ? (annualTonnes / worldBenchmark) * 100 : 0;
  const apiIndiaIndex = toNumber(data.carbon_index?.india_index, Number.NaN);
  const apiWorldIndex = toNumber(data.carbon_index?.world_index, Number.NaN);
  const indiaIndex = Number.isFinite(apiIndiaIndex) ? apiIndiaIndex : derivedIndiaIndex;
  const worldIndex = Number.isFinite(apiWorldIndex) ? apiWorldIndex : derivedWorldIndex;

  const pieSlices = useMemo(() => buildPieSlices(lines), [lines]);
  const pieTotal = pieSlices.reduce((sum, slice) => sum + slice.value, 0);

  function getPieTooltip(slice: PieSlice): string {
    const classKey = classifyCategory(slice.category);
    const classLabel = classKey ? CLASS_LABELS[classKey] : "Household / Other";
    const percent = pieTotal > 0 ? (slice.value / pieTotal) * 100 : 0;

    return (
      `${formatCategory(slice.category)} | Class: ${classLabel} | ` +
      `${formatNumber(slice.value, 2)} kgCO2e (${formatNumber(percent, 1)}%) | ` +
      `Formula: ${slice.formula}`
    );
  }

  const comparisonBars = [
    {
      label: "You",
      value: annualTonnes,
      color: "#2c7da0",
      formula:
        `Annual footprint = ${formatNumber(monthlyFootprint, 2)} × 12 / 1000 = ` +
        `${formatNumber(annualTonnes, 3)} tCO2e`,
    },
    {
      label: "India",
      value: indiaBenchmark,
      color: "#70a37f",
      formula: `India benchmark (annual per capita) = ${formatNumber(indiaBenchmark, 3)} tCO2e`,
    },
    {
      label: "World",
      value: worldBenchmark,
      color: "#f2c14e",
      formula: `World benchmark (annual per capita) = ${formatNumber(worldBenchmark, 3)} tCO2e`,
    },
  ];

  const maxComparison = Math.max(...comparisonBars.map((item) => item.value), 1);
  const classMonthlyKg = lines.reduce(
    (acc, line) => {
      const classKey = classifyCategory(line.category);
      if (!classKey) {
        return acc;
      }
      acc[classKey] += toNumber(line.result_kgco2e);
      return acc;
    },
    { transport: 0, food: 0, water: 0 },
  );
  const classComparisons = (Object.keys(CLASS_LABELS) as Array<keyof typeof CLASS_LABELS>).map(
    (classKey) => {
      const metric = CLASS_BENCHMARK_METRICS[classKey];
      const india = toNumber(
        data.benchmarks.find((item) => item.metric === metric && item.region === "IN")
          ?.value_tonnes_per_person,
      );
      const world = toNumber(
        data.benchmarks.find((item) => item.metric === metric && item.region === "WORLD")
          ?.value_tonnes_per_person,
      );
      const userTonnes = (classMonthlyKg[classKey] * 12) / 1000;

      return {
        classKey,
        label: CLASS_LABELS[classKey],
        user: userTonnes,
        india,
        world,
      };
    },
  );
  const scenarioOptions = useMemo(
    () =>
      lines
        .map((line) => ({
          category: line.category,
          label: formatCategory(line.category),
          value: Math.max(toNumber(line.result_kgco2e), 0),
        }))
        .filter((line) => line.value > 0),
    [lines],
  );
  const defaultScenarioCategory =
    scenarioOptions.find((option) => option.category === "petrol_car_km")?.category ||
    scenarioOptions[0]?.category ||
    "";

  useEffect(() => {
    if (!scenarioOptions.some((option) => option.category === scenarioCategory)) {
      setScenarioCategory(defaultScenarioCategory);
    }
  }, [defaultScenarioCategory, scenarioCategory, scenarioOptions]);

  const activeScenario =
    scenarioOptions.find((option) => option.category === scenarioCategory) || null;
  const scenarioReductionKg = activeScenario
    ? (activeScenario.value * scenarioReductionPct) / 100
    : 0;
  const scenarioMonthly = Math.max(monthlyFootprint - scenarioReductionKg, 0);
  const scenarioAnnual = scenarioMonthly * 12;
  const scenarioAnnualTonnes = scenarioAnnual / 1000;
  const scenarioDeltaPct = monthlyFootprint > 0 ? (scenarioReductionKg / monthlyFootprint) * 100 : 0;
  const reportActionItems = [...lines]
    .sort((left, right) => toNumber(right.result_kgco2e) - toNumber(left.result_kgco2e))
    .slice(0, 3)
    .map((line) => ({
      category: line.category,
      label: formatCategory(line.category),
      kg: Math.max(toNumber(line.result_kgco2e), 0),
      action: actionHintForCategory(line.category),
    }));

  function handleExportPdf() {
    if (typeof window === "undefined") {
      return;
    }

    setPieTooltip(DEFAULT_PIE_TOOLTIP);
    setBarTooltip(DEFAULT_COMPARISON_TOOLTIP);
    setClassTooltips({});

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.print();
      });
    });
  }

  return (
    <>
      <section className="dashboard-grid">
        <TooltipCard
          label="Monthly Footprint"
          value={formatNumber(monthlyFootprint)}
          unit="kgCO2e/mo"
          formula={
            `Monthly footprint = Σ category emissions = ` +
            `${formatNumber(monthlyFootprint)} kgCO2e`
          }
        />

        <TooltipCard
          label="Annual Footprint"
          value={formatNumber(annualFootprint)}
          unit="kgCO2e/yr"
          formula={
            `Annual footprint = Monthly footprint × 12 = ` +
            `${formatNumber(monthlyFootprint)} × 12`
          }
        />

        <TooltipCard
          label="India Carbon Index"
          value={formatNumber(indiaIndex)}
          unit="index"
          formula={`India index = (User annual tonnes / India per-capita tonnes) × 100`}
        />

        <TooltipCard
          label="Global Carbon Index"
          value={formatNumber(worldIndex)}
          unit="index"
          formula={`World index = (User annual tonnes / World per-capita tonnes) × 100`}
        />
      </section>

      <section className="dashboard-charts">
        <article className="chart-card">
          <h2>Emissions Breakdown</h2>
          {pieSlices.length > 0 ? (
            <>
              <div className="pie-layout">
                <svg
                  viewBox="0 0 220 220"
                  className="pie-chart"
                  role="img"
                  aria-label="Emissions breakdown pie chart"
                >
                  {pieSlices.map((slice) => (
                    <path
                      key={`${slice.category}-${slice.startAngle}`}
                      d={arcPath(110, 110, 90, slice.startAngle, slice.endAngle)}
                      fill={slice.color}
                      onMouseEnter={() => setPieTooltip(getPieTooltip(slice))}
                      onFocus={() => setPieTooltip(getPieTooltip(slice))}
                      onMouseLeave={() => setPieTooltip(DEFAULT_PIE_TOOLTIP)}
                      onBlur={() => setPieTooltip(DEFAULT_PIE_TOOLTIP)}
                      tabIndex={0}
                    />
                  ))}
                </svg>

                <ul className="pie-legend">
                  {pieSlices.map((slice) => (
                    <li key={`${slice.category}-${slice.color}`}>
                      <button
                        type="button"
                        className="legend-button"
                        onMouseEnter={() => setPieTooltip(getPieTooltip(slice))}
                        onFocus={() => setPieTooltip(getPieTooltip(slice))}
                        onMouseLeave={() => setPieTooltip(DEFAULT_PIE_TOOLTIP)}
                        onBlur={() => setPieTooltip(DEFAULT_PIE_TOOLTIP)}
                      >
                        <span style={{ backgroundColor: slice.color }} />
                        <strong>{formatCategory(slice.category)}</strong>
                        <em>{formatNumber(slice.value)} kgCO2e</em>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="chart-tooltip">{pieTooltip}</p>
            </>
          ) : (
            <p>No calculation breakdown available yet for this survey.</p>
          )}
        </article>

        <article className="chart-card">
          <h2>Comparison (You vs India vs World)</h2>
                <div className="bar-chart global-bar-chart">
            {comparisonBars.map((bar) => {
              const height = Math.max((bar.value / maxComparison) * 100, 3);

              return (
                <div key={bar.label} className="bar-item">
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ height: `${height}%`, background: bar.color }}
                      onMouseEnter={() => setBarTooltip(bar.formula)}
                      onFocus={() => setBarTooltip(bar.formula)}
                      onMouseLeave={() => setBarTooltip(DEFAULT_COMPARISON_TOOLTIP)}
                      onBlur={() => setBarTooltip(DEFAULT_COMPARISON_TOOLTIP)}
                      tabIndex={0}
                      aria-label={`${bar.label} comparison bar`}
                    />
                  </div>
                  <strong>{bar.label}</strong>
                  <span>{formatNumber(bar.value, 3)} tCO2e</span>
                </div>
              );
            })}
          </div>
          <p className="chart-tooltip">{barTooltip}</p>
        </article>
      </section>

      <section className="class-shell-section">
        <h2>Class Benchmarks (Annual Tonnes)</h2>
        <div className="class-shell-grid">
          {classComparisons.map((classItem) => {
            const defaultTooltip = `Hover ${classItem.label.toLowerCase()} bars to inspect class-level benchmark formulas.`;
            const bars = [
              {
                label: "You",
                value: classItem.user,
                color: "#2c7da0",
                formula:
                  `${classItem.label}: user annual tonnes = ` +
                  `${formatNumber(classMonthlyKg[classItem.classKey], 2)} kg/mo × 12 / 1000`,
              },
              {
                label: "India",
                value: classItem.india,
                color: "#70a37f",
                formula:
                  `${classItem.label}: India benchmark = ` +
                  `${formatNumber(classItem.india, 4)} tCO2e/person/year`,
              },
              {
                label: "World",
                value: classItem.world,
                color: "#f2c14e",
                formula:
                  `${classItem.label}: World benchmark = ` +
                  `${formatNumber(classItem.world, 4)} tCO2e/person/year`,
              },
            ];
            const rowMax = Math.max(...bars.map((bar) => bar.value), 0.001);

            return (
              <article key={classItem.classKey} className="chart-card class-shell-card">
                <h3>{classItem.label}</h3>
                <div className="bar-chart class-bar-chart">
                  {bars.map((bar) => {
                    const height = Math.max((bar.value / rowMax) * 100, 3);
                    return (
                      <div key={`${classItem.classKey}-${bar.label}`} className="bar-item">
                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{ height: `${height}%`, background: bar.color }}
                            onMouseEnter={() =>
                              setClassTooltips((current) => ({
                                ...current,
                                [classItem.classKey]: bar.formula,
                              }))
                            }
                            onFocus={() =>
                              setClassTooltips((current) => ({
                                ...current,
                                [classItem.classKey]: bar.formula,
                              }))
                            }
                            onMouseLeave={() =>
                              setClassTooltips((current) => ({
                                ...current,
                                [classItem.classKey]: defaultTooltip,
                              }))
                            }
                            onBlur={() =>
                              setClassTooltips((current) => ({
                                ...current,
                                [classItem.classKey]: defaultTooltip,
                              }))
                            }
                            tabIndex={0}
                            aria-label={`${classItem.label} ${bar.label} benchmark bar`}
                          />
                        </div>
                        <strong>{bar.label}</strong>
                        <span>{formatNumber(bar.value, 4)} tCO2e</span>
                      </div>
                    );
                  })}
                </div>
                <p className="chart-tooltip class-tooltip">
                  {classTooltips[classItem.classKey] ?? defaultTooltip}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="scenario-shell">
        <h2>Scenario Simulator</h2>
        <p className="survey-help">
          Live preview for &quot;what-if&quot; changes. Example: reduce car km by 30%.
        </p>
        {scenarioOptions.length > 0 && activeScenario ? (
          <div className="scenario-grid">
            <article className="scenario-card">
              <h3>Scenario Inputs</h3>
              <label className="field-label" htmlFor="scenario-category-select">
                Category
              </label>
              <select
                id="scenario-category-select"
                className="text-input"
                value={scenarioCategory}
                onChange={(event) => setScenarioCategory(event.target.value)}
              >
                {scenarioOptions.map((option) => (
                  <option key={option.category} value={option.category}>
                    {option.label}
                  </option>
                ))}
              </select>

              <label className="field-label" htmlFor="scenario-reduction-range">
                Reduction ({scenarioReductionPct}%)
              </label>
              <input
                id="scenario-reduction-range"
                className="scenario-range"
                type="range"
                min={0}
                max={80}
                step={1}
                value={scenarioReductionPct}
                onChange={(event) => setScenarioReductionPct(Number(event.target.value))}
              />
            </article>

            <article className="scenario-card">
              <h3>Live Preview</h3>
              <p>
                <strong>Selected line:</strong> {activeScenario.label}
              </p>
              <p>
                <strong>Baseline monthly:</strong> {formatNumber(monthlyFootprint)} kgCO2e
              </p>
              <p>
                <strong>Projected monthly:</strong> {formatNumber(scenarioMonthly)} kgCO2e
              </p>
              <p>
                <strong>Projected annual:</strong> {formatNumber(scenarioAnnualTonnes, 3)} tCO2e
              </p>
              <p className="scenario-impact">
                Impact: -{formatNumber(scenarioReductionKg, 2)} kgCO2e/month (
                {formatNumber(scenarioDeltaPct, 1)}% of current total)
              </p>
            </article>
          </div>
        ) : (
          <p>No category lines available for scenario simulation yet.</p>
        )}
      </section>

      <section className="report-shell">
        <div className="report-shell-header">
          <div>
            <h2>Shareable Report</h2>
            <p className="survey-help">
              Export a PDF snapshot including charts, definitions, and action priorities.
            </p>
          </div>
          <button type="button" className="secondary-button report-export-button" onClick={handleExportPdf}>
            Export PDF Report
          </button>
        </div>

        <div className="report-summary-grid">
          <article className="report-stat-card">
            <h3>Monthly</h3>
            <p>{formatNumber(monthlyFootprint)} kgCO2e</p>
          </article>
          <article className="report-stat-card">
            <h3>Annual</h3>
            <p>{formatNumber(annualTonnes, 3)} tCO2e</p>
          </article>
          <article className="report-stat-card">
            <h3>India Index</h3>
            <p>{formatNumber(indiaIndex, 1)}</p>
          </article>
          <article className="report-stat-card">
            <h3>World Index</h3>
            <p>{formatNumber(worldIndex, 1)}</p>
          </article>
        </div>

        <div className="report-columns">
          <article className="report-card">
            <h3>Priority Actions</h3>
            {reportActionItems.length > 0 ? (
              <ol>
                {reportActionItems.map((item) => (
                  <li key={item.category}>
                    <strong>{item.label}</strong> ({formatNumber(item.kg, 2)} kgCO2e/mo): {item.action}
                  </li>
                ))}
              </ol>
            ) : (
              <p>No calculated category lines available yet.</p>
            )}
          </article>

          <article className="report-card">
            <h3>Definitions</h3>
            <ul>
              <li>
                <strong>kgCO2e:</strong> kilograms of CO2-equivalent emissions.
              </li>
              <li>
                <strong>tCO2e:</strong> tonnes of CO2-equivalent; 1 tCO2e = 1000 kgCO2e.
              </li>
              <li>
                <strong>Carbon Index:</strong> your annual emissions versus benchmark annual per-capita emissions.
              </li>
              <li>
                <strong>Emission Factor:</strong> conversion multiplier from activity units to emissions.
              </li>
            </ul>
          </article>
        </div>
      </section>

      {data.facts.length > 0 && (
        <section className="dashboard-facts">
          <h2>Insights</h2>
          <ul>
            {data.facts.map((fact) => (
              <li key={fact.id}>{fact.rendered_text}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
