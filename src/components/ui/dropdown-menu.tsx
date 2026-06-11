"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils/cn";

/**
 * Phase U1 — lightweight popover/dropdown. The panel is **portalled to
 * `document.body`** and positioned `fixed` from the trigger's rect, so it escapes
 * any `backdrop-filter`/`transform` ancestor (e.g. the glass header) that would
 * otherwise trap or mis-anchor an in-flow absolute panel. Closes on outside click
 * or Escape; follows the trigger on scroll/resize.
 */
export function DropdownMenu({
  trigger,
  children,
  align = "start",
  panelClassName,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: (props: { close: () => void }) => ReactNode;
  align?: "start" | "end";
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top?: number; bottom?: number; left?: number; right?: number; maxHeight: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Keep the portalled panel anchored under the trigger.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const margin = 8;
      const gap = 6;
      const spaceBelow = window.innerHeight - r.bottom - margin;
      const spaceAbove = r.top - margin;
      const horizontal = align === "end" ? { right: Math.round(window.innerWidth - r.right) } : { left: Math.round(r.left) };
      // Open downward by default; flip up when there's clearly more room above, so
      // a menu opened near the bottom of the viewport / a dialog isn't cut off.
      // Either way cap the height to the available space (the panel scrolls).
      if (spaceBelow < 240 && spaceAbove > spaceBelow) {
        setCoords({ ...horizontal, bottom: Math.round(window.innerHeight - r.top + gap), maxHeight: Math.max(140, Math.round(spaceAbove)) });
      } else {
        setCoords({ ...horizontal, top: Math.round(r.bottom + gap), maxHeight: Math.max(140, Math.round(spaceBelow)) });
      }
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, align]);

  // On open, move focus to the first menu item (skip panels that lead with a
  // text input — e.g. a field picker — so typing isn't hijacked).
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel || panel.querySelector("input, textarea")) return;
      panel.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open, coords]);

  // Arrow-key roving focus between menu items (WAI-ARIA menu pattern).
  const onPanelKeyDown = (e: React.KeyboardEvent) => {
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(current + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(current - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  };

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={triggerRef} className="relative inline-flex">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open &&
        mounted &&
        coords &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            aria-orientation="vertical"
            tabIndex={-1}
            onKeyDown={onPanelKeyDown}
            style={{ position: "fixed", top: coords.top, bottom: coords.bottom, left: coords.left, right: coords.right, maxHeight: coords.maxHeight }}
            className={cn(
              // z-[110] keeps the menu above modals/drawers (z-[100]) so a menu
              // opened from inside a dialog renders on top, not behind it.
              "glass-strong glass-sheen z-[110] min-w-44 overflow-y-auto rounded-xl p-1 shadow-[var(--shadow-lg)] animate-rise",
              panelClassName,
            )}
          >
            {children({ close: () => setOpen(false) })}
          </div>,
          document.body,
        )}
    </div>
  );
}

export function MenuItem({
  onClick,
  children,
  danger,
}: {
  onClick?: () => void;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm outline-none transition-colors hover:bg-surface-2 focus:bg-surface-2 focus-visible:ring-2 focus-visible:ring-primary/40",
        danger ? "text-danger hover:bg-danger/10 focus:bg-danger/10" : "text-foreground",
      )}
    >
      {children}
    </button>
  );
}
