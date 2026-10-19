"use server";

import { redirect } from "next/navigation";
import { type ActionResult, isUniqueViolation, UserFacingError } from "@/lib/action-errors";
import { db } from "@/lib/db";
import { expenseTotals } from "@/lib/fiscal/expenses";
import { fieldErrorsFrom } from "@/lib/validation/common";
import { expenseInputSchema } from "@/lib/validation/expense";

export async function createExpense(input: unknown): Promise<ActionResult> {
  const parsed = expenseInputSchema.safeParse(input);
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
          ? await tx.supplier.findUnique({ where: { id: data.supplier.id } })
          : await tx.supplier.create({ data: { name: data.supplier.name, taxId: data.supplier.taxId } });
      if (!supplier) throw new UserFacingError("El proveedor seleccionado ya no existe.");

      await tx.expense.create({
        data: {
          supplierId: supplier.id,
          date: new Date(`${data.date}T00:00:00.000Z`),
          number: data.number || null,
          description: data.description,
          vatRate: data.vatRate,
          irpfRate: data.irpfRate,
          deductible: data.deductible,
          source: "MANUAL",
          ...totals,
        },
      });
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

  redirect("/gastos");
}
