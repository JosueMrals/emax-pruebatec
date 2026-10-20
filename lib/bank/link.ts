import "server-only";
import { UserFacingError } from "@/lib/action-errors";
import type { Prisma } from "@/lib/generated/prisma/client";
import { formatCents } from "@/lib/money";

type Target = { type: "invoice"; id: string; totalCents: number } | { type: "expense"; id: string; totalCents: number };

// Links a bank movement to a document of the same company. Callers must already have checked that
// the document belongs to companyId. Collections mark the invoice paid on the bank date.
export async function linkMovement(tx: Prisma.TransactionClient, companyId: string, movementId: string, target: Target) {
  const movement = await tx.bankMovement.findFirst({ where: { id: movementId, account: { companyId } } });
  if (!movement) throw new UserFacingError("El movimiento no existe.");
  if (movement.invoiceId || movement.expenseId) throw new UserFacingError("El movimiento ya está conciliado.");

  const expected = target.type === "invoice" ? movement.amountCents : -movement.amountCents;
  if (expected !== target.totalCents) {
    const doc = target.type === "invoice" ? "la factura" : "el gasto";
    throw new UserFacingError(
      `El total de ${doc} (${formatCents(target.totalCents)}) no coincide con el movimiento del banco (${formatCents(Math.abs(movement.amountCents))}).`,
    );
  }

  if (target.type === "invoice") {
    await tx.bankMovement.update({ where: { id: movement.id }, data: { invoiceId: target.id } });
    await tx.invoice.update({ where: { id: target.id }, data: { status: "COBRADA", paidAt: movement.date } });
  } else {
    await tx.bankMovement.update({ where: { id: movement.id }, data: { expenseId: target.id } });
  }
}
