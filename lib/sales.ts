import "server-only";
import { type ActionResult, isUniqueViolation, UserFacingError } from "@/lib/action-errors";
import type { Prisma } from "@/lib/generated/prisma/client";
import { isEuVatNumber, operationTypeFor } from "@/lib/fiscal/operations";
import { invoiceTotals, type LineInput } from "@/lib/fiscal/totals";
import { documentSeries, nextDocumentNumber } from "@/lib/numbering";
import type { SalesClientInput } from "@/lib/validation/invoice";

const MAX_INT4 = 2_147_483_647;

// Finds the client inside the company, or creates it inline. Never crosses companies.
export async function resolveClient(tx: Prisma.TransactionClient, companyId: string, input: SalesClientInput) {
  const client =
    input.mode === "existing"
      ? await tx.client.findFirst({ where: { id: input.id, companyId } })
      : await tx.client.create({
          data: {
            companyId,
            name: input.name,
            taxId: input.taxId,
            countryCode: input.countryCode,
            email: input.email || null,
          },
        });
  if (!client) throw new UserFacingError("El cliente seleccionado ya no existe.");
  return client;
}

// Operation type and totals are always derived here, never taken from the form.
export function computeSalesDocument(client: { taxId: string; countryCode: string }, lines: LineInput[]) {
  const operationType = operationTypeFor(client.countryCode);
  if (operationType === "INTRA_SERVICIOS" && !isEuVatNumber(client.taxId, client.countryCode)) {
    throw new UserFacingError("El cliente no tiene un NIF-IVA válido para una operación intracomunitaria.");
  }
  const totals = invoiceTotals(lines, operationType);
  if (totals.totalCents > MAX_INT4) throw new UserFacingError("El importe total es demasiado alto.");
  return { operationType, totals };
}

export function linesData(lines: (LineInput & { description: string })[], computed: ReturnType<typeof invoiceTotals>) {
  return lines.map((l, i) => ({
    description: l.description,
    quantity: l.quantity,
    unitPriceCents: l.unitPriceCents,
    ...computed.lines[i],
  }));
}

export async function nextInvoiceNumber(
  tx: Prisma.TransactionClient,
  company: { id: string; invoicePrefix: string },
  year: number,
) {
  const last = await tx.invoice.findFirst({
    where: { companyId: company.id, number: { startsWith: documentSeries(company.invoicePrefix, year) } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return nextDocumentNumber(company.invoicePrefix, year, last?.number ?? null);
}

export async function nextQuoteNumber(
  tx: Prisma.TransactionClient,
  company: { id: string; quotePrefix: string },
  year: number,
) {
  const last = await tx.quote.findFirst({
    where: { companyId: company.id, number: { startsWith: documentSeries(company.quotePrefix, year) } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return nextDocumentNumber(company.quotePrefix, year, last?.number ?? null);
}

// Shared by invoices and quotes so both report the same messages.
export function salesErrorResult(e: unknown, label: string, fallback: string): ActionResult {
  if (e instanceof UserFacingError) return { error: e.message };
  if (isUniqueViolation(e, "taxId")) {
    return {
      error: "Ya existe un cliente con ese NIF. Selecciónalo en la lista de clientes.",
      fieldErrors: { "client.taxId": "NIF ya registrado" },
    };
  }
  if (isUniqueViolation(e, "number")) {
    return { error: "Se guardó otro documento al mismo tiempo. Vuelve a intentarlo." };
  }
  console.error(label, e);
  return { error: fallback };
}
