"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** True when the user asked the OS to reduce motion — animations should no-op. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

/**
 * Staggered entrance wrapper — fades + rises its children in, offset by `i` so a
 * grid/list reveals in a cascade. Purely decorative; the final state is the
 * natural layout, so content is always present.
 */
export function Reveal({
  i = 0,
  step = 55,
  className,
  children,
}: {
  i?: number;
  step?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("animate-rise", className)} style={{ animationDelay: `${i * step}ms` }}>
      {children}
    </div>
  );
}

/**
 * Animated number — eases from its previous value to `value` with
 * requestAnimationFrame. Honours reduced-motion (snaps instantly). `format`
 * controls rendering (defaults to a locale-grouped integer).
 */
export function CountUp({
  value,
  duration = 850,
  className,
  format,
}: {
  value: number;
  duration?: number;
  className?: string;
  format?: (n: number) => string;
}) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const to = value;
    const from = fromRef.current;
    if (reduced || from === to) {
      setDisplay(to);
      fromRef.current = to;
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisplay(from + (to - from) * eased);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);

  const rounded = Math.round(display);
  return <span className={className}>{format ? format(rounded) : rounded.toLocaleString()}</span>;
}

/**
 * A horizontal progress/meter bar that animates its fill from 0 → `pct` on
 * mount (and whenever pct changes). The flowing-gradient sheen gives it life.
 */
export function AnimatedBar({
  pct,
  className,
  barClassName,
  flow = true,
}: {
  pct: number;
  className?: string;
  barClassName?: string;
  flow?: boolean;
}) {
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  useEffect(() => {
    if (reduced) {
      setW(pct);
      return;
    }
    const id = requestAnimationFrame(() => setW(pct));
    return () => cancelAnimationFrame(id);
  }, [pct, reduced]);
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-surface-2", className)}>
      <div
        className={cn(
          "h-full rounded-full bg-gradient-to-r from-primary via-secondary to-primary transition-[width] duration-700 ease-out",
          flow && !reduced && "animate-flow",
          barClassName,
        )}
        style={{ width: `${Math.max(0, Math.min(100, w))}%` }}
      />
    </div>
  );
}

/** Shimmering skeleton block for loading states. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-surface-2", className)}>
      <div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-foreground/10 to-transparent"
        style={{ animation: "shimmer 1.4s infinite" }}
      />
    </div>
  );
}

/** A small grid of skeleton cards — the default automation "loading" state. */
export function SkeletonCards({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-24" />
      ))}
    </div>
  );
}
