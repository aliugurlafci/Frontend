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
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-surface-2",
        danger ? "text-danger hover:bg-danger/10" : "text-foreground",
      )}
    >
      {children}
    </button>
  );
}
