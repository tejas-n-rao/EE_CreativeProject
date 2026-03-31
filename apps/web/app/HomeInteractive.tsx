"use client";

import { useEffect, useState } from "react";

export type FunFactTemplate = {
  id: string;
  title: string;
  climate_fact: string;
  livelihood_link: string;
  action_prompt: string;
  tag: string;
  source_title?: string;
  source_url?: string;
  source_accessed_on?: string;
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
  const [isDarkMode, setIsDarkMode] = useState(false);
  const hasFacts = facts.length > 0;
  const safePane = hasFacts ? activePane % facts.length : 0;
  const activeFact = hasFacts ? facts[safePane] : null;

  useEffect(() => {
    if (facts.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActivePane((current) => (current + 1) % facts.length);
    }, 12000);

    return () => window.clearInterval(intervalId);
  }, [facts.length]);

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => {
      setIsDarkMode(root.getAttribute("data-theme") === "dark");
    };

    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  function movePane(step: number) {
    if (!hasFacts) {
      return;
    }
    setActivePane((current) => (current + step + facts.length) % facts.length);
  }

  return (
    <section className="interactive-section">
      <header>
        <p className="eyebrow">Interactive Fact Deck</p>
        <h2>Fun Facts</h2>
      </header>

      <article className="sweep-pane">
        <div className="sweep-pane-header">
          <h3>Fun Facts</h3>
          {hasFacts && facts.length > 1 && (
            <div className="sweep-controls">
              <button type="button" className="secondary-button" onClick={() => movePane(-1)}>
                Previous
              </button>
              <span>
                {safePane + 1} / {facts.length}
              </span>
              <button type="button" className="secondary-button" onClick={() => movePane(1)}>
                Next
              </button>
            </div>
          )}
        </div>

        {activeFact ? (
          <div
            key={`${activeFact.id}-${safePane}`}
            className={`sweep-pane-content ${isDarkMode ? "sweep-pane-content-animated" : ""}`}
          >
            <p className="fact-tag">{toTagLabel(activeFact.tag)}</p>
            <h3>{activeFact.title}</h3>
            <p>{activeFact.climate_fact}</p>
            <p>{activeFact.livelihood_link}</p>
            <p>
              <strong>Action:</strong> {activeFact.action_prompt}
            </p>
            {(activeFact.source_title || activeFact.source_url) && (
              <p className="fact-source">
                <strong>Source:</strong>{" "}
                {activeFact.source_url ? (
                  <a href={activeFact.source_url} target="_blank" rel="noreferrer">
                    {activeFact.source_title || activeFact.source_url}
                  </a>
                ) : (
                  activeFact.source_title
                )}
                {activeFact.source_accessed_on ? ` (accessed ${activeFact.source_accessed_on})` : ""}
              </p>
            )}
          </div>
        ) : (
          <p>Add rows to the template file to populate this section.</p>
        )}
      </article>
    </section>
  );
}
