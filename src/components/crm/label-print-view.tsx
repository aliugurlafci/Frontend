"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Select, Label } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { useT } from "@/lib/i18n/client";
import type { EntityRecord } from "@/lib/metadata/types";
import { LabelRenderer } from "./label-renderer";
import { PRINT_PX_PER_MM, parseElements, builtinTemplates, isBuiltinTemplateId, type LabelTemplateDef } from "@/lib/labels/types";

type Layout = "thermal" | "a4";

export function LabelPrintView({
  initialProductId,
  initialTemplateId,
}: {
  initialProductId?: string;
  initialTemplateId?: string;
}) {
  const t = useT();
  const [templates, setTemplates] = useState<EntityRecord[]>([]);
  const [products, setProducts] = useState<EntityRecord[]>([]);
  const [templateId, setTemplateId] = useState<string>(initialTemplateId ?? "");
  const [qtyByProduct, setQtyByProduct] = useState<Record<string, number>>(initialProductId ? { [initialProductId]: 1 } : {});
  const [layout, setLayout] = useState<Layout>("a4");
  const [marginMm, setMarginMm] = useState(8);
  const [gapMm, setGapMm] = useState(2);
  const [search, setSearch] = useState("");

  const builtins = useMemo(() => builtinTemplates(), []);

  useEffect(() => {
    (async () => {
      try {
        const [tpl, prod] = await Promise.all([
          apiFetch<{ items: EntityRecord[] }>("/entities/labelTemplate?pageSize=200"),
          apiFetch<{ items: EntityRecord[] }>("/entities/product?pageSize=500"),
        ]);
        setTemplates(tpl.items);
        setProducts(prod.items);
        // Default to a saved template if one exists, otherwise a built-in so the
        // screen renders labels immediately (no "design one first" dead end).
        if (!initialTemplateId) setTemplateId(tpl.items[0] ? String(tpl.items[0].id) : "builtin-50x30");
      } catch (e) {
        toast.error((e as Error).message);
      }
    })().catch(() => {});
  }, [initialTemplateId]);

  const template: LabelTemplateDef | null = useMemo(() => {
    if (isBuiltinTemplateId(templateId)) return builtins.find((b) => b.id === templateId) ?? null;
    const rec = templates.find((tp) => String(tp.id) === templateId);
    if (!rec) return null;
    return {
      id: String(rec.id),
      name: String(rec.name ?? ""),
      widthMm: Number(rec.widthMm ?? 50),
      heightMm: Number(rec.heightMm ?? 30),
      dpi: Number(rec.dpi ?? 300),
      elements: parseElements(rec.elements),
    };
  }, [templates, templateId, builtins]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => `${p.name} ${p.sku} ${p.barcode}`.toLowerCase().includes(q));
  }, [products, search]);

  const instances = useMemo(() => {
    const out: EntityRecord[] = [];
    for (const p of products) {
      const qty = qtyByProduct[String(p.id)] ?? 0;
      for (let i = 0; i < qty; i++) out.push(p);
    }
    return out;
  }, [products, qtyByProduct]);

  function setQty(id: string, qty: number) {
    setQtyByProduct((m) => ({ ...m, [id]: Math.max(0, Math.floor(qty) || 0) }));
  }

  const totalLabels = instances.length;

  const pageCss = useMemo(() => {
    if (!template) return "";
    if (layout === "thermal") {
      return `@media print {
  @page { size: ${template.widthMm}mm ${template.heightMm}mm; margin: 0; }
  .label-sheet { gap: 0 !important; }
  .print-label { page-break-after: always; break-after: page; border: 0 !important; }
}`;
    }
    return `@media print {
  @page { size: A4; margin: ${marginMm}mm; }
  .print-label { break-inside: avoid; }
}`;
  }, [template, layout, marginMm]);

  return (
    <div className="space-y-4">
      <style dangerouslySetInnerHTML={{ __html: pageCss }} />

      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">{t("label.pTitle")}</h1>
          <p className="text-xs text-muted">{t("label.pSubtitle")}</p>
        </div>
        <Button variant="primary" size="sm" disabled={!template || totalLabels === 0} onClick={() => window.print()}>
          <Icon name="printer" className="h-3.5 w-3.5" /> {t("label.print")} {totalLabels > 0 ? `(${totalLabels})` : ""}
        </Button>
      </div>

      <div className="no-print grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader title={t("label.setup")} />
            <CardBody className="space-y-3">
              <div>
                <Label htmlFor="tpl">{t("label.template")}</Label>
                <Select id="tpl" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                  <optgroup label={t("label.builtin")}>
                    {builtins.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </optgroup>
                  {templates.length > 0 && (
                    <optgroup label={t("label.saved")}>
                      {templates.map((tp) => (
                        <option key={tp.id} value={tp.id}>
                          {String(tp.name)} ({Number(tp.widthMm)}×{Number(tp.heightMm)}mm)
                        </option>
                      ))}
                    </optgroup>
                  )}
                </Select>
              </div>
              <div>
                <Label htmlFor="layout">{t("label.output")}</Label>
                <Select id="layout" value={layout} onChange={(e) => setLayout(e.target.value as Layout)}>
                  <option value="a4">A4 sheet / PDF (grid)</option>
                  <option value="thermal">Thermal roll (one per page)</option>
                </Select>
              </div>
              {layout === "a4" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="margin">Margin (mm)</Label>
                    <Input id="margin" type="number" value={marginMm} onChange={(e) => setMarginMm(Number(e.target.value) || 0)} />
                  </div>
                  <div>
                    <Label htmlFor="gap">Gap (mm)</Label>
                    <Input id="gap" type="number" value={gapMm} onChange={(e) => setGapMm(Number(e.target.value) || 0)} />
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("label.products")} />
            <CardBody className="space-y-2">
              <Input placeholder={t("stock.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="max-h-80 space-y-1 overflow-auto pr-1">
                {filteredProducts.length === 0 && <p className="px-1 py-3 text-xs text-muted">{t("common.noResults")}</p>}
                {filteredProducts.map((p) => {
                  const id = String(p.id);
                  const qty = qtyByProduct[id] ?? 0;
                  const meta = [String(p.sku ?? ""), p.barcode ? String(p.barcode) : ""].filter(Boolean).join(" · ");
                  return (
                    <div key={id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium leading-snug text-foreground break-words">{String(p.name ?? "") || "—"}</div>
                        {meta && <div className="truncate text-xs text-muted">{meta}</div>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setQty(id, qty - 1)}
                          aria-label="Less"
                          className="flex h-7 w-7 items-center justify-center rounded border border-border text-sm hover:bg-surface-2"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={qty}
                          onChange={(e) => setQty(id, Number(e.target.value))}
                          className="h-7 w-12 rounded border border-border-strong bg-surface/60 text-center text-xs text-foreground focus:outline-none focus-visible:border-ring"
                        />
                        <button
                          type="button"
                          onClick={() => setQty(id, qty + 1)}
                          aria-label="More"
                          className="flex h-7 w-7 items-center justify-center rounded border border-border text-sm hover:bg-surface-2"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* on-screen preview */}
        <Card>
          <CardHeader title={`${t("label.preview")} — ${totalLabels}`} />
          <CardBody>
            {!template ? (
              <p className="text-sm text-muted">{t("label.selectTpl")}</p>
            ) : totalLabels === 0 ? (
              <p className="text-sm text-muted">{t("label.setQty")}</p>
            ) : (
              <PrintSheet template={template} instances={instances} layout={layout} gapMm={gapMm} screen />
            )}
          </CardBody>
        </Card>
      </div>

      {/* print-only sheet (rendered off the controls so it prints clean) */}
      {template && totalLabels > 0 && (
        <div className="hidden print:block">
          <PrintSheet template={template} instances={instances} layout={layout} gapMm={gapMm} />
        </div>
      )}
    </div>
  );
}

function PrintSheet({
  template,
  instances,
  layout,
  gapMm,
  screen,
}: {
  template: LabelTemplateDef;
  instances: EntityRecord[];
  layout: Layout;
  gapMm: number;
  screen?: boolean;
}) {
  // The print sheet must be physically correct (PRINT_PX_PER_MM); the on-screen
  // preview is scaled up ~1.8× so the content is comfortably legible.
  const ppm = screen ? PRINT_PX_PER_MM * 1.8 : PRINT_PX_PER_MM;
  const gapPx = gapMm * ppm;
  const thermal = layout === "thermal";
  return (
    <div
      className="label-sheet"
      style={
        thermal
          ? { display: "flex", flexDirection: "column", gap: screen ? 8 : 0, alignItems: "flex-start" }
          : { display: "flex", flexWrap: "wrap", gap: gapPx, alignItems: "flex-start" }
      }
    >
      {instances.map((p, i) => (
        <div
          key={`${p.id}-${i}`}
          className="print-label"
          style={{
            width: template.widthMm * ppm,
            height: template.heightMm * ppm,
            border: screen ? "1px solid var(--border, #e5e7eb)" : "1px solid #eee",
            boxSizing: "content-box",
          }}
        >
          <LabelRenderer template={template} product={p} pxPerMm={ppm} />
        </div>
      ))}
    </div>
  );
}
