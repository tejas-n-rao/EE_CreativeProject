import { promises as fs } from "fs";
import path from "path";
import Link from "next/link";

import HomeInteractive, { type FunFactTemplate } from "./HomeInteractive";

const templatePath = path.resolve(process.cwd(), "..", "..", "data", "fun_facts_template.csv");

function parseCsvRow(row: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];

    if (character === '"') {
      const nextCharacter = row[index + 1];
      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
}

function fallbackFacts(): FunFactTemplate[] {
  return [
    {
      id: "1",
      title: "Cooling and comfort",
      climate_fact:
        "Room cooling can be one of the largest drivers of household electricity in warm months.",
      livelihood_link: "Efficient cooling lowers bills while keeping workers productive in hotter hours.",
      action_prompt: "Try one efficiency switch each month: AC setpoint, fan pairing, or insulation.",
      tag: "home-energy",
      source_title: "IEA - The Future of Cooling",
      source_url: "https://www.iea.org/reports/the-future-of-cooling/",
      source_accessed_on: "2026-03-17",
    },
    {
      id: "2",
      title: "Mobility choices",
      climate_fact:
        "Switching even a portion of short city trips to metro or bus can cut transport emissions.",
      livelihood_link: "Lower monthly commute spend can free budget for education, health, or savings.",
      action_prompt: "Test one mixed-mode week and compare cost + travel time.",
      tag: "transport",
      source_title: "IEA - Energy Efficiency Policy Toolkit 2025: Transport",
      source_url: "https://www.iea.org/reports/energy-efficiency-policy-toolkit-2025/transport",
      source_accessed_on: "2026-03-17",
    },
    {
      id: "3",
      title: "Food and fuel",
      climate_fact:
        "Meal patterns, LPG use, and food mix all contribute to monthly footprint outcomes.",
      livelihood_link:
        "Better meal planning can reduce waste, smooth food expenses, and improve nutrition stability.",
      action_prompt: "Track home-cooked meals for two weeks to estimate your baseline.",
      tag: "livelihood",
      source_title: "UNEP - Food loss and waste",
      source_url:
        "https://www.unep.org/topics/chemicals-and-pollution-action/circularity-sectors/food-and-food-waste",
      source_accessed_on: "2026-03-17",
    },
  ];
}

async function loadTemplateFacts(): Promise<FunFactTemplate[]> {
  try {
    const raw = await fs.readFile(templatePath, "utf8");
    const rows = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (rows.length < 2) {
      return fallbackFacts();
    }

    const headers = parseCsvRow(rows[0]);
    const keyIndex = new Map(headers.map((header, index) => [header, index]));
    const required = ["id", "title", "climate_fact", "livelihood_link", "action_prompt", "tag"];

    if (!required.every((key) => keyIndex.has(key))) {
      return fallbackFacts();
    }

    const parsed = rows
      .slice(1)
      .map((row) => {
        const cells = parseCsvRow(row);
        return {
          id: cells[keyIndex.get("id") ?? -1] || "",
          title: cells[keyIndex.get("title") ?? -1] || "",
          climate_fact: cells[keyIndex.get("climate_fact") ?? -1] || "",
          livelihood_link: cells[keyIndex.get("livelihood_link") ?? -1] || "",
          action_prompt: cells[keyIndex.get("action_prompt") ?? -1] || "",
          tag: cells[keyIndex.get("tag") ?? -1] || "",
          source_title: cells[keyIndex.get("source_title") ?? -1] || "",
          source_url: cells[keyIndex.get("source_url") ?? -1] || "",
          source_accessed_on: cells[keyIndex.get("source_accessed_on") ?? -1] || "",
        } satisfies FunFactTemplate;
      })
      .filter((fact) => fact.id && fact.title && fact.climate_fact);

    return parsed.length > 0 ? parsed : fallbackFacts();
  } catch {
    return fallbackFacts();
  }
}

export default async function HomePage() {
  const facts = await loadTemplateFacts();

  return (
    <main className="home-page">
      <section className="home-hero">
        <p className="eyebrow">Climate + Livelihood Studio</p>
        <h1>Carbon Calculator</h1>
        <p>
          Estimate your footprint, compare against benchmarks, and explore practical climate facts
          tied to household livelihood choices.
        </p>
        <div className="home-cta-row">
          <Link href="/methodology" className="secondary-button">
            View Methodology
          </Link>
        </div>
      </section>

      <section className="mode-grid">
        <article className="mode-card">
          <h2>Weekly Calculator</h2>
          <p>
            Designed for quick weekly lifestyle inputs. Useful when you do not have monthly bill
            details ready.
          </p>
          <Link href="/weekly-survey" className="back-link">
            Open weekly mode
          </Link>
        </article>

        <article className="mode-card">
          <h2>Monthly Calculator</h2>
          <p>
            Best when you have bills and measured records. Enter utility and transport values
            directly for tighter estimates.
          </p>
          <Link href="/monthly-survey" className="back-link">
            Open monthly mode
          </Link>
        </article>
      </section>

      <section className="definitions-section">
        <h2>Important Definitions</h2>
        <div className="definitions-grid">
          <article className="definition-card">
            <h3>kgCO2e</h3>
            <p>
              Kilograms of carbon dioxide equivalent. A common unit for monthly emissions from
              electricity, transport, water, and food-related activity.
            </p>
          </article>
          <article className="definition-card">
            <h3>tCO2e</h3>
            <p>
              Tonnes of carbon dioxide equivalent. <code>1 tCO2e = 1000 kgCO2e</code>; used for
              annual comparisons.
            </p>
          </article>
          <article className="definition-card">
            <h3>Carbon Index</h3>
            <p>
              Relative score comparing your annual emissions against India or world per-capita
              benchmark values.
            </p>
          </article>
          <article className="definition-card">
            <h3>Emission Factor</h3>
            <p>
              Multiplier that converts an activity unit (like km, kWh, or m3) into emissions
              output.
            </p>
          </article>
          <article className="definition-card">
            <h3>Per-capita Benchmark</h3>
            <p>
              Reference annual emissions value per person for a region, used for context and
              comparison.
            </p>
          </article>
          <article className="definition-card">
            <h3>kWh and m3</h3>
            <p>
              <code>kWh</code> measures electricity use and <code>m3</code> measures water volume;
              both feed into footprint calculations.
            </p>
          </article>
        </div>
      </section>

      <HomeInteractive facts={facts} />
    </main>
  );
}
