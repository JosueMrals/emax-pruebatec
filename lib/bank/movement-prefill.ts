import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";

export interface MovementPrefill {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amountCents: number; // absolute value: the document total it must match
}

// Loads the bank movement a new invoice (collection) or expense (payment) is created from.
// Returns a notice instead when it can't be used, so the form still opens empty.
export async function loadMovementPrefill(
  companyId: string,
  movementId: string | string[] | undefined,
  kind: "invoice" | "expense",
): Promise<{ movement?: MovementPrefill; notice?: string }> {
  if (typeof movementId !== "string" || !movementId) return {};
  const id = z.uuid().safeParse(movementId);
  const movement = id.success
    ? await db.bankMovement.findFirst({ where: { id: id.data, account: { companyId } } })
    : null;
  if (!movement) return { notice: "El movimiento bancario no existe." };
  if (movement.invoiceId || movement.expenseId) return { notice: "Ese movimiento ya está conciliado." };
  if (kind === "invoice" ? movement.amountCents <= 0 : movement.amountCents >= 0) {
    return { notice: kind === "invoice" ? "Ese movimiento es un pago, no un cobro." : "Ese movimiento es un cobro, no un pago." };
  }
  return {
    movement: {
      id: movement.id,
      date: movement.date.toISOString().slice(0, 10),
      description: movement.description.slice(0, 500),
      amountCents: Math.abs(movement.amountCents),
    },
  };
}
