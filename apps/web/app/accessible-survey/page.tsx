import Link from "next/link";

import AccessibleSurveyForm from "./AccessibleSurveyForm";

export default function AccessibleSurveyPage() {
  return (
    <main className="survey-page">
      <header className="survey-hero">
        <p className="eyebrow">Accessible Survey</p>
        <h1>Weekly Lifestyle Survey</h1>
        <p>
          Don&apos;t know monthly bills? Answer simple weekly lifestyle questions and we will
          estimate monthly activity data for you.
        </p>
        <Link href="/monthly-survey" className="back-link">
          Need full manual control? Open Monthly Survey
        </Link>
        <br />
        <Link href="/methodology" className="back-link">
          View methodology
        </Link>
      </header>

      <AccessibleSurveyForm />
    </main>
  );
}
