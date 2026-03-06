"use client";

import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

const STORAGE_KEY = "carbon-theme-mode";

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === "dark") {
    root.setAttribute("data-theme", "dark");
  } else {
    root.removeAttribute("data-theme");
  }
}

export default function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("light");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "dark" || saved === "light") {
      setMode(saved);
      applyTheme(saved);
      return;
    }

    applyTheme("light");
  }, []);

  function handleToggle() {
    const nextMode: ThemeMode = mode === "light" ? "dark" : "light";
    setMode(nextMode);
    applyTheme(nextMode);
    window.localStorage.setItem(STORAGE_KEY, nextMode);
  }

  const isDark = mode === "dark";
  return (
    <button type="button" className="theme-toggle" onClick={handleToggle}>
      {isDark ? "Dark Mode: On" : "Dark Mode: Off"}
    </button>
  );
}
