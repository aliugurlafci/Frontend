/**
 * Barcode scan-equivalence helpers — shared verbatim with the backend
 * (`Backend/src/lib/barcode/check-digit.ts`) and the mobile app so all three
 * resolve a scan to a product identically. The retail GS1 symbologies encode the
 * same GTIN at different lengths (UPC-A 12, EAN-13 13, UPC-E 8), and a scanner
 * may report either form depending on the platform, so a robust lookup must try
 * every equivalent representation rather than an exact string match.
 */
export type BarcodeType = "ean13" | "upc" | "code128" | "qr";

const digitsOnly = (s: string): boolean => /^[0-9]+$/.test(s);

/** Modulo-10 GS1 check digit (3-1-3-1… right-to-left over the payload). */
function gtinCheckDigit(payload: string): number {
  let sum = 0;
  for (let i = payload.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) {
    sum += Number(payload[i]) * w;
  }
  return (10 - (sum % 10)) % 10;
}

/** Normalise a scanned code: trim surrounding whitespace. */
export function normalizeScan(raw: string): string {
  return (raw ?? "").trim();
}

/** Expand an 8-digit UPC-E (number-system + 6 data + check) to its UPC-A form. */
function expandUpcE(value: string): string | null {
  if (value.length !== 8 || !digitsOnly(value)) return null;
  const ns = value[0];
  if (ns !== "0" && ns !== "1") return null;
  const d = value.slice(1, 7);
  const last = d[5];
  let body: string;
  switch (last) {
    case "0":
    case "1":
    case "2":
      body = d.slice(0, 2) + last + "0000" + d.slice(2, 5);
      break;
    case "3":
      body = d.slice(0, 3) + "00000" + d.slice(3, 5);
      break;
    case "4":
      body = d.slice(0, 4) + "00000" + d.slice(4, 5);
      break;
    default:
      body = d.slice(0, 5) + "0000" + last;
      break;
  }
  const payload11 = ns + body;
  if (payload11.length !== 11) return null;
  return payload11 + String(gtinCheckDigit(payload11));
}

/** Equivalent representations of a scanned code, most-specific first. */
export function barcodeCandidates(raw: string): string[] {
  const c = normalizeScan(raw);
  if (!c) return [];
  const out: string[] = [c];
  const add = (v: string | null | undefined): void => {
    if (v && !out.includes(v)) out.push(v);
  };
  if (digitsOnly(c)) {
    if (c.length === 12) add("0" + c);
    if (c.length === 13 && c[0] === "0") add(c.slice(1));
    if (c.length === 14 && c[0] === "0") add(c.slice(1));
    if (c.length === 8) {
      const upcA = expandUpcE(c);
      if (upcA) {
        add(upcA);
        add("0" + upcA);
      }
    }
  }
  return out;
}
