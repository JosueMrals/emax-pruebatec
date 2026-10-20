import type { OperationType } from "./operations";

export const VAT_RATES = [21, 10, 4, 0] as const;
export type VatRate = (typeof VAT_RATES)[number];

export interface LineInput {
  quantity: number;
  unitPriceCents: number;
  vatRate: number;
}

export interface LineTotals {
  baseCents: number;
  vatRate: number;
  vatCents: number;
}

export interface InvoiceTotals {
  lines: LineTotals[];
  baseCents: number;
  vatCents: number;
  totalCents: number;
}

export function percentOf(cents: number, rate: number): number {
  return Math.round((cents * rate) / 100);
}

// Intra-community services carry 0 % VAT (reverse charge), whatever rate the line had.
export function lineTotals(line: LineInput, operationType: OperationType): LineTotals {
  const baseCents = line.quantity * line.unitPriceCents;
  const vatRate = operationType === "INTRA_SERVICIOS" ? 0 : line.vatRate;
  return { baseCents, vatRate, vatCents: percentOf(baseCents, vatRate) };
}

export function invoiceTotals(lines: LineInput[], operationType: OperationType): InvoiceTotals {
  const computed = lines.map((l) => lineTotals(l, operationType));
  const baseCents = computed.reduce((sum, l) => sum + l.baseCents, 0);
  const vatCents = computed.reduce((sum, l) => sum + l.vatCents, 0);
  return { lines: computed, baseCents, vatCents, totalCents: baseCents + vatCents };
}

// Spanish invoices must show base and VAT per rate; sums the stored line amounts per rate, highest first.
export function vatBreakdown(lines: LineTotals[]): LineTotals[] {
  const byRate = new Map<number, LineTotals>();
  for (const l of lines) {
    const row = byRate.get(l.vatRate) ?? { vatRate: l.vatRate, baseCents: 0, vatCents: 0 };
    row.baseCents += l.baseCents;
    row.vatCents += l.vatCents;
    byRate.set(l.vatRate, row);
  }
  return [...byRate.values()].sort((a, b) => b.vatRate - a.vatRate);
}
