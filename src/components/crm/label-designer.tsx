"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { apiFetch, apiUpload } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Select, Label } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { useT } from "@/lib/i18n/client";
import type { EntityRecord } from "@/lib/metadata/types";
import { LabelRenderer } from "./label-renderer";
import {
  blankTemplate,
  newElementId,
  parseElements,
  LABEL_FONTS,
  type LabelElement,
  type LabelElementType,
  type LabelField,
  type LabelTemplateDef,
} from "@/lib/labels/types";

const FALLBACK_PRODUCT = {
  id: "sample",
  name: "Sample Product",
  sku: "SAMPLE-001",
  barcode: "2000000010014",
  barcodeType: "ean13",
  unitPrice: 19.9,
  currencyCode: "USD",
  uom: "ea",
} as unknown as EntityRecord;

const FIELD_OPTIONS: { value: LabelField; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "sku", label: "SKU" },
  { value: "barcode", label: "Barcode value" },
  { value: "unitPrice", label: "Price" },
  { value: "costPrice", label: "Cost price" },
  { value: "uom", label: "Unit" },
  { value: "currencyCode", label: "Currency" },
];

function defaultElement(type: LabelElementType): LabelElement {
  const base = { id: newElementId(), x: 3, y: 3, type, color: "#000000" };
  switch (type) {
    case "text":
      return { ...base, w: 30, h: 6, text: "Text", fontSize: 10, align: "left" };
    case "field":
      return { ...base, w: 40, h: 6, field: "name", fontSize: 10, fontWeight: "bold", align: "left" };
    case "price":
      return { ...base, w: 30, h: 7, field: "unitPrice", fontSize: 12, fontWeight: "bold", align: "right" };
    case "barcode":
      return { ...base, w: 40, h: 14, field: "barcode", barcodeType: "auto", showValue: true };
    case "image":
      return { ...base, w: 18, h: 18, imageSource: "product", imageFit: "contain" };
    case "line":
      return { ...base, w: 40, h: 0.6 };
    case "rect":
      return { ...base, w: 30, h: 12, borderWidth: 0.3, borderColor: "#000000", background: "transparent", radius: 0 };
    default:
      return { ...base, w: 20, h: 6 };
  }
}

interface DragState {
  mode: "move" | "resize";
  id: string;
  startX: number;
  startY: number;
  ex: number;
  ey: number;
  ew: number;
  eh: number;
}

export function LabelDesigner() {
  const t = useT();
  const [templates, setTemplates] = useState<EntityRecord[]>([]);
  const [products, setProducts] = useState<EntityRecord[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [version, setVersion] = useState<number>(0);
  const [template, setTemplate] = useState<LabelTemplateDef>(() => blankTemplate());
  const [sampleId, setSampleId] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(4);
  const [busy, setBusy] = useState(false);

  const dragRef = useRef<DragState | null>(null);

  async function refreshTemplates() {
    const res = await apiFetch<{ items: EntityRecord[] }>("/entities/labelTemplate?pageSize=200");
    setTemplates(res.items);
    return res.items;
  }

  useEffect(() => {
    (async () => {
      try {
        const [, prod] = await Promise.all([
          refreshTemplates(),
          apiFetch<{ items: EntityRecord[] }>("/entities/product?pageSize=200"),
        ]);
        setProducts(prod.items);
        if (prod.items[0]) setSampleId(String(prod.items[0].id));
      } catch (e) {
        toast.error((e as Error).message);
      }
    })().catch(() => {});
  }, []);

  // ---- drag / resize ----
  useEffect(() => {
    function onMove(e: PointerEvent) {
      const d = dragRef.current;
      if (!d) return;
      const dxMm = (e.clientX - d.startX) / zoom;
      const dyMm = (e.clientY - d.startY) / zoom;
      const round = (n: number) => Math.round(n * 10) / 10;
      setTemplate((t) => ({
        ...t,
        elements: t.elements.map((el) => {
          if (el.id !== d.id) return el;
          if (d.mode === "move") {
            const x = Math.max(0, Math.min(round(d.ex + dxMm), t.widthMm - el.w));
            const y = Math.max(0, Math.min(round(d.ey + dyMm), t.heightMm - el.h));
            return { ...el, x, y };
          }
          const w = Math.max(2, Math.min(round(d.ew + dxMm), t.widthMm - el.x));
          const h = Math.max(el.type === "line" ? 0.3 : 2, Math.min(round(d.eh + dyMm), t.heightMm - el.y));
          return { ...el, w, h };
        }),
      }));
    }
    function onUp() {
      dragRef.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [zoom]);

  const selected = useMemo(() => template.elements.find((e) => e.id === selectedId) ?? null, [template, selectedId]);
  const sample = useMemo(() => products.find((p) => String(p.id) === sampleId) ?? FALLBACK_PRODUCT, [products, sampleId]);
  const pxPerMm = zoom;

  function updateElement(id: string, patch: Partial<LabelElement>) {
    setTemplate((t) => ({ ...t, elements: t.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)) }));
  }
  function addElement(type: LabelElementType) {
    const el = defaultElement(type);
    setTemplate((t) => ({ ...t, elements: [...t.elements, el] }));
    setSelectedId(el.id);
  }
  function removeElement(id: string) {
    setTemplate((t) => ({ ...t, elements: t.elements.filter((el) => el.id !== id) }));
    if (selectedId === id) setSelectedId(null);
  }

  function startDrag(e: React.PointerEvent, el: LabelElement, mode: "move" | "resize") {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(el.id);
    dragRef.current = { mode, id: el.id, startX: e.clientX, startY: e.clientY, ex: el.x, ey: el.y, ew: el.w, eh: el.h };
  }

  function loadTemplate(id: string) {
    const rec = templates.find((t) => String(t.id) === id);
    if (!rec) return;
    setCurrentId(id);
    setVersion(typeof rec.version === "number" ? rec.version : 0);
    setTemplate({
      id,
      name: String(rec.name ?? "Label"),
      widthMm: Number(rec.widthMm ?? 50),
      heightMm: Number(rec.heightMm ?? 30),
      dpi: Number(rec.dpi ?? 300),
      elements: parseElements(rec.elements),
    });
    setSelectedId(null);
  }

  function newTemplate() {
    setCurrentId(null);
    setVersion(0);
    setTemplate(blankTemplate());
    setSelectedId(null);
  }

  async function save() {
    if (!template.name.trim()) {
      toast.error("Name the template");
      return;
    }
    setBusy(true);
    try {
      const body = {
        name: template.name,
        widthMm: template.widthMm,
        heightMm: template.heightMm,
        dpi: template.dpi ?? 300,
        elements: JSON.stringify(template.elements),
        active: true,
      };
      if (currentId) {
        await apiFetch(`/entities/labelTemplate/${currentId}`, { method: "PATCH", body, headers: { "If-Match": String(version) } });
        toast.success("Template saved");
      } else {
        const created = await apiFetch<EntityRecord>("/entities/labelTemplate", { method: "POST", body });
        setCurrentId(String(created.id));
        toast.success("Template created");
      }
      const items = await refreshTemplates();
      const fresh = items.find((t) => String(t.id) === currentId);
      if (fresh && typeof fresh.version === "number") setVersion(fresh.version);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!currentId) return;
    if (!confirm("Delete this template?")) return;
    setBusy(true);
    try {
      await apiFetch(`/entities/labelTemplate/${currentId}`, { method: "DELETE", headers: { "If-Match": String(version) } });
      toast.success("Template deleted");
      newTemplate();
      await refreshTemplates();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">{t("label.dTitle")}</h1>
          <p className="text-xs text-muted">{t("label.dSubtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={currentId ?? ""} onChange={(e) => (e.target.value ? loadTemplate(e.target.value) : newTemplate())} className="w-48">
            <option value="">{t("label.newTemplate")}</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {String(t.name)}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="ghost" onClick={newTemplate}>
            <Icon name="plus" className="h-3.5 w-3.5" /> {t("common.new")}
          </Button>
          {currentId && (
            <Button size="sm" variant="ghost" onClick={del} disabled={busy}>
              <Icon name="trash" className="h-3.5 w-3.5" /> {t("common.delete")}
            </Button>
          )}
          <Button size="sm" variant="primary" onClick={save} loading={busy}>
            {t("common.save")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[180px_1fr_280px]">
        {/* palette */}
        <Card>
          <CardHeader title={t("label.add")} />
          <CardBody className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            {([
              ["barcode", "barcode", "Barcode"],
              ["field", "edit", "Field"],
              ["price", "wallet", "Price"],
              ["text", "note", "Text"],
              ["image", "file", "Image"],
              ["line", "minus", "Line"],
              ["rect", "square", "Box"],
            ] as [LabelElementType, string, string][]).map(([type, icon, label]) => (
              <Button key={type} size="sm" variant="ghost" className="justify-start" onClick={() => addElement(type)}>
                <Icon name={icon} className="h-3.5 w-3.5" /> {label}
              </Button>
            ))}
          </CardBody>
        </Card>

        {/* canvas */}
        <Card>
          <CardHeader
            title={t("label.canvas")}
            action={
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted">{t("label.sample")}</span>
                <Select value={sampleId} onChange={(e) => setSampleId(e.target.value)} className="h-7 w-40 text-xs">
                  <option value="">Sample product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {String(p.name)}
                    </option>
                  ))}
                </Select>
                <button className="rounded border border-border px-1.5" onClick={() => setZoom((z) => Math.max(2, z - 1))}>
                  −
                </button>
                <span>{zoom}×</span>
                <button className="rounded border border-border px-1.5" onClick={() => setZoom((z) => Math.min(10, z + 1))}>
                  +
                </button>
              </div>
            }
          />
          <CardBody>
            <div className="flex justify-center overflow-auto rounded-lg bg-[repeating-conic-gradient(#f3f4f6_0%_25%,#fff_0%_50%)] [background-size:16px_16px] p-6">
              <div
                className="relative shadow-md ring-1 ring-border"
                style={{ width: template.widthMm * pxPerMm, height: template.heightMm * pxPerMm }}
                onPointerDown={() => setSelectedId(null)}
              >
                <LabelRenderer template={template} product={sample} pxPerMm={pxPerMm} style={{ pointerEvents: "none" }} />
                {/* interaction overlay */}
                {template.elements.map((el) => {
                  const isSel = el.id === selectedId;
                  return (
                    <div
                      key={el.id}
                      onPointerDown={(e) => startDrag(e, el, "move")}
                      style={{
                        position: "absolute",
                        left: el.x * pxPerMm,
                        top: el.y * pxPerMm,
                        width: el.w * pxPerMm,
                        height: el.h * pxPerMm,
                        cursor: "move",
                        outline: isSel ? "1.5px solid #2563eb" : "1px dashed rgba(37,99,235,0.4)",
                        background: isSel ? "rgba(37,99,235,0.06)" : "transparent",
                      }}
                    >
                      {isSel && (
                        <div
                          onPointerDown={(e) => startDrag(e, el, "resize")}
                          style={{
                            position: "absolute",
                            right: -5,
                            bottom: -5,
                            width: 10,
                            height: 10,
                            background: "#2563eb",
                            borderRadius: 2,
                            cursor: "nwse-resize",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="mt-2 text-center text-xs text-muted">
              {template.widthMm} × {template.heightMm} mm · {template.elements.length} elements
            </p>
          </CardBody>
        </Card>

        {/* properties */}
        <Card>
          <CardHeader title={selected ? t("label.element") : t("label.label")} />
          <CardBody className="space-y-3">
            {!selected ? (
              <>
                <div>
                  <Label htmlFor="tname">Template name</Label>
                  <Input id="tname" value={template.name} onChange={(e) => setTemplate((t) => ({ ...t, name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="w">Width (mm)</Label>
                    <Input id="w" type="number" value={template.widthMm} onChange={(e) => setTemplate((t) => ({ ...t, widthMm: Number(e.target.value) || 1 }))} />
                  </div>
                  <div>
                    <Label htmlFor="h">Height (mm)</Label>
                    <Input id="h" type="number" value={template.heightMm} onChange={(e) => setTemplate((t) => ({ ...t, heightMm: Number(e.target.value) || 1 }))} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="preset">Preset size</Label>
                  <Select
                    id="preset"
                    onChange={(e) => {
                      const [w, h] = e.target.value.split("x").map(Number);
                      if (w && h) setTemplate((t) => ({ ...t, widthMm: w, heightMm: h }));
                    }}
                    value=""
                  >
                    <option value="">Choose…</option>
                    <option value="40x30">40 × 30 mm (thermal)</option>
                    <option value="50x30">50 × 30 mm (thermal)</option>
                    <option value="58x40">58 × 40 mm (thermal)</option>
                    <option value="100x50">100 × 50 mm (shipping)</option>
                    <option value="63.5x38.1">63.5 × 38.1 mm (A4 sheet)</option>
                  </Select>
                </div>
                <p className="text-xs text-muted">Select an element on the canvas to edit it, or add one from the palette.</p>
              </>
            ) : (
              <ElementProps el={selected} onChange={(patch) => updateElement(selected.id, patch)} onRemove={() => removeElement(selected.id)} />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function ColorField({ label, value, fallback = "#000000", onChange }: { label: string; value?: string; fallback?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type="color"
        value={value && value !== "transparent" ? value : fallback}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full cursor-pointer rounded-lg border border-border-strong bg-surface/60 p-1"
      />
    </div>
  );
}

const SectionTitle = ({ children }: { children: ReactNode }) => (
  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-2">{children}</p>
);

function ElementProps({ el, onChange, onRemove }: { el: LabelElement; onChange: (p: Partial<LabelElement>) => void; onRemove: () => void }) {
  const [uploading, setUploading] = useState(false);
  const num = (v: string) => Number(v) || 0;
  const isText = el.type === "text";
  const isFieldBound = el.type === "field" || el.type === "price" || el.type === "barcode";
  const hasFont = el.type === "text" || el.type === "field" || el.type === "price";
  const isBarcode = el.type === "barcode";
  const isImage = el.type === "image";
  const isRect = el.type === "rect";
  const isLine = el.type === "line";
  const hasAffix = el.type === "field" || el.type === "price" || el.type === "text";
  const bgOn = !!el.background && el.background !== "transparent";

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("folder", "media");
      form.append("file", file);
      const rec = await apiUpload<{ id: string }>("/files/upload", form);
      onChange({ imageSource: "static", imageId: String(rec.id) });
      toast.success("Image uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase text-muted">{el.type}</span>
        <button onClick={onRemove} className="text-muted hover:text-danger" aria-label="Remove element">
          <Icon name="trash" className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ---- content ---- */}
      {isText && (
        <div>
          <Label htmlFor="text">Text</Label>
          <Input id="text" value={el.text ?? ""} onChange={(e) => onChange({ text: e.target.value })} />
        </div>
      )}

      {isFieldBound && (
        <div>
          <Label htmlFor="field">{isBarcode ? "Value field" : "Field"}</Label>
          <Select id="field" value={el.field ?? "name"} onChange={(e) => onChange({ field: e.target.value as LabelField })}>
            {FIELD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      )}

      {hasAffix && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="prefix">Prefix</Label>
            <Input id="prefix" value={el.prefix ?? ""} onChange={(e) => onChange({ prefix: e.target.value })} placeholder="e.g. ₺" />
          </div>
          <div>
            <Label htmlFor="suffix">Suffix</Label>
            <Input id="suffix" value={el.suffix ?? ""} onChange={(e) => onChange({ suffix: e.target.value })} placeholder="e.g. /ad" />
          </div>
        </div>
      )}

      {isBarcode && (
        <>
          <div>
            <Label htmlFor="bt">Symbology</Label>
            <Select id="bt" value={el.barcodeType ?? "auto"} onChange={(e) => onChange({ barcodeType: e.target.value as LabelElement["barcodeType"] })}>
              <option value="auto">Auto (from product)</option>
              <option value="ean13">EAN-13</option>
              <option value="upc">UPC-A</option>
              <option value="code128">Code 128</option>
              <option value="qr">QR Code</option>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={el.showValue ?? true} onChange={(e) => onChange({ showValue: e.target.checked })} />
            Show value
          </label>
        </>
      )}

      {isImage && (
        <>
          <div>
            <Label htmlFor="imgsrc">Image source</Label>
            <Select id="imgsrc" value={el.imageSource ?? "product"} onChange={(e) => onChange({ imageSource: e.target.value as "product" | "static" })}>
              <option value="product">Product image</option>
              <option value="static">Uploaded image</option>
            </Select>
          </div>
          {(el.imageSource ?? "product") === "static" && (
            <div>
              <Label>Image file</Label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadImage(f);
                }}
                className="block w-full text-xs"
              />
              {uploading && <p className="mt-1 text-xs text-muted">Uploading…</p>}
              {!uploading && el.imageId && <p className="mt-1 text-xs text-muted">Selected image #{el.imageId}</p>}
            </div>
          )}
          <div>
            <Label htmlFor="fit">Fit</Label>
            <Select id="fit" value={el.imageFit ?? "contain"} onChange={(e) => onChange({ imageFit: e.target.value as "contain" | "cover" | "fill" })}>
              <option value="contain">Contain</option>
              <option value="cover">Cover</option>
              <option value="fill">Fill</option>
            </Select>
          </div>
        </>
      )}

      {/* ---- typography ---- */}
      {hasFont && (
        <>
          <SectionTitle>Typography</SectionTitle>
          <div>
            <Label htmlFor="ff">Font</Label>
            <Select id="ff" value={el.fontFamily ?? LABEL_FONTS[0].value} onChange={(e) => onChange({ fontFamily: e.target.value })}>
              {LABEL_FONTS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="fs">Size (pt)</Label>
              <Input id="fs" type="number" value={el.fontSize ?? 10} onChange={(e) => onChange({ fontSize: num(e.target.value) })} />
            </div>
            <div>
              <Label htmlFor="fw">Weight</Label>
              <Select id="fw" value={el.fontWeight ?? "normal"} onChange={(e) => onChange({ fontWeight: e.target.value as "normal" | "bold" })}>
                <option value="normal">Normal</option>
                <option value="bold">Bold</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="fst">Style</Label>
              <Select id="fst" value={el.fontStyle ?? "normal"} onChange={(e) => onChange({ fontStyle: e.target.value as "normal" | "italic" })}>
                <option value="normal">Normal</option>
                <option value="italic">Italic</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="al">Align</Label>
              <Select id="al" value={el.align ?? "left"} onChange={(e) => onChange({ align: e.target.value as "left" | "center" | "right" })}>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="lh">Line height</Label>
              <Input id="lh" type="number" step="0.1" value={el.lineHeight ?? 1.1} onChange={(e) => onChange({ lineHeight: Number(e.target.value) || 1.1 })} />
            </div>
            <div>
              <Label htmlFor="ls">Letter sp. (mm)</Label>
              <Input id="ls" type="number" step="0.1" value={el.letterSpacing ?? 0} onChange={(e) => onChange({ letterSpacing: num(e.target.value) })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={el.wrap ?? false} onChange={(e) => onChange({ wrap: e.target.checked })} />
            Wrap text
          </label>
        </>
      )}

      {/* ---- appearance ---- */}
      <SectionTitle>Appearance</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {!isImage && (
          <ColorField
            label={isLine || isRect ? "Color" : "Text color"}
            value={el.color}
            onChange={(v) => onChange({ color: v })}
          />
        )}
        {!isLine && (
          <div>
            <Label>Background</Label>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={bgOn}
                onChange={(e) => onChange({ background: e.target.checked ? "#ffffff" : "transparent" })}
                aria-label="Background fill"
              />
              {bgOn && (
                <input
                  type="color"
                  value={el.background ?? "#ffffff"}
                  onChange={(e) => onChange({ background: e.target.value })}
                  className="h-8 w-full cursor-pointer rounded-md border border-border-strong p-0.5"
                />
              )}
            </div>
          </div>
        )}
        {!isLine && (
          <div>
            <Label htmlFor="bw">Border (mm)</Label>
            <Input id="bw" type="number" step="0.1" value={el.borderWidth ?? 0} onChange={(e) => onChange({ borderWidth: num(e.target.value) })} />
          </div>
        )}
        {!isLine && (el.borderWidth ?? 0) > 0 && (
          <ColorField label="Border color" value={el.borderColor} onChange={(v) => onChange({ borderColor: v })} />
        )}
        {(isRect || isImage) && (
          <div>
            <Label htmlFor="rad">Radius (mm)</Label>
            <Input id="rad" type="number" step="0.1" value={el.radius ?? 0} onChange={(e) => onChange({ radius: num(e.target.value) })} />
          </div>
        )}
        <div>
          <Label htmlFor="rot">Rotation (°)</Label>
          <Select id="rot" value={String(el.rotation ?? 0)} onChange={(e) => onChange({ rotation: Number(e.target.value) })}>
            <option value="0">0</option>
            <option value="90">90</option>
            <option value="180">180</option>
            <option value="270">270</option>
          </Select>
        </div>
      </div>

      {/* ---- geometry ---- */}
      <SectionTitle>Position &amp; size</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="x">X (mm)</Label>
          <Input id="x" type="number" value={el.x} onChange={(e) => onChange({ x: num(e.target.value) })} />
        </div>
        <div>
          <Label htmlFor="y">Y (mm)</Label>
          <Input id="y" type="number" value={el.y} onChange={(e) => onChange({ y: num(e.target.value) })} />
        </div>
        <div>
          <Label htmlFor="ew">W (mm)</Label>
          <Input id="ew" type="number" value={el.w} onChange={(e) => onChange({ w: num(e.target.value) })} />
        </div>
        <div>
          <Label htmlFor="eh">H (mm)</Label>
          <Input id="eh" type="number" value={el.h} onChange={(e) => onChange({ h: num(e.target.value) })} />
        </div>
      </div>
    </div>
  );
}
