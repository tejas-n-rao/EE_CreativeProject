import Link from "next/link";

import SurveyForm from "./SurveyForm";

export default function SurveyPage() {
  return (
    <main className="survey-page">
      <header className="survey-hero">
        <p className="eyebrow">Survey</p>
        <h1>Enter Your Monthly Activity Data</h1>
        <p>
          Submit your activities, run the emissions calculation, and open your dashboard.
        </p>
        <Link href="/methodology" className="back-link">
          View methodology
        </Link>
      </header>

      <SurveyForm />
    </main>
  );
}
