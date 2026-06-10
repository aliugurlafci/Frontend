"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "./settings-provider";

const ORDER: Theme[] = ["light", "dark", "system"];
const ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const Icon = ICONS[theme];
  return (
    <button
      type="button"
      aria-label={`Theme: ${theme} (click to change)`}
      title={`Theme: ${theme}`}
      onClick={() => setTheme(ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length])}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-all hover:bg-surface-2 hover:text-foreground active:scale-95"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
