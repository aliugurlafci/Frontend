"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { EntityRecord } from "@/lib/metadata/types";
import { apiFetch } from "@/lib/api-client";
import { formatMoney } from "@/lib/finance/money";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

const METHODS = [
  { value: "bank", label: "Bank Transfer" },
  { value: "card", label: "Card" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

export function PaymentsPanel({
  invoiceId,
  currencyCode,
  balance,
  onPaid,
}: {
  invoiceId: string;
  currencyCode: string;
  balance: number;
  onPaid: () => void;
}) {
  const [payments, setPayments] = useState<EntityRecord[]>([]);
  const [amount, setAmount] = useState<string>(balance > 0 ? String(balance) : "");
  const [method, setMethod] = useState("bank");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  async function loadPayments() {
    const res = await apiFetch<{ payments: EntityRecord[] }>(`/invoices/${invoiceId}/payments`);
    setPayments(res.payments);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPayments().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  async function record() {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error("Enter a positive amount");
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/invoices/${invoiceId}/payments`, {
        method: "POST",
        body: { amount: amt, method, paidAt },
      });
      toast.success("Payment recorded");
      setAmount("");
      await loadPayments();
      onPaid();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {payments.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border text-sm">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-3 py-2">
              <span>
                {String(p.number)} · {String(p.method)}
              </span>
              <span className="flex items-center gap-3">
                <span className="text-muted">{p.paidAt ? new Date(String(p.paidAt)).toLocaleDateString() : ""}</span>
                <span className="font-medium tabular-nums">
                  {formatMoney(typeof p.amount === "number" ? p.amount : 0, currencyCode)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:items-end">
        <div>
          <Label htmlFor="pay-amount">Amount</Label>
          <Input id="pay-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="pay-method">Method</Label>
          <Select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="pay-date">Date</Label>
          <Input id="pay-date" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </div>
        <Button variant="primary" size="sm" loading={busy} onClick={record}>
          Record payment
        </Button>
      </div>
    </div>
  );
}
