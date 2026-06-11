"use client";

import { useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api-client";
import type { EntityRecord } from "@/lib/metadata/types";

/**
 * Resolve a scanned/typed code to a product: an exact local barcode/SKU match
 * first (instant, no round-trip), then the POS lookup endpoint for products
 * beyond the preloaded list. Returns `null` when nothing matches.
 */
/**
 * A fresh idempotency token for a checkout. `crypto.randomUUID()` needs a secure
 * context (HTTPS/localhost) and throws otherwise, so we fall back to a random
 * string when it's unavailable (e.g. the dev server reached over a LAN IP).
 */
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export async function resolveProduct(products: EntityRecord[], code: string): Promise<EntityRecord | null> {
  const c = code.trim();
  if (!c) return null;
  const local = products.find((p) => String(p.barcode ?? "") === c || String(p.sku ?? "") === c);
  if (local) return local;
  try {
    const { product } = await apiFetch<{ product: EntityRecord }>(`/pos/lookup?code=${encodeURIComponent(c)}`);
    return product ?? null;
  } catch {
    // 404 / no read access — treat as "not found", caller decides how to surface.
    return null;
  }
}

interface ScannerOptions {
  /** Fired with the decoded value when a hardware scan is recognised. */
  onScan: (code: string) => void;
  /** Toggle the listener (default: on). */
  enabled?: boolean;
  /** Shortest code length accepted as a scan (default: 3). */
  minLength?: number;
}

// A hardware scanner types its whole code in a machine-fast burst: consecutive
// keystrokes land only a few ms apart, far quicker than any human. We use the
// inter-key gap to tell the two apart.
const INTERKEY_MS = 40; // gap (ms) above which a keystroke looks human-typed
const RECOGNISE_FAST = 2; // fast gaps needed before a terminating Enter counts as a scan
const SWALLOW_AFTER = 3; // consecutive fast gaps before we keep keys out of focused fields

/**
 * Global barcode-wedge listener. A USB/Bluetooth barcode reader behaves like a
 * keyboard that types a code in a rapid burst ending with Enter. This hook
 * watches keystrokes anywhere on the page — regardless of which field (if any)
 * is focused — and fires `onScan` with the decoded value whenever it recognises
 * a scanner-speed burst. That makes "every barcode read while the screen is
 * open gets added" true even when focus has drifted off the scan box.
 *
 * Human typing is much slower than a scanner, so manual entry never trips the
 * detector — ordinary inputs, search boxes and forms keep working untouched.
 * Once a burst is confidently a scan its keys are swallowed so the digits never
 * leak into a focused field or submit a form. Keyboard shortcuts (Ctrl/Cmd/Alt)
 * and auto-repeat are ignored.
 */
export function useBarcodeScanner({ onScan, enabled = true, minLength = 3 }: ScannerOptions): void {
  const cb = useRef(onScan);
  cb.current = onScan;

  useEffect(() => {
    if (!enabled) return;
    let buffer = "";
    let lastTime = 0;
    let fast = 0; // consecutive scanner-speed gaps seen so far

    const reset = () => {
      buffer = "";
      fast = 0;
    };

    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return; // leave shortcuts alone
      if (e.repeat) return; // ignore held-key auto-repeat (not a scanner)

      const now = performance.now();
      const gap = now - lastTime;
      lastTime = now;

      if (e.key === "Enter") {
        if (buffer.length >= minLength && fast >= RECOGNISE_FAST) {
          // A completed scan — claim the Enter so no form submits / no double add.
          e.preventDefault();
          e.stopPropagation();
          const code = buffer;
          reset();
          cb.current(code);
        } else {
          reset(); // slow/short → leave Enter to behave normally (manual entry)
        }
        return;
      }

      if (e.key.length !== 1) return; // Shift, Tab, arrows… — not part of a code

      if (gap > INTERKEY_MS) {
        // Too slow to be the scanner: start a fresh detection window with this key.
        buffer = e.key;
        fast = 0;
        return;
      }
      buffer += e.key;
      fast += 1;
      if (fast >= SWALLOW_AFTER) {
        // Confident it's a scanner now — keep its keystrokes out of focused fields.
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [enabled, minLength]);
}

// ---- audible scan feedback -------------------------------------------------

let audioCtx: AudioContext | null = null;

/**
 * A short confirmation beep for a scan — high/short for a hit, low for a miss.
 * Best-effort: silently does nothing where Web Audio is unavailable or blocked.
 * The context is created lazily and resumed on use (the first cashier click
 * unlocks it under browser autoplay rules).
 */
export function playBeep(ok = true): void {
  try {
    if (typeof window === "undefined") return;
    const Ctx: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    const ctx = audioCtx;
    if (ctx.state === "suspended") void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = ok ? 880 : 200;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime;
    osc.start(t);
    osc.stop(t + (ok ? 0.06 : 0.14));
  } catch {
    /* audio unavailable — ignore */
  }
}
