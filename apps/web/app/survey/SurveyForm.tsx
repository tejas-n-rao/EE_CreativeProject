"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ActivityInput = {
  category: string;
  unit: string;
  value: string;
};

type CategoryPreset = {
  category: string;
  label: string;
  units: string[];
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

const CATEGORY_PRESETS: CategoryPreset[] = [
  { category: "electricity", label: "Electricity", units: ["kWh"] },
  { category: "water_supply_m3", label: "Water Supply", units: ["m3"] },
  { category: "lpg_kg", label: "Cooking Gas (LPG)", units: ["kg"] },
  { category: "petrol_car_km", label: "Petrol Car", units: ["km"] },
  { category: "diesel_car_km", label: "Diesel Car", units: ["km"] },
  { category: "two_wheeler_km", label: "Two-wheeler", units: ["km"] },
  { category: "bus_km", label: "Bus", units: ["km"] },
  { category: "metro_km", label: "Metro", units: ["km"] },
  { category: "rail_km", label: "Rail", units: ["km"] },
  { category: "flight_shorthaul", label: "Short-haul Flight", units: ["passenger_km"] },
  { category: "diet_plant_based_day", label: "Diet: Plant-based Days", units: ["person_day"] },
  { category: "diet_mixed_day", label: "Diet: Mixed Days", units: ["person_day"] },
  { category: "diet_meat_heavy_day", label: "Diet: Meat-heavy Days", units: ["person_day"] },
];

function initialActivities(): ActivityInput[] {
  return [
    { category: "electricity", unit: "kWh", value: "240" },
    { category: "water_supply_m3", unit: "m3", value: "12" },
    { category: "petrol_car_km", unit: "km", value: "120" },
    { category: "bus_km", unit: "km", value: "80" },
    { category: "diet_mixed_day", unit: "person_day", value: "30" },
  ];
}

export default function SurveyForm() {
  const router = useRouter();

  const [country, setCountry] = useState("IN");
  const [activities, setActivities] = useState<ActivityInput[]>(() => initialActivities());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const categoryMap = useMemo(() => {
    return new Map(CATEGORY_PRESETS.map((item) => [item.category, item]));
  }, []);

  function updateActivity(index: number, patch: Partial<ActivityInput>) {
    setActivities((current) => {
      const next = [...current];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function addActivity() {
    setActivities((current) => [...current, { category: "electricity", unit: "kWh", value: "" }]);
  }

  function removeActivity(index: number) {
    setActivities((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  function validateActivities() {
    if (activities.length === 0) {
      throw new Error("Add at least one activity row.");
    }

    return activities.map((item, index) => {
      const numericValue = Number(item.value);
      if (!item.category.trim()) {
        throw new Error(`Row ${index + 1}: category is required.`);
      }
      if (!item.unit.trim()) {
        throw new Error(`Row ${index + 1}: unit is required.`);
      }
      if (!Number.isFinite(numericValue) || numericValue <= 0) {
        throw new Error(`Row ${index + 1}: value must be greater than 0.`);
      }

      return {
        category: item.category,
        unit: item.unit,
        value: numericValue,
      };
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    try {
      const cleanCountry = country.trim().toUpperCase();
      if (cleanCountry.length < 2) {
        throw new Error("Country code must be at least 2 characters.");
      }

      const activityPayload = validateActivities();
      setIsSubmitting(true);

      const surveyResponse = await fetch(`${API_BASE}/v1/surveys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: cleanCountry,
          answers_json: { activities: activityPayload },
        }),
      });

      if (!surveyResponse.ok) {
        const body = await surveyResponse.json().catch(() => null);
        throw new Error(body?.detail || `Survey creation failed (${surveyResponse.status}).`);
      }

      const survey = (await surveyResponse.json()) as { id: string };

      const calculateResponse = await fetch(`${API_BASE}/v1/surveys/${survey.id}/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!calculateResponse.ok) {
        const body = await calculateResponse.json().catch(() => null);
        throw new Error(body?.detail || `Calculation failed (${calculateResponse.status}).`);
      }

      router.push(`/dashboard/${survey.id}`);
    } catch (error) {
      if (error instanceof TypeError) {
        setErrorMessage(
          `Could not reach API at ${API_BASE}. Ensure FastAPI is running and NEXT_PUBLIC_API_BASE_URL is correct.`,
        );
      } else {
        setErrorMessage(
          error instanceof Error ? error.message : "Unexpected error while submitting survey.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="survey-panel">
      <h2>Monthly Calculator</h2>
      <p>
        Enter monthly activity values directly from bills and records. This advanced form supports
        transport, utility, and livelihood categories.
      </p>

      <form onSubmit={handleSubmit} className="survey-form">
        <label className="field-label" htmlFor="country-input">
          Country Code
        </label>
        <input
          id="country-input"
          className="text-input"
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          maxLength={12}
          placeholder="IN"
        />

        <div className="activity-header">
          <h3>Monthly Activity Rows</h3>
          <button type="button" className="secondary-button" onClick={addActivity}>
            + Add Activity
          </button>
        </div>

        <div className="activity-grid">
          {activities.map((item, index) => {
            const preset = categoryMap.get(item.category);
            const unitOptions = preset?.units || [item.unit || "unit"];

            return (
              <article key={`activity-${index}`} className="activity-row">
                <div>
                  <label className="field-label">Category</label>
                  <select
                    className="text-input"
                    value={item.category}
                    onChange={(event) => {
                      const nextCategory = event.target.value;
                      const nextPreset = categoryMap.get(nextCategory);
                      updateActivity(index, {
                        category: nextCategory,
                        unit: nextPreset?.units[0] || item.unit,
                      });
                    }}
                  >
                    {CATEGORY_PRESETS.map((option) => (
                      <option key={option.category} value={option.category}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="field-label">Unit</label>
                  <select
                    className="text-input"
                    value={item.unit}
                    onChange={(event) => updateActivity(index, { unit: event.target.value })}
                  >
                    {unitOptions.map((unit) => (
                      <option key={`${item.category}-${unit}`} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="field-label">Value</label>
                  <input
                    className="text-input"
                    type="number"
                    step="any"
                    min="0"
                    value={item.value}
                    onChange={(event) => updateActivity(index, { value: event.target.value })}
                  />
                </div>

                <button
                  type="button"
                  className="danger-button"
                  onClick={() => removeActivity(index)}
                  disabled={activities.length <= 1}
                >
                  Remove
                </button>
              </article>
            );
          })}
        </div>

        {errorMessage && <p className="form-error">{errorMessage}</p>}

        <button type="submit" className="primary-button" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Calculate Monthly Footprint"}
        </button>
      </form>
    </section>
  );
}
