import "server-only";
import { db } from "@/lib/db";
import { modelo111, modelo303, modelo349 } from "@/lib/fiscal/models";
import { type Quarter, quarterRange } from "@/lib/fiscal/quarter";

// One query path for the tax page and its PDF, so both always show the same figures.
export async function loadQuarterTaxes(companyId: string, quarter: Quarter) {
  const { start, end } = quarterRange(quarter);
  const [invoices, expenses] = await Promise.all([
    db.invoice.findMany({
      where: { companyId, issueDate: { gte: start, lt: end } },
      select: {
        operationType: true,
        baseCents: true,
        vatCents: true,
        client: { select: { name: true, taxId: true, countryCode: true } },
      },
    }),
    db.expense.findMany({
      where: { companyId, date: { gte: start, lt: end } },
      select: { supplierId: true, baseCents: true, vatCents: true, irpfCents: true, deductible: true },
    }),
  ]);
  return {
    invoiceCount: invoices.length,
    expenseCount: expenses.length,
    m303: modelo303(invoices, expenses),
    m111: modelo111(expenses),
    m349: modelo349(invoices),
  };
}

export type QuarterTaxes = Awaited<ReturnType<typeof loadQuarterTaxes>>;
