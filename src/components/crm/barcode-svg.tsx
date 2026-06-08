"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { QRCodeSVG } from "qrcode.react";
import type { EntityRecord } from "@/lib/metadata/types";

export type BarcodeType = "ean13" | "upc" | "code128" | "qr";

const FORMAT: Record<Exclude<BarcodeType, "qr">, string> = {
  ean13: "EAN13",
  upc: "UPC",
  code128: "CODE128",
};

/**
 * Renders any of the four supported symbologies into an inline SVG.
 * 1-D codes go through jsbarcode; QR through qrcode.react. If the value is
 * invalid for the declared 1-D symbology we fall back to Code 128 so the label
 * never renders blank.
 */
export function BarcodeSvg({
  value,
  type = "code128",
  height = 60,
  width = 2,
  fontSize = 14,
  displayValue = true,
  margin = 4,
  lineColor = "#000000",
  background = "transparent",
  className,
}: {
  value: string;
  type?: BarcodeType;
  height?: number;
  width?: number;
  fontSize?: number;
  displayValue?: boolean;
  margin?: number;
  /** Bar / module colour (and the QR foreground). */
  lineColor?: string;
  /** Quiet-zone background colour. */
  background?: string;
  className?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (type === "qr" || !ref.current) return;
    const el = ref.current;
    const render = (format: string) =>
      JsBarcode(el, value || " ", { format, height, width, fontSize, displayValue, margin, lineColor, background });
    try {
      render(FORMAT[type]);
    } catch {
      try {
        render("CODE128"); // graceful fallback for an invalid EAN/UPC value
      } catch {
        el.innerHTML = "";
      }
    }
  }, [value, type, height, width, fontSize, displayValue, margin, lineColor, background]);

  if (type === "qr") {
    return (
      <QRCodeSVG
        value={value || " "}
        size={height}
        marginSize={1}
        fgColor={lineColor}
        bgColor={background === "transparent" ? "#ffffff" : background}
        className={className}
      />
    );
  }
  return <svg ref={ref} className={className} aria-label={`barcode ${value}`} />;
}

/**
 * Resolve the barcode to print for a product: its own barcode value+type,
 * else its SKU (or id) rendered as Code 128 so every product is still scannable.
 */
export function resolveProductBarcode(p: EntityRecord): { value: string; type: BarcodeType } {
  const own = String(p.barcode ?? "").trim();
  if (own) return { value: own, type: (String(p.barcodeType ?? "code128") as BarcodeType) || "code128" };
  const fallback = String(p.sku ?? "").trim() || String(p.id ?? "");
  return { value: fallback, type: "code128" };
}
