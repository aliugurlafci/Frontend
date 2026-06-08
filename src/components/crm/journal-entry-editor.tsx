"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import type { EntityRecord } from "@/lib/metadata/types";
import { apiFetch } from "@/lib/api-client";
import { formatMoney } from "@/lib/finance/money";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";

interface JLine {
  ledgerAccountId: string | null;
  debit: number;
  credit: number;
  description: string;
}
const emptyLine = (): JLine => ({ ledgerAccountId: null, debit: 0, credit: 0, description: "" });
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Manual journal-entry editor with a balanced debit/credit grid. New entries can
 *  be saved as draft or posted; existing entries are read-only with post/void. */
export function JournalEntryEditor({
  id,
  accounts,
  branches,
}: {
  id: string;
  accounts: EntityRecord[];
  branches: EntityRecord[];
}) {
  const router = useRouter();
  const isNew = id === "new";
  const [doc, setDoc] = useState<EntityRecord | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState("");
  const [branchId, setBranchId] = useState("");
  const [lines, setLines] = useState<JLine[]>([emptyLine(), emptyLine()]);
  const [busy, setBusy] = useState(false);

  const readOnly = !isNew;

  async function load() {
    const rec = await apiFetch<EntityRecord>(`/entities/journalEntry/${id}`);
    setDoc(rec);
    setDate(String(rec.date ?? ""));
    setMemo(String(rec.memo ?? ""));
    setBranchId(String(rec.branchId ?? ""));
    const ls = await apiFetch<{ items: EntityRecord[] }>(`/entities/journalLine?pageSize=200&filter.entryId=${id}`);
    setLines(
      ls.items.map((l) => ({
        ledgerAccountId: (l.ledgerAccountId as string) ?? null,
        debit: typeof l.debit === "number" ? l.debit : 0,
        credit: typeof l.credit === "number" ? l.credit : 0,
        description: String(l.description ?? ""),
      })),
    );
  }

  useEffect(() => {
    if (isNew) return;
    load().catch((e) => toast.error((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function updateLine(i: number, patch: Partial<JLine>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  const totals = useMemo(() => {
    const debit = round2(lines.reduce((s, l) => s + (Number(l.debit) || 0), 0));
    const credit = round2(lines.reduce((s, l) => s + (Number(l.credit) || 0), 0));
    return { debit, credit, balanced: debit === credit && debit > 0 };
  }, [lines]);

  const accName = (idv: string) => accounts.find((a) => String(a.id) === idv)?.name as string ?? idv;

  async function save(post: boolean) {
    if (!date) {
      toast.error("Date is required");
      return;
    }
    const valid = lines.filter((l) => l.ledgerAccountId && (l.debit > 0 || l.credit > 0));
    if (valid.length < 2 || !totals.balanced) {
      toast.error("Entry must balance (debit = credit) with at least two lines");
      return;
    }
    setBusy(true);
    try {
      const { entry } = await apiFetch<{ entry: EntityRecord }>("/journal-entries", {
        method: "POST",
        body: {
          date,
          memo: memo || null,
          branchId: branchId || null,
          post,
          lines: valid.map((l) => ({ ledgerAccountId: l.ledgerAccountId, debit: round2(l.debit), credit: round2(l.credit), description: l.description || null })),
        },
      });
      toast.success(post ? "Posted" : "Draft saved");
      router.push(`/journalEntry/${entry.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: "post" | "void") {
    setBusy(true);
    try {
      await apiFetch(`/journal-entries/${id}/${action}`, { method: "POST" });
      toast.success(action);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Link href="/journalEntry" className="text-sm text-muted hover:text-foreground">
            <Icon name="chevronLeft" className="inline h-4 w-4" /> Journal Entries
          </Link>
          <h1 className="text-lg font-semibold">{isNew ? "New Journal Entry" : String(doc?.number ?? "JE")}</h1>
          {doc && <Badge tone={doc.status === "posted" ? "success" : doc.status === "void" ? "danger" : "neutral"}>{String(doc.status)}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {isNew ? (
            <>
              <Button size="sm" loading={busy} onClick={() => save(false)}>
                Save draft
              </Button>
              <Button variant="primary" size="sm" loading={busy} disabled={!totals.balanced} onClick={() => save(true)}>
                Save & post
              </Button>
            </>
          ) : (
            <>
              {doc?.status === "draft" && (
                <Button variant="primary" size="sm" loading={busy} onClick={() => runAction("post")}>
                  Post
                </Button>
              )}
              {doc?.status !== "void" && (
                <Button size="sm" loading={busy} onClick={() => runAction("void")}>
                  Void
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader title="Details" />
        <CardBody className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="date" required>
              Date
            </Label>
            <Input id="date" type="date" value={date} disabled={readOnly} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="memo">Memo</Label>
            <Input id="memo" value={memo} disabled={readOnly} onChange={(e) => setMemo(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="branch">Branch</Label>
            <Select id="branch" value={branchId} disabled={readOnly} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">— None —</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {String(b.name)}
                </option>
              ))}
            </Select>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Lines" />
        <CardBody>
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted">
              <tr>
                <th className="py-2">Account</th>
                <th className="py-2">Description</th>
                <th className="w-28 py-2 text-right">Debit</th>
                <th className="w-28 py-2 text-right">Credit</th>
                {!readOnly && <th className="w-8" />}
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-1.5">
                    {readOnly ? (
                      accName(String(l.ledgerAccountId))
                    ) : (
                      <Select value={l.ledgerAccountId ?? ""} onChange={(e) => updateLine(i, { ledgerAccountId: e.target.value || null })} className="h-8 text-xs">
                        <option value="">— Select —</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {String(a.code)} · {String(a.name)}
                          </option>
                        ))}
                      </Select>
                    )}
                  </td>
                  <td className="py-1.5">
                    {readOnly ? l.description : <Input value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} className="h-8 text-xs" />}
                  </td>
                  <td className="py-1.5 text-right">
                    {readOnly ? formatMoney(l.debit, "USD") : <Input type="number" value={l.debit || ""} onChange={(e) => updateLine(i, { debit: Number(e.target.value) || 0, credit: 0 })} className="h-8 text-right text-xs" />}
                  </td>
                  <td className="py-1.5 text-right">
                    {readOnly ? formatMoney(l.credit, "USD") : <Input type="number" value={l.credit || ""} onChange={(e) => updateLine(i, { credit: Number(e.target.value) || 0, debit: 0 })} className="h-8 text-right text-xs" />}
                  </td>
                  {!readOnly && (
                    <td className="py-1.5">
                      <button onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} className="text-muted hover:text-danger" aria-label="Remove">
                        <Icon name="trash" className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-border">
              <tr className={totals.balanced ? "" : "text-danger"}>
                <td colSpan={2} className="py-2 text-right text-xs text-muted">
                  Totals {totals.balanced ? "(balanced)" : "(must balance)"}
                </td>
                <td className="py-2 text-right font-semibold tabular-nums">{formatMoney(totals.debit, "USD")}</td>
                <td className="py-2 text-right font-semibold tabular-nums">{formatMoney(totals.credit, "USD")}</td>
                {!readOnly && <td />}
              </tr>
            </tfoot>
          </table>
          {!readOnly && (
            <Button size="sm" className="mt-2" onClick={() => setLines((ls) => [...ls, emptyLine()])}>
              <Icon name="plus" className="h-3.5 w-3.5" /> Add line
            </Button>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
