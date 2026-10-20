"use server";

import { redirect } from "next/navigation";
import { type ActionResult, isUniqueViolation, UserFacingError } from "@/lib/action-errors";
import { getActiveCompany } from "@/lib/company";
import { linkMovement } from "@/lib/bank/link";
import { db } from "@/lib/db";
import { expenseTotals } from "@/lib/fiscal/expenses";
import { fieldErrorsFrom, fromMovementSchema } from "@/lib/validation/common";
import { expenseInputSchema } from "@/lib/validation/expense";

export async function createExpense(input: unknown): Promise<ActionResult> {
  const company = await getActiveCompany();
  if (!company) return { error: "Configura tu empresa antes de continuar." };
  const parsed = expenseInputSchema.extend(fromMovementSchema.shape).safeParse(input);
  if (!parsed.success) {
    return { error: "Revisa los campos marcados.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const data = parsed.data;

  // Totals are always recomputed here; the form's figures are only a preview.
  const totals = expenseTotals(data);

  try {
    await db.$transaction(async (tx) => {
      const supplier =
        data.supplier.mode === "existing"
          ? await tx.supplier.findFirst({ where: { id: data.supplier.id, companyId: company.id } })
          : await tx.supplier.create({
              data: { companyId: company.id, name: data.supplier.name, taxId: data.supplier.taxId },
            });
      if (!supplier) throw new UserFacingError("El proveedor seleccionado ya no existe.");

      const expense = await tx.expense.create({
        data: {
          companyId: company.id,
          supplierId: supplier.id,
          date: new Date(`${data.date}T00:00:00.000Z`),
          number: data.number || null,
          description: data.description,
          vatRate: data.vatRate,
          irpfRate: data.irpfRate,
          deductible: data.deductible,
          source: data.source,
          ...totals,
        },
      });
      // Created from a bank payment: reconcile in the same transaction, or save nothing.
      if (data.movementId) {
        await linkMovement(tx, company.id, data.movementId, { type: "expense", id: expense.id, totalCents: expense.totalCents });
      }
    });
  } catch (e) {
    if (e instanceof UserFacingError) return { error: e.message };
    if (isUniqueViolation(e, "taxId")) {
      return {
        error: "Ya existe un proveedor con ese NIF. Selecciónalo en la lista de proveedores.",
        fieldErrors: { "supplier.taxId": "NIF ya registrado" },
      };
    }
    console.error("createExpense", e);
    return { error: "No se pudo guardar el gasto. Inténtalo de nuevo." };
  }

  redirect(
    data.movementId
      ? `/banco/conciliacion?conciliado=${encodeURIComponent(`Gasto de ${data.description}`)}`
      : "/gastos",
  );
}
