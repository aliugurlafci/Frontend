/**
 * Phase F0 — document number sequences (per tenant + prefix).
 *
 * Generates monotonically increasing, zero-padded document numbers like
 * `INV-0001`, `Q-0001`. In production this maps to a Postgres sequence or an
 * atomic counter row; the in-memory version is process-local.
 */
export class NumberSequence {
  private counters = new Map<string, number>();

  next(tenantId: string, prefix: string, pad = 4): string {
    const key = `${tenantId}:${prefix}`;
    const n = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, n);
    return `${prefix}-${String(n).padStart(pad, "0")}`;
  }

  /** Raise the counter so seeded/imported documents don't collide. */
  bump(tenantId: string, prefix: string, n: number): void {
    const key = `${tenantId}:${prefix}`;
    this.counters.set(key, Math.max(this.counters.get(key) ?? 0, n));
  }
}

export const numberSequence = new NumberSequence();
