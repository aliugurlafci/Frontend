/**
 * Client-side product matching for the scan/search boxes (POS, Cart, register
 * queue).
 *
 * These screens hold the whole catalogue in memory and filter it on every
 * keystroke. Building `name + sku + barcode` and lower-casing it per product per
 * keystroke means the same strings are rebuilt thousands of times for a five-
 * character search, so the haystack is prepared once per catalogue instead and
 * reused for every subsequent term.
 */
import type { EntityRecord } from "@/lib/metadata/types";

export interface ProductIndex {
  /** The catalogue, in its original order. */
  items: EntityRecord[];
  /** `items[i]`'s searchable text, lower-cased. */
  haystack: string[];
}

/** Prepare the search text once for a catalogue (memoize on the products array). */
export function buildProductIndex(products: EntityRecord[]): ProductIndex {
  const haystack = new Array<string>(products.length);
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    haystack[i] = `${p.name ?? ""} ${p.sku ?? ""} ${p.barcode ?? ""}`.toLowerCase();
  }
  return { items: products, haystack };
}

/**
 * Products whose name / SKU / barcode contains `term`. An empty term yields
 * `whenEmpty` (the full catalogue for a browse list, nothing for a scan box), and
 * `limit` stops the scan early — a picker only ever renders the first handful.
 */
export function searchProductIndex(
  index: ProductIndex,
  term: string,
  { limit, whenEmpty = "all" }: { limit?: number; whenEmpty?: "all" | "none" } = {},
): EntityRecord[] {
  const q = term.trim().toLowerCase();
  if (!q) return whenEmpty === "all" ? index.items : [];
  const out: EntityRecord[] = [];
  const { items, haystack } = index;
  for (let i = 0; i < items.length; i++) {
    if (!haystack[i].includes(q)) continue;
    out.push(items[i]);
    if (limit !== undefined && out.length >= limit) break;
  }
  return out;
}
