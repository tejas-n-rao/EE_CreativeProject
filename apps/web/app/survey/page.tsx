import Link from "next/link";

import SurveyForm from "./SurveyForm";

export default function SurveyPage() {
  return (
    <main className="survey-page">
      <header className="survey-hero">
        <p className="eyebrow">Monthly Survey</p>
        <h1>Monthly Survey (Advanced)</h1>
        <p>Enter measured monthly values for transport, utilities, and lifestyle categories.</p>
        <Link href="/accessible-survey" className="back-link">
          Prefer weekly lifestyle inputs? Open Accessible Survey
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
