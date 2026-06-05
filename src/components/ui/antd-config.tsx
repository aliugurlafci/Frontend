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
          borderRadius: 10,
          borderRadiusLG: 14,
          borderRadiusSM: 8,
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          fontSize: 14,
          // Translucent surfaces so antd components blend into the frosted-glass
          // shell. Floating panels get a real backdrop blur via globals.css.
          colorBgContainer: isDark ? "rgba(20,25,35,0.55)" : "rgba(255,255,255,0.6)",
          colorBgElevated: isDark ? "rgba(18,22,31,0.88)" : "rgba(255,255,255,0.85)",
          colorBgSpotlight: isDark ? "rgba(28,34,47,0.95)" : "rgba(15,23,42,0.92)",
          boxShadowSecondary: isDark
            ? "0 24px 60px -18px rgba(0,0,0,0.7)"
            : "0 24px 60px -18px rgba(15,23,42,0.30)",
          colorBorder: isDark ? "rgba(255,255,255,0.16)" : "rgba(15,23,42,0.16)",
          colorBorderSecondary: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)",
          colorText: isDark ? "#e8ecf3" : "#0f172a",
          colorTextSecondary: isDark ? "#9aa6b6" : "#5a6577",
        },
        components: {
          Table: {
            headerBg: isDark ? "rgba(28,34,47,0.6)" : "rgba(241,244,248,0.7)",
            headerColor: isDark ? "#9aa6b6" : "#5a6577",
            headerSplitColor: "transparent",
            rowHoverBg: isDark ? "rgba(28,34,47,0.6)" : "rgba(241,244,248,0.7)",
            // antd derives the sort/hover backgrounds by compositing a translucent
            // black fill over `colorBgContainer` and dropping the alpha. With the
            // container forced transparent (below), those solids collapse to pure
            // black — which painted sortable columns black on hover/sort in light
            // mode. Pin them to subtle neutral tints so they stay theme-correct.
            headerSortHoverBg: isDark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.05)",
            headerSortActiveBg: isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.08)",
            fixedHeaderSortActiveBg: isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.08)",
            bodySortBg: isDark ? "rgba(255,255,255,0.03)" : "rgba(15,23,42,0.02)",
            headerFilterHoverBg: isDark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.06)",
            borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)",
            colorBgContainer: "transparent",
            cellPaddingBlock: 11,
            cellPaddingInline: 16,
            headerBorderRadius: 0,
          },
          Modal: {
            contentBg: isDark ? "rgba(18,22,31,0.9)" : "rgba(255,255,255,0.88)",
            headerBg: "transparent",
          },
          Card: {
            colorBgContainer: isDark ? "rgba(20,25,35,0.55)" : "rgba(255,255,255,0.62)",
          },
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
