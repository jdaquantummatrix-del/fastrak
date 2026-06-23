"use client";

import { useEffect, useState } from "react";

// Dev-only theme switcher. Themes are CSS-variable overrides defined in
// globals.css and selected via a `data-theme` attribute on <html>. "retro" is
// the default (the :root values) — selecting it just removes the attribute.
// Mounted only in development (see app/layout.tsx), so it never ships to prod.
const THEMES = [
  { key: "retro", label: "Retro (default)" },
  { key: "midnight", label: "Midnight" },
  { key: "paper", label: "Paper" },
  { key: "slate", label: "Slate" }
];
const STORAGE_KEY = "kenny_theme";

function applyTheme(theme: string) {
  const el = document.documentElement;
  if (theme && theme !== "retro") el.dataset.theme = theme;
  else delete el.dataset.theme;
}

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState("retro");

  useEffect(() => {
    let saved = "retro";
    try {
      saved = localStorage.getItem(STORAGE_KEY) || "retro";
    } catch {
      /* ignore */
    }
    setTheme(saved);
    applyTheme(saved);
  }, []);

  function choose(next: string) {
    setTheme(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        left: 16,
        bottom: 16,
        zIndex: 1300,
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "var(--panel)",
        color: "var(--ink)",
        border: "1.5px solid var(--line-strong)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow-hard)",
        padding: "6px 10px"
      }}
    >
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "var(--muted)"
        }}
      >
        Theme
      </span>
      <select
        aria-label="Switch theme (developer tool)"
        value={theme}
        onChange={(e) => choose(e.target.value)}
        style={{ width: "auto", minWidth: 0, padding: "4px 8px", fontSize: 12 }}
      >
        {THEMES.map((t) => (
          <option key={t.key} value={t.key}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}
