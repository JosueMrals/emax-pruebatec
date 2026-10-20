"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type ActionResult, UserFacingError } from "@/lib/action-errors";
import { getActiveCompany } from "@/lib/company";
import { todayInSpain } from "@/lib/dates";
import { db } from "@/lib/db";
import { canChangeQuoteStatus, canConvertQuote, QUOTE_STATUSES } from "@/lib/quotes";
import {
  computeSalesDocument,
  linesData,
  nextInvoiceNumber,
  nextQuoteNumber,
  resolveClient,
  salesErrorResult,
} from "@/lib/sales";
import { fieldErrorsFrom } from "@/lib/validation/common";
import { quoteInputSchema } from "@/lib/validation/invoice";

const NO_COMPANY: ActionResult = { error: "Configura tu empresa antes de continuar." };
const toDate = (d: string) => new Date(`${d}T00:00:00.000Z`);

export async function createQuote(input: unknown): Promise<ActionResult> {
  const company = await getActiveCompany();
  if (!company) return NO_COMPANY;
  const parsed = quoteInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Revisa los campos marcados.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const data = parsed.data;
  const issueDate = toDate(data.issueDate);

  try {
    await db.$transaction(async (tx) => {
      const client = await resolveClient(tx, company.id, data.client);
      const { operationType, totals } = computeSalesDocument(client, data.lines);
      await tx.quote.create({
        data: {
          companyId: company.id,
          number: await nextQuoteNumber(tx, company, issueDate.getUTCFullYear()),
          issueDate,
          validUntil: data.validUntil ? toDate(data.validUntil) : null,
          operationType,
          clientId: client.id,
          baseCents: totals.baseCents,
          vatCents: totals.vatCents,
          totalCents: totals.totalCents,
          notes: data.notes || null,
          lines: { create: linesData(data.lines, totals) },
        },
      });
    });
  } catch (e) {
    return salesErrorResult(e, "createQuote", "No se pudo guardar el presupuesto. Inténtalo de nuevo.");
  }

  redirect("/presupuestos");
}

const statusChange = z.object({ id: z.uuid(), status: z.enum(QUOTE_STATUSES) });

export async function changeQuoteStatus(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const company = await getActiveCompany();
  if (!company) return NO_COMPANY;
  const parsed = statusChange.safeParse({ id: formData.get("id"), status: formData.get("status") });
  if (!parsed.success) return { error: "Cambio de estado no válido." };

  const quote = await db.quote.findFirst({ where: { id: parsed.data.id, companyId: company.id } });
  if (!quote) return { error: "El presupuesto no existe." };
  if (!canChangeQuoteStatus(quote.status, parsed.data.status)) {
    return { error: "Ese cambio de estado no está permitido." };
  }

  // Pinning the previous status makes a concurrent change fail instead of being overwritten.
  const { count } = await db.quote.updateMany({
    where: { id: quote.id, status: quote.status },
    data: { status: parsed.data.status },
  });
  if (count === 0) return { error: "El presupuesto cambió mientras tanto. Recarga la página." };

  refresh();
  return { error: null };
}

export async function convertQuoteToInvoice(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const company = await getActiveCompany();
  if (!company) return NO_COMPANY;
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Presupuesto no válido." };

  try {
    await db.$transaction(async (tx) => {
      const quote = await tx.quote.findFirst({
        where: { id: id.data, companyId: company.id },
        include: { lines: true, client: true },
      });
      if (!quote) throw new UserFacingError("El presupuesto no existe.");
      if (!canConvertQuote(quote.status)) {
        throw new UserFacingError("Solo se pueden facturar presupuestos aceptados.");
      }

      // Recomputed with today's rules and client data rather than copying stored totals.
      const lines = quote.lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitPriceCents: l.unitPriceCents,
        vatRate: l.vatRate,
      }));
      const { operationType, totals } = computeSalesDocument(quote.client, lines);
      const issueDate = toDate(todayInSpain());

      const invoice = await tx.invoice.create({
        data: {
          companyId: company.id,
          number: await nextInvoiceNumber(tx, company, issueDate.getUTCFullYear()),
          issueDate,
          operationType,
          clientId: quote.clientId,
          baseCents: totals.baseCents,
          vatCents: totals.vatCents,
          totalCents: totals.totalCents,
          notes: quote.notes ? `${quote.notes}\nSegún presupuesto ${quote.number}.` : `Según presupuesto ${quote.number}.`,
          lines: { create: linesData(lines, totals) },
        },
      });

      const { count } = await tx.quote.updateMany({
        where: { id: quote.id, status: "ACEPTADO", invoiceId: null },
        data: { status: "FACTURADO", invoiceId: invoice.id },
      });
      if (count === 0) throw new UserFacingError("Este presupuesto ya se facturó.");
    });
  } catch (e) {
    return salesErrorResult(e, "convertQuoteToInvoice", "No se pudo crear la factura. Inténtalo de nuevo.");
  }

  redirect("/facturas");
}
