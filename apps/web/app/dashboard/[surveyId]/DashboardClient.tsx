"use client";

import { useMemo, useState } from "react";

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

export default function DashboardClient({ data }: { data: DashboardPayload }) {
  const [pieTooltip, setPieTooltip] = useState("Hover slices or legend items for formulas.");
  const [barTooltip, setBarTooltip] = useState("Hover bars to see comparison formulas.");
  const [classTooltip, setClassTooltip] = useState(
    "Hover bars to inspect class-level benchmark formulas.",
  );

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
                      onMouseEnter={() => setPieTooltip(slice.formula)}
                      onFocus={() => setPieTooltip(slice.formula)}
                      onMouseLeave={() =>
                        setPieTooltip("Hover slices or legend items for formulas.")
                      }
                      onBlur={() => setPieTooltip("Hover slices or legend items for formulas.")}
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
                        onMouseEnter={() => setPieTooltip(slice.formula)}
                        onFocus={() => setPieTooltip(slice.formula)}
                        onMouseLeave={() =>
                          setPieTooltip("Hover slices or legend items for formulas.")
                        }
                        onBlur={() => setPieTooltip("Hover slices or legend items for formulas.")}
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
          <div className="bar-chart">
            {comparisonBars.map((bar) => {
              const height = Math.max((bar.value / maxComparison) * 100, 3);

              return (
                <div key={bar.label} className="bar-item">
                  <div className="bar-track">
                    <button
                      type="button"
                      className="bar-fill"
                      style={{ height: `${height}%`, background: bar.color }}
                      onMouseEnter={() => setBarTooltip(bar.formula)}
                      onFocus={() => setBarTooltip(bar.formula)}
                      onMouseLeave={() => setBarTooltip("Hover bars to see comparison formulas.")}
                      onBlur={() => setBarTooltip("Hover bars to see comparison formulas.")}
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

        <article className="chart-card">
          <h2>Class Benchmarks (Annual Tonnes)</h2>
          <div className="class-comparison-grid">
            {classComparisons.map((classItem) => {
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
                <section key={classItem.classKey} className="class-comparison-item">
                  <h3>{classItem.label}</h3>
                  <div className="bar-chart class-bar-chart">
                    {bars.map((bar) => {
                      const height = Math.max((bar.value / rowMax) * 100, 3);
                      return (
                        <div key={`${classItem.classKey}-${bar.label}`} className="bar-item">
                          <div className="bar-track">
                            <button
                              type="button"
                              className="bar-fill"
                              style={{ height: `${height}%`, background: bar.color }}
                              onMouseEnter={() => setClassTooltip(bar.formula)}
                              onFocus={() => setClassTooltip(bar.formula)}
                              onMouseLeave={() =>
                                setClassTooltip(
                                  "Hover bars to inspect class-level benchmark formulas.",
                                )
                              }
                              onBlur={() =>
                                setClassTooltip(
                                  "Hover bars to inspect class-level benchmark formulas.",
                                )
                              }
                              aria-label={`${classItem.label} ${bar.label} benchmark bar`}
                            />
                          </div>
                          <strong>{bar.label}</strong>
                          <span>{formatNumber(bar.value, 4)} tCO2e</span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
          <p className="chart-tooltip">{classTooltip}</p>
        </article>
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
