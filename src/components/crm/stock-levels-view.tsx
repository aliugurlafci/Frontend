"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { Select, Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { useT } from "@/lib/i18n/client";
import type { EntityRecord } from "@/lib/metadata/types";

interface StockRow {
  productId: string;
  productName: string;
  sku: string;
  barcode: string;
  warehouseId: string;
  warehouseName: string;
  branchId: string | null;
  branchName: string;
  onHand: number;
  value: number;
  reorderLevel: number;
  low: boolean;
}

/** Per-location stock levels across branches/warehouses, with reorder alerts and
 *  a shortcut to print labels. Reads the `/inventory/on-hand` join endpoint. */
export function StockLevelsView() {
  const t = useT();
  const [rows, setRows] = useState<StockRow[]>([]);
  const [branches, setBranches] = useState<EntityRecord[]>([]);
  const [warehouses, setWarehouses] = useState<EntityRecord[]>([]);
  const [branchId, setBranchId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [oh, br, wh] = await Promise.all([
          apiFetch<{ rows: StockRow[] }>("/inventory/on-hand"),
          apiFetch<{ items: EntityRecord[] }>("/entities/branch?pageSize=500"),
          apiFetch<{ items: EntityRecord[] }>("/entities/warehouse?pageSize=500"),
        ]);
        setRows(oh.rows);
        setBranches(br.items);
        setWarehouses(wh.items);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setLoading(false);
      }
    })().catch(() => {});
  }, []);

  const warehouseOptions = useMemo(
    () => (branchId ? warehouses.filter((w) => String(w.branchId ?? "") === branchId) : warehouses),
    [warehouses, branchId],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (branchId && r.branchId !== branchId) return false;
      if (warehouseId && r.warehouseId !== warehouseId) return false;
      if (lowOnly && !r.low) return false;
      if (q && !`${r.productName} ${r.sku} ${r.barcode}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, branchId, warehouseId, search, lowOnly]);

  const totals = useMemo(
    () => ({
      lines: filtered.length,
      units: filtered.reduce((s, r) => s + r.onHand, 0),
      value: filtered.reduce((s, r) => s + r.value, 0),
      low: filtered.filter((r) => r.low).length,
    }),
    [filtered],
  );

  const stats = [
    { label: t("stock.lines"), value: String(totals.lines) },
    { label: t("stock.units"), value: Math.round(totals.units).toLocaleString() },
    { label: t("stock.value"), value: Math.round(totals.value).toLocaleString() },
    { label: t("stock.low"), value: String(totals.low) },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">{t("stock.title")}</h1>
        <p className="text-xs text-muted">{t("stock.subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardBody>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title={t("stock.onhandBy")} />
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-48">
              <label className="mb-1 block text-xs font-medium text-muted">{t("stock.branch")}</label>
              <Select
                value={branchId}
                onChange={(e) => {
                  setBranchId(e.target.value);
                  setWarehouseId("");
                }}
              >
                <option value="">{t("stock.allBranches")}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {String(b.name)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-48">
              <label className="mb-1 block text-xs font-medium text-muted">{t("stock.warehouse")}</label>
              <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                <option value="">{t("stock.allWarehouses")}</option>
                {warehouseOptions.map((w) => (
                  <option key={w.id} value={w.id}>
                    {String(w.name)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-56">
              <label className="mb-1 block text-xs font-medium text-muted">{t("common.search")}</label>
              <Input placeholder={t("stock.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <label className="flex h-9 items-center gap-1.5 text-sm">
              <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
              {t("stock.lowOnly")}
            </label>
          </div>

          <Table>
            <THead>
              <tr>
                <TH>{t("stock.product")}</TH>
                <TH>SKU / Barcode</TH>
                <TH>{t("stock.branch")}</TH>
                <TH>{t("stock.warehouse")}</TH>
                <TH>{t("stock.onhand")}</TH>
                <TH>{t("stock.value")}</TH>
                <TH>{t("stock.status")}</TH>
                <TH> </TH>
              </tr>
            </THead>
            <tbody>
              {filtered.map((r) => (
                <TR key={`${r.productId}:${r.warehouseId}`}>
                  <TD>{r.productName}</TD>
                  <TD>
                    <span className="text-xs text-muted">{r.sku || "—"}</span>
                    {r.barcode && <span className="ml-1 font-mono text-xs">· {r.barcode}</span>}
                  </TD>
                  <TD>{r.branchName || "—"}</TD>
                  <TD>{r.warehouseName}</TD>
                  <TD>
                    <span className="tabular-nums">{r.onHand.toLocaleString()}</span>
                  </TD>
                  <TD>
                    <span className="tabular-nums">{Math.round(r.value).toLocaleString()}</span>
                  </TD>
                  <TD>{r.low ? <Badge tone="danger">{t("stock.lowb")}</Badge> : <Badge tone="success">{t("stock.ok")}</Badge>}</TD>
                  <TD>
                    <Link
                      href={`/labels/print?productId=${encodeURIComponent(r.productId)}`}
                      className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"
                    >
                      <Icon name="printer" className="h-3.5 w-3.5" /> {t("stock.label")}
                    </Link>
                  </TD>
                </TR>
              ))}
              {!loading && filtered.length === 0 && (
                <TR>
                  <TD>{t("stock.empty")}</TD>
                </TR>
              )}
            </tbody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
