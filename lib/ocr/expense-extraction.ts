import { z } from "zod";
import { IRPF_RATES, totalMismatchCents } from "@/lib/fiscal/expenses";
import { percentOf, VAT_RATES } from "@/lib/fiscal/totals";
import { centsToInput } from "@/lib/money";
import { normalizeTaxId } from "@/lib/tax-id";

// Shape Claude must return (structured output). Amounts in euros exactly as printed; null when not visible.
export const invoiceExtractionSchema = z.object({
  supplier_name: z.string().nullable(),
  supplier_tax_id: z.string().nullable(),
  invoice_number: z.string().nullable(),
  invoice_date: z.string().nullable(),
  description: z.string().nullable(),
  base_amount: z.number().nullable(),
  vat_rate: z.number().nullable(),
  vat_amount: z.number().nullable(),
  irpf_rate: z.number().nullable(),
  irpf_amount: z.number().nullable(),
  total_amount: z.number().nullable(),
});

export type InvoiceExtraction = z.infer<typeof invoiceExtractionSchema>;

export const EXTRACTION_INSTRUCTIONS = `You read a Spanish supplier invoice (factura recibida) so a freelancer can record it as an expense.

- The supplier is the party that issued the invoice, not the customer it is addressed to.
- Copy amounts exactly as printed, in euros, as numbers (1.210,50 € → 1210.5). Do not recompute or correct them.
- base_amount is the taxable base (base imponible) before IVA; vat_rate the IVA percentage (21, 10, 4 or 0) and vat_amount its amount.
- irpf_rate and irpf_amount are the IRPF withholding (retención), as positive numbers. If the invoice has no withholding, return 0 for both.
- total_amount is the final amount payable as printed (total factura / total a pagar).
- If the invoice mixes several IVA rates, return the summed base and summed IVA, and null for vat_rate.
- invoice_date as YYYY-MM-DD.
- description: a short summary of what was bought, in Spanish, under 80 characters.
- Return null for anything that is not visible or legible. Never guess.`;

export interface ExpensePrefill {
  supplierName: string;
  supplierTaxId: string;
  number: string;
  date: string;
  description: string;
  base: string; // euros as typed in the form, e.g. "1000,00"
  vatRate: number | null;
  irpfRate: number | null;
}

export interface TotalsCheck {
  // null when the invoice lacks the amounts needed to check.
  ok: boolean | null;
  totalCents: number | null;
  expectedTotalCents: number | null;
}

export interface OcrResult {
  prefill: ExpensePrefill;
  check: TotalsCheck;
  warnings: string[];
}

const toCents = (euros: number | null) => (euros === null ? null : Math.round(euros * 100));

// Uses the printed rate if allowed; otherwise infers it from the amounts when they match a valid rate.
function resolveRate(
  printed: number | null,
  baseCents: number | null,
  amountCents: number | null,
  allowed: readonly number[],
): number | null {
  if (printed !== null && allowed.includes(printed)) return printed;
  if (baseCents && amountCents !== null) {
    return allowed.find((r) => Math.abs(percentOf(baseCents, r) - amountCents) <= 1) ?? null;
  }
  return null;
}

// Tolerates 1 cent per rounded amount (IVA and IRPF) printed on the invoice.
const TOLERANCE_CENTS = 2;

export function toExpensePrefill(x: InvoiceExtraction): OcrResult {
  const warnings: string[] = [];
  const baseCents = toCents(x.base_amount);
  const vatCents = toCents(x.vat_amount);
  const irpfCents = toCents(x.irpf_amount) ?? 0;
  const totalCents = toCents(x.total_amount);

  const vatRate = resolveRate(x.vat_rate, baseCents, vatCents, VAT_RATES);
  const irpfRate = resolveRate(x.irpf_rate, baseCents, irpfCents, IRPF_RATES);
  if (vatRate === null) warnings.push("No se pudo determinar un tipo de IVA único (21, 10, 4 o 0 %). Elígelo a mano.");
  if (irpfRate === null) warnings.push("La retención de IRPF no corresponde a 0, 7, 15 ni 19 %. Revísala.");

  const date = x.invoice_date && z.iso.date().safeParse(x.invoice_date).success ? x.invoice_date : "";
  if (!date) warnings.push("No se encontró una fecha válida.");
  if (baseCents === null || baseCents <= 0) warnings.push("No se encontró la base imponible.");
  if (!x.supplier_name || !x.supplier_tax_id) warnings.push("Faltan datos del proveedor (nombre o NIF).");

  let check: TotalsCheck = { ok: null, totalCents, expectedTotalCents: null };
  if (baseCents !== null && vatCents !== null && totalCents !== null) {
    const expectedTotalCents = baseCents + vatCents - irpfCents;
    const mismatch = totalMismatchCents({ baseCents, vatCents, irpfCents, totalCents });
    check = { ok: Math.abs(mismatch) <= TOLERANCE_CENTS, totalCents, expectedTotalCents };
    if (!check.ok) warnings.push("Base + IVA − IRPF no coincide con el total de la factura. Revisa los importes.");
  } else {
    warnings.push("Faltan importes para comprobar que base + IVA − IRPF = total.");
  }

  return {
    prefill: {
      supplierName: x.supplier_name?.trim() ?? "",
      supplierTaxId: x.supplier_tax_id ? normalizeTaxId(x.supplier_tax_id) : "",
      number: x.invoice_number?.trim() ?? "",
      date,
      description: x.description?.trim().slice(0, 500) ?? "",
      base: baseCents !== null && baseCents > 0 ? centsToInput(baseCents) : "",
      vatRate,
      irpfRate,
    },
    check,
    warnings,
  };
}
