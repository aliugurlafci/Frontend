/**
 * Barcode-label template model. Geometry is stored in millimetres so the same
 * template renders identically in the designer (zoomed) and on the print sheet
 * (physical). The LabelRenderer scales everything by a single `pxPerMm`.
 */
import type { BarcodeType } from "@/components/crm/barcode-svg";

export type LabelElementType = "barcode" | "text" | "field" | "price" | "image" | "line" | "rect";

/** A product field a `field`/`price`/`barcode` element can bind to. */
export type LabelField = "name" | "sku" | "barcode" | "unitPrice" | "costPrice" | "uom" | "currencyCode";

export interface LabelElement {
  id: string;
  type: LabelElementType;
  /** Position + size in millimetres, from the label's top-left. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Bound product field (field / price / barcode value source). */
  field?: LabelField;
  /** Literal text for `text` elements. */
  text?: string;
  /** Symbology for `barcode` elements; "auto" derives it from the product. */
  barcodeType?: BarcodeType | "auto";
  /** Font size in points (text / field / price). */
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  align?: "left" | "center" | "right";
  /** Barcode: render the human-readable value beneath the bars. */
  showValue?: boolean;

  // ---- rich styling (all optional, default to a clean black-on-white label) ----
  /** Text / barcode-bars / line / rect foreground colour. */
  color?: string;
  /** Element background fill (default transparent). */
  background?: string;
  /** Border width in mm (0 = none) + colour. */
  borderWidth?: number;
  borderColor?: string;
  /** Corner radius in mm (rect / image / background). */
  radius?: number;
  fontFamily?: string;
  fontStyle?: "normal" | "italic";
  /** Line height multiplier and letter spacing (mm) for text. */
  lineHeight?: number;
  letterSpacing?: number;
  /** Allow text to wrap instead of clipping on one line. */
  wrap?: boolean;
  /** Rotate the element (degrees). */
  rotation?: number;
  /** Text affixes for field / price (e.g. "₺" prefix, " /ad" suffix). */
  prefix?: string;
  suffix?: string;
  /** Image source: the product's own image, or a chosen/uploaded static file. */
  imageSource?: "product" | "static";
  /** File id for a static image (imageSource = "static"). */
  imageId?: string;
  /** How an image fits its box. */
  imageFit?: "contain" | "cover" | "fill";
}

/** Print-safe font families offered in the designer. */
export const LABEL_FONTS: { value: string; label: string }[] = [
  { value: "Arial, Helvetica, sans-serif", label: "Arial / Helvetica" },
  { value: "'Segoe UI', system-ui, sans-serif", label: "Segoe UI" },
  { value: "'Times New Roman', Times, serif", label: "Times New Roman" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "'Courier New', monospace", label: "Courier New (mono)" },
  { value: "Verdana, Geneva, sans-serif", label: "Verdana" },
  { value: "Tahoma, sans-serif", label: "Tahoma" },
];

export interface LabelTemplateDef {
  id?: string;
  name: string;
  widthMm: number;
  heightMm: number;
  dpi?: number;
  elements: LabelElement[];
}

/** CSS pixels per millimetre at the 96-dpi reference used for print. */
export const PRINT_PX_PER_MM = 96 / 25.4;
/** Points → millimetres (for font sizing). */
export const PT_TO_MM = 25.4 / 72;

/** Parse the persisted `elements` JSON text into a typed array (defensive). */
export function parseElements(raw: unknown): LabelElement[] {
  if (Array.isArray(raw)) return raw as LabelElement[];
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LabelElement[]) : [];
  } catch {
    return [];
  }
}

let seq = 0;
export function newElementId(): string {
  seq += 1;
  return `el_${seq}_${Math.round(seq * 2654435761) % 100000}`;
}

/** A starter template for the "New" action. */
export function blankTemplate(): LabelTemplateDef {
  return {
    name: "New label",
    widthMm: 50,
    heightMm: 30,
    dpi: 300,
    elements: [
      { id: newElementId(), type: "field", field: "name", x: 2, y: 2, w: 46, h: 6, fontSize: 9, fontWeight: "bold", align: "left" },
      { id: newElementId(), type: "barcode", field: "barcode", barcodeType: "auto", x: 4, y: 9, w: 42, h: 13, showValue: true },
      { id: newElementId(), type: "price", field: "unitPrice", x: 2, y: 23, w: 46, h: 6, fontSize: 11, fontWeight: "bold", align: "right" },
    ],
  };
}

/** Whether a template id refers to a built-in (non-persisted) template. */
export const isBuiltinTemplateId = (id: string | null | undefined): boolean => !!id && id.startsWith("builtin-");

/**
 * Built-in, always-available templates (name + barcode + price) so the print
 * screen works out of the box before any custom template is saved. Stable
 * `builtin-*` ids mark them so they are never PATCHed/deleted as DB records.
 */
export function builtinTemplates(): LabelTemplateDef[] {
  const make = (id: string, name: string, w: number, h: number): LabelTemplateDef => {
    const pad = 2;
    const inner = w - pad * 2;
    return {
      id,
      name,
      widthMm: w,
      heightMm: h,
      dpi: 300,
      elements: [
        { id: `${id}-name`, type: "field", field: "name", x: pad, y: pad, w: inner, h: 5, fontSize: 8, fontWeight: "bold", align: "left" },
        { id: `${id}-bc`, type: "barcode", field: "barcode", barcodeType: "auto", x: pad + 1, y: h * 0.32, w: inner - 2, h: h * 0.42, showValue: true },
        { id: `${id}-sku`, type: "field", field: "sku", x: pad, y: h - 6, w: inner * 0.5, h: 5, fontSize: 7, align: "left" },
        { id: `${id}-price`, type: "price", field: "unitPrice", x: pad + inner * 0.5, y: h - 6.5, w: inner * 0.5, h: 6, fontSize: 11, fontWeight: "bold", align: "right" },
      ],
    };
  };
  return [
    make("builtin-50x30", "Standard 50 × 30 mm", 50, 30),
    make("builtin-40x30", "Compact 40 × 30 mm", 40, 30),
    make("builtin-58x40", "Large 58 × 40 mm", 58, 40),
  ];
}
