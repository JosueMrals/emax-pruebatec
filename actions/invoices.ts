"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { isEuVatNumber, operationTypeFor } from "@/lib/fiscal/operations";
import { invoiceTotals } from "@/lib/fiscal/totals";
import { fieldErrorsFrom, invoiceInputSchema } from "@/lib/validation/invoice";

export type ActionResult = { error: string | null; fieldErrors?: Record<string, string> };

const MAX_INT4 = 2_147_483_647;

class UserFacingError extends Error {}

function isUniqueViolation(e: unknown, field: string) {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    e.code === "P2002" &&
    JSON.stringify(e.meta ?? {}).includes(field)
  );
}

async function nextInvoiceNumber(tx: Prisma.TransactionClient, year: number) {
  const prefix = `F-${year}-`;
  const last = await tx.invoice.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const seq = last ? Number(last.number.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export async function createInvoice(input: unknown): Promise<ActionResult> {
  const parsed = invoiceInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Revisa los campos marcados.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const data = parsed.data;
  const issueDate = new Date(`${data.issueDate}T00:00:00.000Z`);

  try {
    await db.$transaction(async (tx) => {
      const client =
        data.client.mode === "existing"
          ? await tx.client.findUnique({ where: { id: data.client.id } })
          : await tx.client.create({
              data: {
                name: data.client.name,
                taxId: data.client.taxId,
                countryCode: data.client.countryCode,
                email: data.client.email || null,
              },
            });
      if (!client) throw new UserFacingError("El cliente seleccionado ya no existe.");

      const operationType = operationTypeFor(client.countryCode);
      if (operationType === "INTRA_SERVICIOS" && !isEuVatNumber(client.taxId, client.countryCode)) {
        throw new UserFacingError("El cliente no tiene un NIF-IVA válido para una operación intracomunitaria.");
      }

      // Totals are always recomputed here; the form's figures are only a preview.
      const totals = invoiceTotals(data.lines, operationType);
      if (totals.totalCents > MAX_INT4) throw new UserFacingError("El importe total es demasiado alto.");

      await tx.invoice.create({
        data: {
          number: await nextInvoiceNumber(tx, issueDate.getUTCFullYear()),
          issueDate,
          operationType,
          clientId: client.id,
          baseCents: totals.baseCents,
          vatCents: totals.vatCents,
          totalCents: totals.totalCents,
          notes: data.notes || null,
          lines: {
            create: data.lines.map((l, i) => ({
              description: l.description,
              quantity: l.quantity,
              unitPriceCents: l.unitPriceCents,
              ...totals.lines[i],
            })),
          },
        },
      });
    });
  } catch (e) {
    if (e instanceof UserFacingError) return { error: e.message };
    if (isUniqueViolation(e, "taxId")) {
      return {
        error: "Ya existe un cliente con ese NIF. Selecciónalo en la lista de clientes.",
        fieldErrors: { "client.taxId": "NIF ya registrado" },
      };
    }
    if (isUniqueViolation(e, "number")) {
      return { error: "Se guardó otra factura al mismo tiempo. Vuelve a intentarlo." };
    }
    console.error("createInvoice", e);
    return { error: "No se pudo guardar la factura. Inténtalo de nuevo." };
  }

  redirect("/facturas");
}

export async function markInvoicePaid(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Factura no válida." };

  try {
    const { count } = await db.invoice.updateMany({
      where: { id: id.data, status: "PENDIENTE" },
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
