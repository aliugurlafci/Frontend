"use client";

import type { CSSProperties } from "react";
import type { EntityRecord } from "@/lib/metadata/types";
import { formatMoney } from "@/lib/finance/money";
import { BarcodeSvg, resolveProductBarcode, type BarcodeType } from "./barcode-svg";
import {
  PRINT_PX_PER_MM,
  PT_TO_MM,
  type LabelElement,
  type LabelField,
  type LabelTemplateDef,
} from "@/lib/labels/types";

function fieldValue(field: LabelField | undefined, product: EntityRecord): string {
  switch (field) {
    case "name":
      return String(product.name ?? "");
    case "sku":
      return String(product.sku ?? "");
    case "barcode":
      return String(product.barcode ?? product.sku ?? "");
    case "uom":
      return String(product.uom ?? "");
    case "currencyCode":
      return String(product.currencyCode ?? "");
    case "costPrice":
      return formatMoney(Number(product.costPrice ?? 0), String(product.currencyCode ?? "USD"));
    case "unitPrice":
      return formatMoney(Number(product.unitPrice ?? 0), String(product.currencyCode ?? "USD"));
    default:
      return "";
  }
}

function barcodeFor(el: LabelElement, product: EntityRecord): { value: string; type: BarcodeType } {
  if (el.barcodeType && el.barcodeType !== "auto") {
    return { value: String(product.barcode ?? product.sku ?? ""), type: el.barcodeType };
  }
  return resolveProductBarcode(product);
}

const justify = (align?: string) => (align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start");

/** Image url for a label image element (static file or the product's own image). */
function imageUrl(el: LabelElement, product: EntityRecord): string | null {
  const id = el.imageSource === "static" ? String(el.imageId ?? "") : String(product.imageId ?? "");
  return id ? `/api/v1/files/${encodeURIComponent(id)}/download?inline=1` : null;
}

function ElementView({ el, product, pxPerMm }: { el: LabelElement; product: EntityRecord; pxPerMm: number }) {
  // Shared geometry + frame (border / background / rotation) for every element.
  const frame: CSSProperties = {
    position: "absolute",
    left: el.x * pxPerMm,
    top: el.y * pxPerMm,
    width: el.w * pxPerMm,
    height: el.h * pxPerMm,
    overflow: "hidden",
    background: el.background ?? "transparent",
    borderRadius: el.radius ? el.radius * pxPerMm : undefined,
    border: el.borderWidth ? `${Math.max(1, el.borderWidth * pxPerMm)}px solid ${el.borderColor ?? "#000"}` : undefined,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
    transformOrigin: "center center",
    boxSizing: "border-box",
  };

  const fontPx = (el.fontSize ?? 10) * PT_TO_MM * pxPerMm;
  const renderText = (raw: string) => {
    const value = `${el.prefix ?? ""}${raw}${el.suffix ?? ""}`;
    return (
      <div style={{ ...frame, display: "flex", alignItems: "center", justifyContent: justify(el.align) }}>
        <span
          style={{
            display: "block",
            width: "100%",
            fontSize: fontPx,
            fontFamily: el.fontFamily,
            fontWeight: el.fontWeight ?? "normal",
            fontStyle: el.fontStyle ?? "normal",
            textAlign: el.align ?? "left",
            color: el.color ?? "#000",
            lineHeight: el.lineHeight ?? 1.1,
            letterSpacing: el.letterSpacing ? el.letterSpacing * pxPerMm : undefined,
            whiteSpace: el.wrap ? "normal" : "nowrap",
            overflow: "hidden",
            textOverflow: "clip",
          }}
        >
          {value}
        </span>
      </div>
    );
  };

  switch (el.type) {
    case "text":
      return renderText(el.text ?? "");
    case "field":
      return renderText(fieldValue(el.field, product));
    case "price":
      return renderText(fieldValue(el.field ?? "unitPrice", product));
    case "rect":
      return (
        <div
          style={{
            ...frame,
            background: el.background ?? "transparent",
            border: `${Math.max(1, (el.borderWidth ?? 0.3) * pxPerMm)}px solid ${el.borderColor ?? el.color ?? "#000"}`,
          }}
        />
      );
    case "line":
      return <div style={{ ...frame, background: el.color ?? el.background ?? "#000", border: undefined }} />;
    case "image": {
      const url = imageUrl(el, product);
      if (!url) return <div style={{ ...frame, border: frame.border ?? "1px dashed #bbb" }} />;
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={url} alt="" style={{ ...frame, objectFit: el.imageFit ?? "contain" }} />;
    }
    case "barcode": {
      const { value, type } = barcodeFor(el, product);
      const showValue = el.showValue ?? true;
      const barHeight = Math.max(10, el.h * pxPerMm - (showValue ? fontPx + 2 : 2));
      return (
        <div style={{ ...frame, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <BarcodeSvg
            value={value}
            type={type}
            height={type === "qr" ? Math.min(el.w, el.h) * pxPerMm : barHeight}
            width={1.4}
            fontSize={Math.max(8, fontPx)}
            displayValue={showValue && type !== "qr"}
            margin={0}
            lineColor={el.color ?? "#000000"}
            background={el.background ?? "transparent"}
            className="max-h-full max-w-full"
          />
        </div>
      );
    }
    default:
      return null;
  }
}

/**
 * Render a label template populated with a product onto an absolutely-positioned,
 * mm-scaled white card. Used by the designer canvas (high `pxPerMm` for zoom),
 * the print sheet (physical mm), and the POS receipt.
 */
export function LabelRenderer({
  template,
  product,
  pxPerMm = PRINT_PX_PER_MM,
  className,
  style,
}: {
  template: LabelTemplateDef;
  product: EntityRecord;
  pxPerMm?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: template.widthMm * pxPerMm,
        height: template.heightMm * pxPerMm,
        background: "#fff",
        overflow: "hidden",
        ...style,
      }}
    >
      {template.elements.map((el) => (
        <ElementView key={el.id} el={el} product={product} pxPerMm={pxPerMm} />
      ))}
    </div>
  );
}
