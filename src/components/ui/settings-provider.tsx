"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/api-client";

export type Theme = "light" | "dark" | "system";

export type Settings = Record<string, string>;

interface SettingsContextValue {
  settings: Settings;
  /** Optimistically update a setting and persist it to the per-user `userSetting` table. */
  setSetting: (key: string, value: string) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/** Apply appearance settings to <html> (mirrors the pre-paint NO_FLASH script). */
function applyAppearance(s: Settings): void {
  const R = document.documentElement;
  const theme = (s.theme as Theme) || "system";
  const dark =
    theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  R.classList.toggle("dark", dark);
  if (s.accent) {
    R.style.setProperty("--primary", s.accent);
    R.style.setProperty("--primary-hover", s.accent);
  } else {
    R.style.removeProperty("--primary");
    R.style.removeProperty("--primary-hover");
  }
  if (s.density === "compact") R.setAttribute("data-density", "compact");
  else R.removeAttribute("data-density");
}

/**
 * Per-user settings store, seeded server-side from the DB (`userSetting` table)
 * so the first paint already matches. Changes are applied to the DOM and
 * persisted via `PATCH /auth/settings` — no cookies/localStorage.
 */
export function SettingsProvider({ initial, children }: { initial: Settings; children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(initial);

  // Keep the DOM in sync with settings, and follow OS changes while on "system".
  useEffect(() => {
    applyAppearance(settings);
    if (((settings.theme as Theme) || "system") !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyAppearance(settings);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [settings]);

  function setSetting(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    apiFetch("/auth/settings", { method: "PATCH", body: { settings: { [key]: value } } }).catch(() => {
      /* best-effort — the UI already reflects the change */
    });
  }

  const theme = (settings.theme as Theme) || "system";
  const setTheme = (t: Theme) => setSetting("theme", t);

  return (
    <SettingsContext.Provider value={{ settings, setSetting, theme, setTheme }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}

/** Back-compat adapter for components that only care about the theme. */
export function useTheme(): { theme: Theme; setTheme: (theme: Theme) => void } {
  const { theme, setTheme } = useSettings();
  return { theme, setTheme };
}
