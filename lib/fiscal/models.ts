import type { OperationType } from "./operations";

// Inputs are already filtered to one quarter. Results are estimates, not official returns.

export interface InvoiceForTaxes {
  operationType: OperationType;
  baseCents: number;
  vatCents: number;
  client: { name: string; taxId: string; countryCode: string };
}

export interface ExpenseForTaxes {
  supplierId: string;
  baseCents: number;
  vatCents: number;
  irpfCents: number;
  deductible: boolean;
}

export interface Modelo303 {
  repercutidoCents: number;
  soportadoCents: number;
  intraServiciosBaseCents: number;
  // Positive: to pay. Negative: to offset in later quarters.
  resultadoCents: number;
}

export function modelo303(invoices: InvoiceForTaxes[], expenses: ExpenseForTaxes[]): Modelo303 {
  const repercutidoCents = sum(invoices, (i) => i.vatCents);
  const soportadoCents = sum(
    expenses.filter((e) => e.deductible),
    (e) => e.vatCents,
  );
  const intraServiciosBaseCents = sum(
    invoices.filter((i) => i.operationType === "INTRA_SERVICIOS"),
    (i) => i.baseCents,
  );
  return { repercutidoCents, soportadoCents, intraServiciosBaseCents, resultadoCents: repercutidoCents - soportadoCents };
}

export interface Modelo111 {
  perceptores: number;
  baseCents: number;
  retencionesCents: number;
}

export function modelo111(expenses: ExpenseForTaxes[]): Modelo111 {
  const withholding = expenses.filter((e) => e.irpfCents > 0);
  return {
    perceptores: new Set(withholding.map((e) => e.supplierId)).size,
    baseCents: sum(withholding, (e) => e.baseCents),
    retencionesCents: sum(withholding, (e) => e.irpfCents),
  };
}

export type Clave349 = "S";

export interface Operador349 {
  taxId: string;
  name: string;
  countryCode: string;
  clave: Clave349;
  baseCents: number;
}

export interface Modelo349 {
  operadores: Operador349[];
  totalCents: number;
}

// Groups intra-community services by operator VAT number and key (S = services rendered).
export function modelo349(invoices: InvoiceForTaxes[]): Modelo349 {
  const byKey = new Map<string, Operador349>();
  for (const inv of invoices) {
    if (inv.operationType !== "INTRA_SERVICIOS") continue;
    const clave: Clave349 = "S";
    const key = `${inv.client.taxId}|${clave}`;
    const row = byKey.get(key);
    if (row) row.baseCents += inv.baseCents;
    else byKey.set(key, { ...inv.client, clave, baseCents: inv.baseCents });
  }
  const operadores = [...byKey.values()].sort((a, b) => a.taxId.localeCompare(b.taxId));
  return { operadores, totalCents: sum(operadores, (o) => o.baseCents) };
}

function sum<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((total, item) => total + pick(item), 0);
}
