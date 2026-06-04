"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ConfigProvider, theme as antdTheme } from "antd";
import enUS from "antd/locale/en_US";
import trTR from "antd/locale/tr_TR";
import deDE from "antd/locale/de_DE";
import { useI18n } from "@/lib/i18n/context";

/** App locale → antd locale pack (pagination/sorter/empty text follow the UI language). */
const ANTD_LOCALES: Record<string, typeof enUS> = { en: enUS, tr: trTR, de: deDE };

/**
 * Tracks the resolved light/dark mode by observing the `.dark` class that
 * ThemeProvider toggles on <html> (covers light/dark/system + OS changes).
 *
 * `initialDark` comes from the server (the `aula_theme` cookie) so the first
 * render matches on both sides — no hydration mismatch and no flash for users
 * who explicitly picked light/dark. `system` is seeded light on the server and
 * corrected after mount (a real re-render, so antd's themed CSS variables, which
 * are keyed per mode, actually switch).
 */
function useIsDark(initialDark: boolean): boolean {
  const [dark, setDark] = useState(initialDark);
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setDark(el.classList.contains("dark"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

/**
 * Themes every Ant Design component to match the app's design tokens
 * (globals.css), its class-based dark mode, and its active UI language.
 */
export function AntdConfig({ children, initialDark = false }: { children: ReactNode; initialDark?: boolean }) {
  const { locale } = useI18n();
  const isDark = useIsDark(initialDark);

  return (
    <ConfigProvider
      locale={ANTD_LOCALES[locale] ?? enUS}
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        // antd v6 runs in CSS-variable mode: the token values live in a variable
        // block cached by `cssVar.key`. A stable key means a runtime light↔dark
        // switch reuses the cached (light) block and never updates the variables.
        // Keying it per mode gives each theme its own block, so toggling applies
        // the right one (fixes the header/background not following dark mode).
        cssVar: { key: isDark ? "aula-dark" : "aula-light" },
        token: {
          colorPrimary: isDark ? "#fb4b2a" : "#e41f07",
          colorInfo: isDark ? "#fb4b2a" : "#e41f07",
          colorError: isDark ? "#f04444" : "#dc2626",
          colorSuccess: isDark ? "#22c55e" : "#16a34a",
          colorWarning: "#f59e0b",
          borderRadius: 8,
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          fontSize: 14,
          colorBgContainer: isDark ? "#12161f" : "#ffffff",
          colorBgElevated: isDark ? "#1a1f2b" : "#ffffff",
          colorBorder: isDark ? "#232a36" : "#e7eaf0",
          colorBorderSecondary: isDark ? "#232a36" : "#e7eaf0",
          colorText: isDark ? "#e8ecf3" : "#0f172a",
          colorTextSecondary: isDark ? "#9aa6b6" : "#64748b",
        },
        components: {
          Table: {
            headerBg: isDark ? "#1a1f2b" : "#f1f4f8",
            headerColor: isDark ? "#9aa6b6" : "#64748b",
            headerSplitColor: "transparent",
            rowHoverBg: isDark ? "#1a1f2b" : "#f1f4f8",
            borderColor: isDark ? "#232a36" : "#e7eaf0",
            cellPaddingBlock: 10,
            cellPaddingInline: 16,
            headerBorderRadius: 0,
          },
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
