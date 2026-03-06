import Link from "next/link";

import SurveyForm from "./SurveyForm";

export default function SurveyPage() {
  return (
    <main className="survey-page">
      <header className="survey-hero">
        <p className="eyebrow">Monthly Calculator</p>
        <h1>Monthly Calculator (Advanced)</h1>
        <p>
          Best when you have bills and measured records. Enter monthly values for transport,
          utilities, and lifestyle categories.
        </p>
        <Link href="/weekly-survey" className="back-link">
          Prefer quick weekly inputs? Open Weekly Calculator
        </Link>
        <br />
        <Link href="/methodology" className="back-link">
          View methodology
        </Link>
      </header>

      <SurveyForm />
    </main>
  );
}
