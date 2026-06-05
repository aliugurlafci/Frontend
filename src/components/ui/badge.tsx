import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted border-border-strong",
  info: "bg-info/12 text-info border-info/25",
  success: "bg-success/12 text-success border-success/25",
  warning: "bg-warning/15 text-warning border-warning/30",
  danger: "bg-danger/12 text-danger border-danger/25",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium backdrop-blur-sm",
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}
