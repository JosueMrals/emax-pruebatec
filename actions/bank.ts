"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { type ActionResult, UserFacingError } from "@/lib/action-errors";
import { parseBankCsv } from "@/lib/bank/csv";
import { linkMovement } from "@/lib/bank/link";
import { getActiveCompany } from "@/lib/company";
import { db } from "@/lib/db";
import { fieldErrorsFrom } from "@/lib/validation/common";
import { bankAccountInputSchema, movementInputSchema, reconcileInputSchema } from "@/lib/validation/bank";

const NO_COMPANY: ActionResult = { error: "Configura tu empresa antes de continuar." };
const MAX_CSV_BYTES = 1024 * 1024;
const toDate = (d: string) => new Date(`${d}T00:00:00.000Z`);

async function companyAccount(companyId: string, accountId: unknown) {
  const id = z.uuid().safeParse(accountId);
  return id.success ? db.bankAccount.findFirst({ where: { id: id.data, companyId } }) : null;
}

export async function createBankAccount(input: unknown): Promise<ActionResult> {
  const company = await getActiveCompany();
  if (!company) return NO_COMPANY;
  const parsed = bankAccountInputSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisa los campos marcados.", fieldErrors: fieldErrorsFrom(parsed.error) };

  try {
    await db.bankAccount.create({
      data: { companyId: company.id, ...parsed.data, iban: parsed.data.iban || null },
    });
  } catch (e) {
    console.error("createBankAccount", e);
    return { error: "No se pudo crear la cuenta." };
  }
  refresh();
  return { error: null };
}

export async function addMovement(input: unknown): Promise<ActionResult> {
  const company = await getActiveCompany();
  if (!company) return NO_COMPANY;
  const parsed = movementInputSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisa los campos marcados.", fieldErrors: fieldErrorsFrom(parsed.error) };
  const account = await companyAccount(company.id, parsed.data.accountId);
  if (!account) return { error: "La cuenta no existe." };

  try {
    await db.bankMovement.create({
      data: {
        accountId: account.id,
        date: toDate(parsed.data.date),
        description: parsed.data.description,
        amountCents: parsed.data.amountCents,
      },
    });
  } catch (e) {
    console.error("addMovement", e);
    return { error: "No se pudo guardar el movimiento." };
  }
  refresh();
  return { error: null };
}

export interface ImportResult extends ActionResult {
  imported?: number;
  duplicates?: number;
  lineErrors?: { line: number; message: string }[];
}

export async function importMovements(_prev: ImportResult, formData: FormData): Promise<ImportResult> {
  const company = await getActiveCompany();
  if (!company) return NO_COMPANY;
  const account = await companyAccount(company.id, formData.get("accountId"));
  if (!account) return { error: "Elige una cuenta." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecciona el archivo CSV del banco." };
  if (file.size > MAX_CSV_BYTES) return { error: "El archivo supera 1 MB. Divide el extracto por meses." };

  const { movements, errors } = parseBankCsv(await file.text());
  if (!movements.length) {
    return { error: errors[0]?.message ?? "El archivo no contiene movimientos.", lineErrors: errors.slice(0, 10) };
  }

  try {
    // The unique (accountId, importHash) index makes re-imports idempotent.
    const { count } = await db.bankMovement.createMany({
      data: movements.map((m) => ({
        accountId: account.id,
        date: toDate(m.date),
        description: m.description,
        amountCents: m.amountCents,
        importHash: m.importKey,
      })),
      skipDuplicates: true,
    });
    refresh();
    return { error: null, imported: count, duplicates: movements.length - count, lineErrors: errors.slice(0, 10) };
  } catch (e) {
    console.error("importMovements", e);
    return { error: "No se pudieron importar los movimientos." };
  }
}

export async function reconcileMovement(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const company = await getActiveCompany();
  if (!company) return NO_COMPANY;
  const parsed = reconcileInputSchema.safeParse({ movementId: formData.get("movementId"), target: formData.get("target") });
  if (!parsed.success) return { error: "Elige un documento para conciliar." };
  const [type, targetId] = parsed.data.target.split(":") as ["invoice" | "expense", string];

  try {
    await db.$transaction(async (tx) => {
      const doc =
        type === "invoice"
          ? await tx.invoice.findFirst({
              where: { id: targetId, companyId: company.id },
              select: { id: true, totalCents: true, bankMovement: { select: { id: true } } },
            })
          : await tx.expense.findFirst({
              where: { id: targetId, companyId: company.id },
              select: { id: true, totalCents: true, bankMovement: { select: { id: true } } },
            });
      if (!doc) throw new UserFacingError(type === "invoice" ? "La factura no existe." : "El gasto no existe.");
      if (doc.bankMovement) {
        throw new UserFacingError(
          type === "invoice"
            ? "La factura ya está conciliada con otro movimiento."
            : "El gasto ya está conciliado con otro movimiento.",
        );
      }
      await linkMovement(tx, company.id, parsed.data.movementId, { type, id: doc.id, totalCents: doc.totalCents });
    });
  } catch (e) {
    if (e instanceof UserFacingError) return { error: e.message };
    console.error("reconcileMovement", e);
    return { error: "No se pudo conciliar el movimiento." };
  }
  refresh();
  return { error: null };
}

export async function unreconcileMovement(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const company = await getActiveCompany();
  if (!company) return NO_COMPANY;
  const id = z.uuid().safeParse(formData.get("movementId"));
  if (!id.success) return { error: "Movimiento no válido." };

  try {
    await db.$transaction(async (tx) => {
      const movement = await tx.bankMovement.findFirst({ where: { id: id.data, account: { companyId: company.id } } });
      if (!movement) throw new UserFacingError("El movimiento no existe.");
      await tx.bankMovement.update({ where: { id: movement.id }, data: { invoiceId: null, expenseId: null } });
      // Undoing the match also undoes the "paid" status it set.
      if (movement.invoiceId) {
        await tx.invoice.update({ where: { id: movement.invoiceId }, data: { status: "PENDIENTE", paidAt: null } });
      }
    });
  } catch (e) {
    if (e instanceof UserFacingError) return { error: e.message };
    console.error("unreconcileMovement", e);
    return { error: "No se pudo deshacer la conciliación." };
  }
  refresh();
  return { error: null };
}
