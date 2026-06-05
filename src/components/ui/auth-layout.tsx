import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** Shared glass input style for the standalone auth/status screens (taller than the in-app Input). */
export const AUTH_FIELD =
  "h-11 w-full rounded-xl border border-border-strong bg-surface/60 px-3.5 text-sm text-foreground placeholder:text-muted-2 backdrop-blur-sm transition-[border-color,box-shadow,background-color] focus:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:bg-surface";

/** Shared gradient CTA button style for the auth/status screens. */
export const AUTH_BUTTON =
  "inline-flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-b from-primary to-primary-hover text-sm font-semibold text-primary-foreground shadow-[0_10px_26px_-8px_var(--primary)] transition-all hover:brightness-110 active:translate-y-px disabled:opacity-60";

/** Aula brand lockup (gradient badge + wordmark) used atop the auth screens. */
export function AuthBrand() {
  return (
    <div className="mb-6 flex items-center justify-center gap-2.5">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-hover text-xl font-bold text-primary-foreground shadow-[0_10px_26px_-6px_var(--primary)]">
        A
      </div>
      <span className="text-2xl font-bold tracking-tight">Aula CRM</span>
    </div>
  );
}

/**
 * Full-screen, centered glass shell for the standalone (chromeless) screens:
 * auth flows + status pages. Renders the brand, an optional title/subtitle, and
 * wraps content in a frosted card floating over the aurora background.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  center = false,
  card = true,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Center-align the title/subtitle (status & lock screens). */
  center?: boolean;
  /** Wrap children in the glass card (default). Set false for bare hero layouts. */
  card?: boolean;
}) {
  const header = (title || subtitle) && (
    <div className={cn(center && "text-center")}>
      {title && <h1 className="text-2xl font-bold tracking-tight">{title}</h1>}
      {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
    </div>
  );

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      {/* Decorative aurora orbs floating behind the frosted card. */}
      <div className="aurora-orb left-[-6rem] top-[-6rem] h-72 w-72" style={{ background: "var(--aurora-1)" }} aria-hidden />
      <div className="aurora-orb right-[-8rem] top-1/4 h-80 w-80" style={{ background: "var(--aurora-2)" }} aria-hidden />
      <div className="aurora-orb bottom-[-8rem] left-1/4 h-80 w-80" style={{ background: "var(--aurora-3)" }} aria-hidden />

      <div className="relative z-10 w-full max-w-md">
        <AuthBrand />
        {card ? (
          <div className="glass glass-sheen rounded-3xl p-7 shadow-[var(--shadow-lg)] animate-rise sm:p-8">
            {header}
            {children}
          </div>
        ) : (
          <div className="animate-rise text-center">
            {header}
            {children}
          </div>
        )}
        {footer ?? <p className="mt-6 text-center text-xs text-muted">Copyright © 2026 — Aula CRM</p>}
      </div>
    </div>
  );
}
