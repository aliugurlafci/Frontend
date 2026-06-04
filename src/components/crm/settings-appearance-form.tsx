"use client";

import { useSettings, type Theme } from "@/components/ui/settings-provider";
import { useI18n } from "@/lib/i18n/context";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

const THEMES: { value: Theme; label: string; hint: string }[] = [
  { value: "light", label: "Light", hint: "Bright and clean" },
  { value: "dark", label: "Dark", hint: "Easy on the eyes" },
  { value: "system", label: "System", hint: "Match your OS" },
];
const ACCENTS = ["#e11d48", "#2563eb", "#7c3aed", "#059669", "#d97706", "#0891b2"];
const DENSITIES: { value: string; label: string }[] = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
];

export function AppearanceForm() {
  const { settings, setSetting, theme, setTheme } = useSettings();
  const { t } = useI18n();
  const accent = settings.accent ?? "";
  const density = settings.density || "comfortable";

  const chooseAccent = (hex: string) => setSetting("accent", hex);
  const chooseDensity = (value: string) => setSetting("density", value);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">{t("common.save")} — changes apply instantly and are saved to your account.</p>

      <Card>
        <CardHeader title="Theme" />
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-3">
            {THEMES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTheme(opt.value)}
                className={cn(
                  "flex items-start gap-2 rounded-lg border p-3 text-left hover:bg-surface-2",
                  theme === opt.value ? "border-primary ring-1 ring-primary" : "border-border",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 h-3.5 w-3.5 rounded-full border",
                    theme === opt.value ? "border-primary bg-primary" : "border-border",
                  )}
                />
                <span>
                  <span className="block text-sm font-medium">{opt.label}</span>
                  <span className="block text-xs text-muted">{opt.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Accent color" />
          <CardBody className="flex flex-wrap gap-2">
            {ACCENTS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => chooseAccent(c)}
                aria-label={`Accent ${c}`}
                className={cn(
                  "h-8 w-8 rounded-full border-2 transition-transform hover:scale-110",
                  accent === c ? "border-foreground" : "border-border",
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Density" />
          <CardBody>
            <div className="grid gap-3 sm:grid-cols-2">
              {DENSITIES.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => chooseDensity(d.value)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border p-3 text-left hover:bg-surface-2",
                    density === d.value ? "border-primary ring-1 ring-primary" : "border-border",
                  )}
                >
                  <span
                    className={cn(
                      "h-3.5 w-3.5 rounded-full border",
                      density === d.value ? "border-primary bg-primary" : "border-border",
                    )}
                  />
                  <span className="text-sm font-medium">{d.label}</span>
                </button>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
