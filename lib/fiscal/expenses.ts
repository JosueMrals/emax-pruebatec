import { percentOf } from "./totals";

// 15 % general for professionals, 7 % for their first years, 19 % for rentals.
export const IRPF_RATES = [0, 7, 15, 19] as const;
export type IrpfRate = (typeof IRPF_RATES)[number];

export interface ExpenseInput {
  baseCents: number;
  vatRate: number;
  irpfRate: number;
}

export interface ExpenseTotals {
  baseCents: number;
  vatCents: number;
  irpfCents: number;
  totalCents: number;
}

// Difference between a stated total and base + IVA - IRPF; 0 means the amounts are consistent.
export function totalMismatchCents(amounts: ExpenseTotals): number {
  return amounts.baseCents + amounts.vatCents - amounts.irpfCents - amounts.totalCents;
}

// The withheld IRPF is paid to Hacienda (Modelo 111), not to the supplier.
export function expenseTotals({ baseCents, vatRate, irpfRate }: ExpenseInput): ExpenseTotals {
  const vatCents = percentOf(baseCents, vatRate);
  const irpfCents = percentOf(baseCents, irpfRate);
  return { baseCents, vatCents, irpfCents, totalCents: baseCents + vatCents - irpfCents };
}
