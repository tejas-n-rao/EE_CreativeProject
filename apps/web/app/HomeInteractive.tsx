"use client";

import { useEffect, useMemo, useState } from "react";

export type FunFactTemplate = {
  id: string;
  title: string;
  climate_fact: string;
  livelihood_link: string;
  action_prompt: string;
  tag: string;
};

function toTagLabel(tag: string): string {
  return tag
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function HomeInteractive({
  facts,
}: {
  facts: FunFactTemplate[];
}) {
  const [activePane, setActivePane] = useState(0);
  const [expandedCard, setExpandedCard] = useState<string | null>(facts[0]?.id ?? null);
  const hasFacts = facts.length > 0;
  const safePane = hasFacts ? activePane % facts.length : 0;
  const activeFact = hasFacts ? facts[safePane] : null;

  const tagSummary = useMemo(() => {
    return facts.reduce<Record<string, number>>((counts, fact) => {
      const key = fact.tag || "general";
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
  }, [facts]);

  useEffect(() => {
    if (facts.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActivePane((current) => (current + 1) % facts.length);
    }, 5500);

    return () => window.clearInterval(intervalId);
  }, [facts.length]);

  return (
    <section className="interactive-section">
      <header>
        <p className="eyebrow">Interactive Fact Deck</p>
        <h2>Climate and Livelihood Fun Facts</h2>
      </header>

      <article className="sweep-pane">
        <div className="sweep-pane-header">
          <h3>Fun Facts</h3>
        </div>

        {activeFact ? (
          <div className="sweep-pane-content">
            <p className="fact-tag">{toTagLabel(activeFact.tag)}</p>
            <h3>{activeFact.title}</h3>
            <p>{activeFact.climate_fact}</p>
            <p>{activeFact.livelihood_link}</p>
            <p>
              <strong>Action:</strong> {activeFact.action_prompt}
            </p>
          </div>
        ) : (
          <p>Add rows to the template file to populate this section.</p>
        )}
      </article>

      <section className="flashcard-grid">
        {facts.map((fact) => {
          const isExpanded = expandedCard === fact.id;
          return (
            <article key={fact.id} className={`flashcard ${isExpanded ? "is-expanded" : ""}`}>
              <button
                type="button"
                className="flashcard-button"
                onClick={() => setExpandedCard(isExpanded ? null : fact.id)}
              >
                <p className="fact-tag">{toTagLabel(fact.tag)}</p>
                <h3>{fact.title}</h3>
                <p>{fact.climate_fact}</p>
                {isExpanded && (
                  <>
                    <p>{fact.livelihood_link}</p>
                    <p>
                      <strong>Action:</strong> {fact.action_prompt}
                    </p>
                  </>
                )}
              </button>
            </article>
          );
        })}
      </section>

      <footer className="template-summary">
        {Object.entries(tagSummary).map(([tag, count]) => (
          <span key={tag}>
            {toTagLabel(tag)}: {count}
          </span>
        ))}
      </footer>
    </section>
  );
}
