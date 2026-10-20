"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-errors";
import { getActiveCompany } from "@/lib/company";
import { linkMovement } from "@/lib/bank/link";
import { db } from "@/lib/db";
import { computeSalesDocument, linesData, nextInvoiceNumber, resolveClient, salesErrorResult } from "@/lib/sales";
import { fieldErrorsFrom, fromMovementSchema } from "@/lib/validation/common";
import { invoiceInputSchema } from "@/lib/validation/invoice";

const NO_COMPANY: ActionResult = { error: "Configura tu empresa antes de continuar." };

export async function createInvoice(input: unknown): Promise<ActionResult> {
  const company = await getActiveCompany();
  if (!company) return NO_COMPANY;
  const parsed = invoiceInputSchema.extend(fromMovementSchema.shape).safeParse(input);
  if (!parsed.success) {
    return { error: "Revisa los campos marcados.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const data = parsed.data;
  const issueDate = new Date(`${data.issueDate}T00:00:00.000Z`);

  let number = "";
  try {
    await db.$transaction(async (tx) => {
      const client = await resolveClient(tx, company.id, data.client);
      const { operationType, totals } = computeSalesDocument(client, data.lines);
      const invoice = await tx.invoice.create({
        data: {
          companyId: company.id,
          number: await nextInvoiceNumber(tx, company, issueDate.getUTCFullYear()),
          issueDate,
          operationType,
          clientId: client.id,
          baseCents: totals.baseCents,
          vatCents: totals.vatCents,
          totalCents: totals.totalCents,
          notes: data.notes || null,
          lines: { create: linesData(data.lines, totals) },
        },
      });
      // Created from a bank collection: reconcile in the same transaction, or save nothing.
      if (data.movementId) {
        await linkMovement(tx, company.id, data.movementId, { type: "invoice", id: invoice.id, totalCents: invoice.totalCents });
      }
      number = invoice.number;
    });
  } catch (e) {
    return salesErrorResult(e, "createInvoice", "No se pudo guardar la factura. Inténtalo de nuevo.");
  }

  redirect(data.movementId ? `/banco/conciliacion?conciliado=${encodeURIComponent(`Factura ${number}`)}` : "/facturas");
}

export async function markInvoicePaid(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const company = await getActiveCompany();
  if (!company) return NO_COMPANY;
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Factura no válida." };

  try {
    const { count } = await db.invoice.updateMany({
      where: { id: id.data, companyId: company.id, status: "PENDIENTE" },
      data: { status: "COBRADA", paidAt: new Date() },
    });
    if (count === 0) return { error: "La factura no existe o ya estaba cobrada." };
  } catch (e) {
    console.error("markInvoicePaid", e);
    return { error: "No se pudo actualizar la factura." };
  }

  refresh();
  return { error: null };
}
