"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type LifestyleMode =
  | "petrol_car_km"
  | "diesel_car_km"
  | "two_wheeler_km"
  | "bus_km"
  | "metro_km"
  | "rail_km"
  | "ride_hailing_km";

type DietProfile = "diet_plant_based_day" | "diet_mixed_day" | "diet_meat_heavy_day";

type ActivityPayload = {
  category: string;
  unit: string;
  value: number;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const WEEKS_PER_MONTH = 4.345;
const DAYS_PER_MONTH = 30;

const MODE_LABELS: Record<LifestyleMode, string> = {
  petrol_car_km: "Petrol car",
  diesel_car_km: "Diesel car",
  two_wheeler_km: "Two-wheeler",
  bus_km: "Bus",
  metro_km: "Metro",
  rail_km: "Rail",
  ride_hailing_km: "Ride-hailing",
};

const DIET_LABELS: Record<DietProfile, string> = {
  diet_plant_based_day: "Mostly plant-based",
  diet_mixed_day: "Mixed diet",
  diet_meat_heavy_day: "Meat-heavy",
};

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toMonthlyKm(valuePerWeek: number): number {
  return valuePerWeek * WEEKS_PER_MONTH;
}

function addActivity(
  totals: Map<string, ActivityPayload>,
  category: string,
  unit: string,
  value: number,
) {
  if (!Number.isFinite(value) || value <= 0) {
    return;
  }

  const existing = totals.get(category);
  if (existing) {
    existing.value = roundTo2(existing.value + value);
    return;
  }

  totals.set(category, {
    category,
    unit,
    value: roundTo2(value),
  });
}

function parsePositiveNumber(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be 0 or greater.`);
  }
  return parsed;
}

export default function AccessibleSurveyForm() {
  const router = useRouter();

  const [country, setCountry] = useState("IN");
  const [primaryCommuteMode, setPrimaryCommuteMode] = useState<LifestyleMode>("bus_km");
  const [commuteDaysPerWeek, setCommuteDaysPerWeek] = useState("5");
  const [commuteRoundTripKm, setCommuteRoundTripKm] = useState("16");

  const [carKmWeekly, setCarKmWeekly] = useState("20");
  const [busKmWeekly, setBusKmWeekly] = useState("25");
  const [metroKmWeekly, setMetroKmWeekly] = useState("15");
  const [railKmWeekly, setRailKmWeekly] = useState("0");
  const [twoWheelerKmWeekly, setTwoWheelerKmWeekly] = useState("10");
  const [rideHailingKmWeekly, setRideHailingKmWeekly] = useState("8");

  const [flightsPerYear, setFlightsPerYear] = useState("2");
  const [avgFlightDistanceKm, setAvgFlightDistanceKm] = useState("900");

  const [householdSize, setHouseholdSize] = useState("2");
  const [acHoursPerDay, setAcHoursPerDay] = useState("3");
  const [hasRefrigerator, setHasRefrigerator] = useState("yes");
  const [showersPerWeek, setShowersPerWeek] = useState("10");
  const [laundryLoadsPerWeek, setLaundryLoadsPerWeek] = useState("3");
  const [homeCookedMealsPerWeek, setHomeCookedMealsPerWeek] = useState("14");

  const [dietProfile, setDietProfile] = useState<DietProfile>("diet_mixed_day");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const monthlyActivities = useMemo(() => {
    try {
      const totals = new Map<string, ActivityPayload>();

      const commuteDays = parsePositiveNumber(commuteDaysPerWeek, "Commute days per week");
      const commuteTripKm = parsePositiveNumber(commuteRoundTripKm, "Commute round-trip km");
      const weeklyCommuteKm = commuteDays * commuteTripKm;
      addActivity(totals, primaryCommuteMode, "km", toMonthlyKm(weeklyCommuteKm));

      addActivity(
        totals,
        "petrol_car_km",
        "km",
        toMonthlyKm(parsePositiveNumber(carKmWeekly, "Extra car km per week")),
      );
      addActivity(
        totals,
        "bus_km",
        "km",
        toMonthlyKm(parsePositiveNumber(busKmWeekly, "Extra bus km per week")),
      );
      addActivity(
        totals,
        "metro_km",
        "km",
        toMonthlyKm(parsePositiveNumber(metroKmWeekly, "Extra metro km per week")),
      );
      addActivity(
        totals,
        "rail_km",
        "km",
        toMonthlyKm(parsePositiveNumber(railKmWeekly, "Extra rail km per week")),
      );
      addActivity(
        totals,
        "two_wheeler_km",
        "km",
        toMonthlyKm(parsePositiveNumber(twoWheelerKmWeekly, "Extra two-wheeler km per week")),
      );
      addActivity(
        totals,
        "ride_hailing_km",
        "km",
        toMonthlyKm(parsePositiveNumber(rideHailingKmWeekly, "Extra ride-hailing km per week")),
      );

      const flightCount = parsePositiveNumber(flightsPerYear, "Flights per year");
      const avgFlightKm = parsePositiveNumber(avgFlightDistanceKm, "Average flight distance");
      addActivity(totals, "flight_shorthaul", "passenger_km", (flightCount * avgFlightKm) / 12);

      const people = Math.max(parsePositiveNumber(householdSize, "Household size"), 1);
      const acHours = parsePositiveNumber(acHoursPerDay, "AC hours per day");
      const showers = parsePositiveNumber(showersPerWeek, "Showers per week");
      const laundryLoads = parsePositiveNumber(
        laundryLoadsPerWeek,
        "Laundry machine loads per week",
      );
      const cookedMeals = parsePositiveNumber(homeCookedMealsPerWeek, "Home-cooked meals per week");

      // Household energy proxy (kWh/month): baseline + occupancy + cooling + fridge.
      const electricityKwhMonthly =
        45 + people * 18 + acHours * 30 * 1.2 + (hasRefrigerator === "yes" ? 25 : 0);

      // Water proxy (m3/month): baseline person use + showers + laundry.
      const weeklyWaterLitres = people * 40 * 7 + showers * 50 + laundryLoads * 70;
      const waterM3Monthly = (weeklyWaterLitres * WEEKS_PER_MONTH) / 1000;

      // Cooking gas proxy (kg/month): meals cooked at home.
      const lpgKgMonthly = cookedMeals * 0.08 * WEEKS_PER_MONTH;

      addActivity(totals, "electricity", "kWh", electricityKwhMonthly);
      addActivity(totals, "water_supply_m3", "m3", waterM3Monthly);
      addActivity(totals, "lpg_kg", "kg", lpgKgMonthly);
      addActivity(totals, dietProfile, "person_day", DAYS_PER_MONTH);

      return Array.from(totals.values()).sort((a, b) => a.category.localeCompare(b.category));
    } catch {
      return [];
    }
  }, [
    acHoursPerDay,
    avgFlightDistanceKm,
    busKmWeekly,
    carKmWeekly,
    commuteDaysPerWeek,
    commuteRoundTripKm,
    dietProfile,
    flightsPerYear,
    hasRefrigerator,
    homeCookedMealsPerWeek,
    householdSize,
    metroKmWeekly,
    primaryCommuteMode,
    railKmWeekly,
    rideHailingKmWeekly,
    showersPerWeek,
    laundryLoadsPerWeek,
    twoWheelerKmWeekly,
  ]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    try {
      const cleanCountry = country.trim().toUpperCase();
      if (cleanCountry.length < 2) {
        throw new Error("Country code must be at least 2 characters.");
      }

      if (monthlyActivities.length === 0) {
        throw new Error("Unable to derive activities. Check your weekly inputs.");
      }

      setIsSubmitting(true);

      const surveyResponse = await fetch(`${API_BASE}/v1/surveys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: cleanCountry,
          answers_json: { activities: monthlyActivities },
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
          error instanceof Error
            ? error.message
            : "Unexpected error while submitting weekly calculator form.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="survey-panel">
      <h2>Weekly Calculator</h2>
      <p className="survey-help">
        Weekly inputs are converted using: <code>monthly = weekly × 4.345</code>. Flights are
        annualized then divided by 12.
      </p>

      <form onSubmit={handleSubmit} className="survey-form">
        <label className="field-label" htmlFor="accessible-country-input">
          Country Code
        </label>
        <input
          id="accessible-country-input"
          className="text-input"
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          maxLength={12}
          placeholder="IN"
        />

        <div className="activity-grid">
          <article className="activity-row activity-row-single">
            <div>
              <label className="field-label">Primary commute mode</label>
              <select
                className="text-input"
                value={primaryCommuteMode}
                onChange={(event) => setPrimaryCommuteMode(event.target.value as LifestyleMode)}
              >
                {Object.entries(MODE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label">Commute days per week</label>
              <input
                className="text-input"
                type="number"
                min="0"
                step="1"
                value={commuteDaysPerWeek}
                onChange={(event) => setCommuteDaysPerWeek(event.target.value)}
              />
            </div>

            <div>
              <label className="field-label">Round-trip commute km per day</label>
              <input
                className="text-input"
                type="number"
                min="0"
                step="any"
                value={commuteRoundTripKm}
                onChange={(event) => setCommuteRoundTripKm(event.target.value)}
              />
            </div>
          </article>

          <article className="activity-row activity-row-single">
            <div>
              <label className="field-label">Extra car km per week</label>
              <input
                className="text-input"
                type="number"
                min="0"
                step="any"
                value={carKmWeekly}
                onChange={(event) => setCarKmWeekly(event.target.value)}
              />
            </div>

            <div>
              <label className="field-label">Extra bus km per week</label>
              <input
                className="text-input"
                type="number"
                min="0"
                step="any"
                value={busKmWeekly}
                onChange={(event) => setBusKmWeekly(event.target.value)}
              />
            </div>

            <div>
              <label className="field-label">Extra metro km per week</label>
              <input
                className="text-input"
                type="number"
                min="0"
                step="any"
                value={metroKmWeekly}
                onChange={(event) => setMetroKmWeekly(event.target.value)}
              />
            </div>
          </article>

          <article className="activity-row activity-row-single">
            <div>
              <label className="field-label">Extra rail km per week</label>
              <input
                className="text-input"
                type="number"
                min="0"
                step="any"
                value={railKmWeekly}
                onChange={(event) => setRailKmWeekly(event.target.value)}
              />
            </div>

            <div>
              <label className="field-label">Extra two-wheeler km per week</label>
              <input
                className="text-input"
                type="number"
                min="0"
                step="any"
                value={twoWheelerKmWeekly}
                onChange={(event) => setTwoWheelerKmWeekly(event.target.value)}
              />
            </div>

            <div>
              <label className="field-label">Extra ride-hailing km per week</label>
              <input
                className="text-input"
                type="number"
                min="0"
                step="any"
                value={rideHailingKmWeekly}
                onChange={(event) => setRideHailingKmWeekly(event.target.value)}
              />
            </div>
          </article>

          <article className="activity-row activity-row-single">
            <div>
              <label className="field-label">Flights per year</label>
              <input
                className="text-input"
                type="number"
                min="0"
                step="1"
                value={flightsPerYear}
                onChange={(event) => setFlightsPerYear(event.target.value)}
              />
            </div>

            <div>
              <label className="field-label">Average flight distance (km)</label>
              <input
                className="text-input"
                type="number"
                min="0"
                step="any"
                value={avgFlightDistanceKm}
                onChange={(event) => setAvgFlightDistanceKm(event.target.value)}
              />
            </div>

            <div>
              <label className="field-label">Household size (people)</label>
              <input
                className="text-input"
                type="number"
                min="1"
                step="1"
                value={householdSize}
                onChange={(event) => setHouseholdSize(event.target.value)}
              />
            </div>
          </article>

          <article className="activity-row activity-row-single">
            <div>
              <label className="field-label">AC hours per day</label>
              <input
                className="text-input"
                type="number"
                min="0"
                step="any"
                value={acHoursPerDay}
                onChange={(event) => setAcHoursPerDay(event.target.value)}
              />
            </div>

            <div>
              <label className="field-label">Refrigerator at home?</label>
              <select
                className="text-input"
                value={hasRefrigerator}
                onChange={(event) => setHasRefrigerator(event.target.value)}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>

            <div>
              <label className="field-label">Showers per week (household)</label>
              <input
                className="text-input"
                type="number"
                min="0"
                step="any"
                value={showersPerWeek}
                onChange={(event) => setShowersPerWeek(event.target.value)}
              />
            </div>
          </article>

          <article className="activity-row activity-row-single">
            <div>
              <label className="field-label">Laundry loads per week</label>
              <input
                className="text-input"
                type="number"
                min="0"
                step="any"
                value={laundryLoadsPerWeek}
                onChange={(event) => setLaundryLoadsPerWeek(event.target.value)}
              />
            </div>

            <div>
              <label className="field-label">Home-cooked meals per week</label>
              <input
                className="text-input"
                type="number"
                min="0"
                step="any"
                value={homeCookedMealsPerWeek}
                onChange={(event) => setHomeCookedMealsPerWeek(event.target.value)}
              />
            </div>

            <div>
              <label className="field-label">Diet profile</label>
              <select
                className="text-input"
                value={dietProfile}
                onChange={(event) => setDietProfile(event.target.value as DietProfile)}
              >
                {Object.entries(DIET_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </article>
        </div>

        <section className="activity-preview">
          <h3>Derived Monthly Activity Data</h3>
          {monthlyActivities.length === 0 ? (
            <p>Enter valid weekly values to preview derived monthly activity rows.</p>
          ) : (
            <ul>
              {monthlyActivities.map((activity) => (
                <li key={`${activity.category}-${activity.unit}`}>
                  <strong>{activity.category}</strong>: {activity.value} {activity.unit}
                </li>
              ))}
            </ul>
          )}
        </section>

        {errorMessage && <p className="form-error">{errorMessage}</p>}

        <button type="submit" className="primary-button" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Estimate + Calculate"}
        </button>
      </form>
    </section>
  );
}
