"use client";

import { useT } from "@/lib/i18n/client";

/**
 * A small "barcode scanner is live" affordance — a pulsing dot + label. Shown
 * on the sales screens (POS, Cart, Returns) where a hardware reader can add an
 * item from anywhere on the page, signalling that scanning is active.
 */
export function ScannerChip() {
  const t = useT();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/70" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
      </span>
      {t("scan.active")}
    </span>
  );
}
