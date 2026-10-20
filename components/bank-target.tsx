"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { MovementPrefill } from "@/lib/bank/movement-prefill";
import { dateFormat } from "@/lib/dates";
import { formatCents } from "@/lib/money";

export function BankMovementNotice({ movement, kind }: { movement: MovementPrefill; kind: "invoice" | "expense" }) {
  return (
    <Alert role="status">
      <AlertDescription>
        Creando {kind === "invoice" ? "la factura del cobro" : "el gasto del pago"} del{" "}
        {dateFormat.format(new Date(`${movement.date}T00:00:00Z`))} · «{movement.description}» ·{" "}
        <strong className="tabular-nums">{formatCents(movement.amountCents)}</strong>. Los importes ya están calculados;
        al guardar quedará conciliado{kind === "invoice" ? " y la factura, cobrada" : ""}.
      </AlertDescription>
    </Alert>
  );
}

// Totals-card rows comparing the document total with the bank amount it must match.
export function BankTotalCheck({
  targetCents,
  totalCents,
  onAdjust,
}: {
  targetCents: number;
  totalCents: number;
  // Null when the form can't be adjusted automatically (e.g. several lines).
  onAdjust: (() => boolean) | null;
}) {
  const [noExactBase, setNoExactBase] = useState(false);
  const matches = targetCents === totalCents;
  return (
    <>
      <dl className="grid grid-cols-2 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Importe del banco</dt>
        <dd className="text-right tabular-nums">{formatCents(targetCents)}</dd>
      </dl>
      {!matches && (
        <div role="alert" className="grid gap-2 rounded-md border border-destructive p-3 text-sm text-destructive">
          <p>
            El total no coincide con el movimiento ({formatCents(totalCents - targetCents)} de diferencia). Debe
            coincidir para conciliar.
          </p>
          {onAdjust ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="justify-self-start"
              onClick={() => setNoExactBase(!onAdjust())}
            >
              Ajustar al importe del banco
            </Button>
          ) : (
            <p>Con varias líneas, ajusta los importes a mano.</p>
          )}
          {noExactBase && <p>Con estos tipos de IVA e IRPF no existe una base exacta para ese importe. Revisa los tipos.</p>}
        </div>
      )}
    </>
  );
}
