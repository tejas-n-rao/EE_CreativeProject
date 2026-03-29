import "server-only";

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

type JsonObject = Record<string, unknown>;

type ActivityInput = {
  category: string;
  unit: string;
  value: number;
};

type SurveyPayload = {
  id: string;
  country: string;
  answers_json: JsonObject;
  created_at: string;
};

type MethodologyRow = {
  version_name: string;
  equation_string: string;
  description?: string;
};

type EmissionFactorRow = {
  category: string;
  region: string;
  unit_activity: string;
  factor_kgco2e_per_unit: number;
  valid_from: string;
  valid_to: string | null;
  source_name: string;
  source_url: string;
  source_year: number;
};

type BenchmarkRow = {
  metric: string;
  region: string;
  year: number;
  value_tonnes_per_person: number;
  source_name: string;
  source_url: string;
};

type FactTemplate = {
  id: string;
  template: string;
  tags: string[];
  citations: Array<{ title: string; url: string; accessed_on: string }>;
};

type DataBundle = {
  methodology: MethodologyRow[];
  emissionFactors: EmissionFactorRow[];
  benchmarks: BenchmarkRow[];
  factTemplates: FactTemplate[];
};

const FALLBACK_EQUATION = "Emissions = Activity Data × Emission Factor";
const SURVEY_PREFIX = "svy_";

let cachedDataPromise: Promise<DataBundle> | null = null;

function getRootDataDir(): string {
  const roots = [
    process.cwd(),
    path.resolve(process.cwd(), ".."),
    path.resolve(process.cwd(), "..", ".."),
  ];

  for (const root of roots) {
    const candidate = path.join(root, "data");
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return path.join(process.cwd(), "data");
}

async function readJsonFile<T>(filename: string): Promise<T> {
  const dataDir = getRootDataDir();
  const fullPath = path.join(dataDir, filename);
  const raw = await readFile(fullPath, "utf-8");
  return JSON.parse(raw) as T;
}

async function loadData(): Promise<DataBundle> {
  if (!cachedDataPromise) {
    cachedDataPromise = (async () => {
      const [methodology, emissionFactors, benchmarks, factTemplates] = await Promise.all([
        readJsonFile<MethodologyRow[]>("db_methodology_versions.json"),
        readJsonFile<EmissionFactorRow[]>("db_emission_factors.json"),
        readJsonFile<BenchmarkRow[]>("db_benchmark_stats.json"),
        readJsonFile<FactTemplate[]>("fact_templates.json"),
      ]);

      return {
        methodology,
        emissionFactors,
        benchmarks,
        factTemplates,
      };
    })();
  }

  return cachedDataPromise;
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): string {
  const padLength = (4 - (value.length % 4)) % 4;
  const padded = value + "=".repeat(padLength);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

function encodeSurveyId(survey: Omit<SurveyPayload, "id">): string {
  const token = toBase64Url(JSON.stringify(survey));
  return `${SURVEY_PREFIX}${token}`;
}

function decodeSurveyId(surveyId: string): SurveyPayload {
  if (!surveyId.startsWith(SURVEY_PREFIX)) {
    throw new Error("Invalid survey id.");
  }

  const token = surveyId.slice(SURVEY_PREFIX.length);
  const decoded = fromBase64Url(token);
  const parsed = JSON.parse(decoded) as Omit<SurveyPayload, "id">;

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid survey payload.");
  }

  return {
    id: surveyId,
    country: String(parsed.country || "IN"),
    answers_json: (parsed.answers_json || {}) as JsonObject,
    created_at: String(parsed.created_at || new Date().toISOString()),
  };
}

function asPositiveNumber(value: unknown, fieldLabel: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`'${fieldLabel}' must be greater than 0.`);
  }
  return parsed;
}

function extractActivities(answersJson: JsonObject): ActivityInput[] {
  const activitiesPayload = answersJson.activities;
  if (!Array.isArray(activitiesPayload) || activitiesPayload.length === 0) {
    throw new Error("No activity data found in answers_json.activities.");
  }

  return activitiesPayload.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`activities[${index}] must be an object.`);
    }

    const row = item as JsonObject;
    const category = String(row.category || "").trim();
    const unit = String(row.unit || "").trim();

    if (!category) {
      throw new Error(`activities[${index}].category is required.`);
    }
    if (!unit) {
      throw new Error(`activities[${index}].unit is required.`);
    }

    return {
      category,
      unit,
      value: asPositiveNumber(row.value, `activities[${index}].value`),
    };
  });
}

function parseIsoDate(value: string): number {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function isActiveOnDate(row: EmissionFactorRow, asOfIsoDate: string): boolean {
  const asOf = parseIsoDate(asOfIsoDate);
  const starts = parseIsoDate(row.valid_from);
  const ends = row.valid_to ? parseIsoDate(row.valid_to) : Number.POSITIVE_INFINITY;
  return starts <= asOf && asOf <= ends;
}

function findBestFactor(
  factors: EmissionFactorRow[],
  options: {
    category: string;
    unit: string;
    region: string;
    asOfIsoDate: string;
  },
): EmissionFactorRow | null {
  const { category, unit, region, asOfIsoDate } = options;
  const regionsToTry = [region, "WORLD"].filter(Boolean);

  for (const candidateRegion of regionsToTry) {
    const matches = factors
      .filter((row) => row.category === category)
      .filter((row) => row.unit_activity === unit)
      .filter((row) => row.region === candidateRegion)
      .filter((row) => isActiveOnDate(row, asOfIsoDate))
      .sort((a, b) => parseIsoDate(b.valid_from) - parseIsoDate(a.valid_from));

    if (matches.length > 0) {
      return matches[0];
    }
  }

  return null;
}

function formatDecimal(value: number): string {
  const text = Number(value.toFixed(4)).toString();
  return text.includes(".") ? text.replace(/0+$/g, "").replace(/\.$/g, "") : text;
}

function activityNameFromCategory(category: string): string {
  const map: Record<string, string> = {
    electricity: "Electricity",
    water_supply_m3: "Water Supply",
    lpg_kg: "Cooking Gas (LPG)",
    petrol_car_km: "Petrol Car",
    diesel_car_km: "Diesel Car",
    two_wheeler_km: "Two-wheeler",
    bus_km: "Bus",
    metro_km: "Metro",
    rail_km: "Rail",
    flight_shorthaul: "Short-haul Flight",
    diet_plant_based_day: "Diet: Plant-based Days",
    diet_mixed_day: "Diet: Mixed Days",
    diet_meat_heavy_day: "Diet: Meat-heavy Days",
  };

  return map[category] || category;
}

function pickBenchmark(
  rows: BenchmarkRow[],
  metric: string,
  region: string,
): BenchmarkRow | null {
  const candidates = rows
    .filter((row) => row.metric === metric)
    .filter((row) => row.region === region)
    .sort((a, b) => b.year - a.year);

  return candidates[0] || null;
}

function renderFacts(
  templates: FactTemplate[],
  totalKgCo2e: number,
  worldIndex: number,
): Array<{
  id: string;
  template: string;
  rendered_text: string;
  tags: string[];
  citations: Array<{ title: string; url: string; accessed_on: string }>;
}> {
  const percentDelta = worldIndex - 100;

  return templates.map((item) => {
    const rendered = item.template
      .replace("{{value}}", formatDecimal(totalKgCo2e))
      .replace("{{percent}}", formatDecimal(percentDelta));

    return {
      id: item.id,
      template: item.template,
      rendered_text: rendered,
      tags: item.tags,
      citations: item.citations,
    };
  });
}

export async function getMethodology() {
  const data = await loadData();

  return data.methodology.map((item, index) => ({
    id: `methodology-${index + 1}`,
    version_name: item.version_name,
    equation_string: item.equation_string || FALLBACK_EQUATION,
    description: item.description || null,
    created_at: new Date().toISOString(),
  }));
}

export async function getCurrentEmissionFactors() {
  const data = await loadData();

  return data.emissionFactors
    .map((row) => ({
      activity_name: activityNameFromCategory(row.category),
      category: row.category,
      region: row.region,
      unit_activity: row.unit_activity,
      effective_factor_kgco2e_per_unit: row.factor_kgco2e_per_unit,
      effective_source_name: row.source_name,
      effective_source_url: row.source_url,
      effective_source_year: row.source_year,
      uses_custom_override: false,
      default_factor_kgco2e_per_unit: row.factor_kgco2e_per_unit,
      default_source_name: row.source_name,
      default_source_url: row.source_url,
      default_source_year: row.source_year,
      custom_factor_kgco2e_per_unit: null,
      custom_source_name: null,
      custom_source_url: null,
      custom_source_year: null,
    }))
    .sort((a, b) => `${a.activity_name}:${a.region}`.localeCompare(`${b.activity_name}:${b.region}`));
}

export async function createSurvey(input: {
  country: string;
  answers_json: JsonObject;
}): Promise<SurveyPayload> {
  const country = input.country.trim().toUpperCase();
  if (country.length < 2) {
    throw new Error("Country code must be at least 2 characters.");
  }

  const surveyWithoutId = {
    country,
    answers_json: input.answers_json,
    created_at: new Date().toISOString(),
  };

  return {
    ...surveyWithoutId,
    id: encodeSurveyId(surveyWithoutId),
  };
}

export async function calculateSurvey(surveyId: string): Promise<{
  survey: SurveyPayload;
  calculation: {
    id: string;
    survey_id: string;
    methodology_version_id: string;
    total_kgco2e: number;
    breakdown_json: {
      total_kgco2e: number;
      lines: Array<{
        category: string;
        activity_value: number;
        activity_unit: string;
        emission_factor: number;
        factor_unit: string;
        result_kgco2e: number;
        formula_string: string;
      }>;
    };
    created_at: string;
  };
  carbon_index: {
    india_index: number;
    world_index: number;
    interpretation: string;
  };
}> {
  const data = await loadData();
  const survey = decodeSurveyId(surveyId);
  const activities = extractActivities(survey.answers_json);
  const asOfIsoDate = new Date().toISOString().slice(0, 10);

  const lines = activities.map((activity) => {
    const factor = findBestFactor(data.emissionFactors, {
      category: activity.category,
      unit: activity.unit,
      region: survey.country,
      asOfIsoDate,
    });

    if (!factor) {
      throw new Error(
        `No emission factor found for category=${activity.category}, unit=${activity.unit}, region=${survey.country}.`,
      );
    }

    const result = Number((activity.value * factor.factor_kgco2e_per_unit).toFixed(4));
    const factorUnit = `kgCO2e/${factor.unit_activity}`;

    return {
      category: activity.category,
      activity_value: activity.value,
      activity_unit: activity.unit,
      emission_factor: factor.factor_kgco2e_per_unit,
      factor_unit: factorUnit,
      result_kgco2e: result,
      formula_string: `${formatDecimal(activity.value)} ${activity.unit} × ${formatDecimal(
        factor.factor_kgco2e_per_unit,
      )} ${factorUnit} = ${formatDecimal(result)} kgCO2e`,
    };
  });

  const totalKgCo2e = Number(lines.reduce((sum, line) => sum + line.result_kgco2e, 0).toFixed(4));
  const annualTonnes = (totalKgCo2e * 12) / 1000;

  const indiaBenchmark = pickBenchmark(data.benchmarks, "annual_per_capita_emissions", "IN");
  const worldBenchmark = pickBenchmark(data.benchmarks, "annual_per_capita_emissions", "WORLD");

  if (!indiaBenchmark || !worldBenchmark) {
    throw new Error("Benchmark data is unavailable.");
  }

  const indiaIndex = Number(((annualTonnes / indiaBenchmark.value_tonnes_per_person) * 100).toFixed(2));
  const worldIndex = Number(((annualTonnes / worldBenchmark.value_tonnes_per_person) * 100).toFixed(2));

  const carbonIndex = {
    india_index: indiaIndex,
    world_index: worldIndex,
    interpretation: worldIndex < 70 ? "below average" : worldIndex <= 130 ? "around average" : "above average",
  };

  return {
    survey,
    calculation: {
      id: randomUUID(),
      survey_id: survey.id,
      methodology_version_id: randomUUID(),
      total_kgco2e: totalKgCo2e,
      breakdown_json: {
        total_kgco2e: totalKgCo2e,
        lines,
      },
      created_at: new Date().toISOString(),
    },
    carbon_index: carbonIndex,
  };
}

export async function getSurveyDashboard(surveyId: string) {
  const data = await loadData();
  const calculated = await calculateSurvey(surveyId);
  const facts = renderFacts(
    data.factTemplates,
    calculated.calculation.total_kgco2e,
    calculated.carbon_index.world_index,
  );

  return {
    survey: calculated.survey,
    calculation: calculated.calculation,
    carbon_index: calculated.carbon_index,
    benchmarks: data.benchmarks.map((row, index) => ({
      id: `benchmark-${index + 1}`,
      metric: row.metric,
      region: row.region,
      year: row.year,
      value_tonnes_per_person: row.value_tonnes_per_person,
      source_name: row.source_name,
      source_url: row.source_url,
    })),
    facts,
  };
}
