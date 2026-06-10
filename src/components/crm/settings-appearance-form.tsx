"use client";

import { useSettings, type Theme } from "@/components/ui/settings-provider";
import { useI18n } from "@/lib/i18n/context";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

const THEMES: { value: Theme; labelKey: string; hintKey: string }[] = [
  { value: "light", labelKey: "settings.appearance.themeLight", hintKey: "settings.appearance.themeLightHint" },
  { value: "dark", labelKey: "settings.appearance.themeDark", hintKey: "settings.appearance.themeDarkHint" },
  { value: "system", labelKey: "settings.appearance.themeSystem", hintKey: "settings.appearance.themeSystemHint" },
];
const ACCENTS = ["#e11d48", "#2563eb", "#7c3aed", "#059669", "#d97706", "#0891b2"];
const DENSITIES: { value: string; labelKey: string }[] = [
  { value: "comfortable", labelKey: "settings.appearance.comfortable" },
  { value: "compact", labelKey: "settings.appearance.compact" },
];
const FONT_SIZES: { value: string; labelKey: string }[] = [
  { value: "sm", labelKey: "settings.appearance.fontSm" },
  { value: "md", labelKey: "settings.appearance.fontMd" },
  { value: "lg", labelKey: "settings.appearance.fontLg" },
];

const optionBtn = (active: boolean) =>
  cn("flex items-center gap-2 rounded-lg border p-3 text-left hover:bg-surface-2", active ? "border-primary ring-1 ring-primary" : "border-border");
const dot = (active: boolean) => cn("h-3.5 w-3.5 rounded-full border", active ? "border-primary bg-primary" : "border-border");

export function AppearanceForm() {
  const { settings, setSetting, theme, setTheme } = useSettings();
  const { t } = useI18n();
  const accent = settings.accent ?? "";
  const density = settings.density || "comfortable";
  const fontSize = settings.fontSize || "md";
  const reducedMotion = settings.motion === "reduced";

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">{t("settings.appearance.applyHint")}</p>

      <Card>
        <CardHeader title={t("settings.appearance.theme")} />
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-3">
            {THEMES.map((opt) => (
              <button key={opt.value} type="button" onClick={() => setTheme(opt.value)} className={optionBtn(theme === opt.value)}>
                <span className={cn("mt-0.5", dot(theme === opt.value))} />
                <span>
                  <span className="block text-sm font-medium">{t(opt.labelKey)}</span>
                  <span className="block text-xs text-muted">{t(opt.hintKey)}</span>
                </span>
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("settings.appearance.accent")} />
        <CardBody className="flex flex-wrap items-center gap-2">
          {ACCENTS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setSetting("accent", c)}
              aria-label={t("settings.appearance.accentAria", { color: c })}
              className={cn("h-8 w-8 rounded-full border-2 transition-transform hover:scale-110", accent === c ? "border-foreground" : "border-border")}
              style={{ backgroundColor: c }}
            />
          ))}
          {/* Custom colour — any hex, not just the presets. */}
          <label className="ml-1 flex cursor-pointer items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-surface-2">
            <span
              className="h-5 w-5 rounded-full border border-border"
              style={{ backgroundColor: accent && !ACCENTS.includes(accent) ? accent : "transparent" }}
            />
            {t("settings.appearance.custom")}
            <input type="color" value={accent || "#e11d48"} onChange={(e) => setSetting("accent", e.target.value)} className="sr-only" />
          </label>
          {accent && (
            <button type="button" onClick={() => setSetting("accent", "")} className="text-xs text-muted hover:text-foreground">
              {t("settings.appearance.reset")}
            </button>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("settings.appearance.density")} />
          <CardBody>
            <div className="grid gap-3 sm:grid-cols-2">
              {DENSITIES.map((d) => (
                <button key={d.value} type="button" onClick={() => setSetting("density", d.value)} className={optionBtn(density === d.value)}>
                  <span className={dot(density === d.value)} />
                  <span className="text-sm font-medium">{t(d.labelKey)}</span>
                </button>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t("settings.appearance.fontSize")} />
          <CardBody>
            <div className="grid gap-3 sm:grid-cols-3">
              {FONT_SIZES.map((f) => (
                <button key={f.value} type="button" onClick={() => setSetting("fontSize", f.value)} className={optionBtn(fontSize === f.value)}>
                  <span className={dot(fontSize === f.value)} />
                  <span className="text-sm font-medium">{t(f.labelKey)}</span>
                </button>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title={t("settings.appearance.motion")} />
        <CardBody className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">{t("settings.appearance.motionDesc")}</p>
          <button
            type="button"
            role="switch"
            aria-checked={reducedMotion}
            onClick={() => setSetting("motion", reducedMotion ? "" : "reduced")}
            className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", reducedMotion ? "bg-primary" : "bg-surface-2 border border-border")}
          >
            <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", reducedMotion ? "translate-x-5" : "translate-x-0.5")} />
          </button>
        </CardBody>
      </Card>
    </div>
  );
}
