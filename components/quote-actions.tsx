"use client";

import { useActionState } from "react";
import { changeQuoteStatus, convertQuoteToInvoice } from "@/actions/quotes";
import { Button } from "@/components/ui/button";
import { canConvertQuote, nextQuoteStatuses, QUOTE_STATUS_LABELS, type QuoteStatus } from "@/lib/quotes";

const ACTION_LABELS: Partial<Record<QuoteStatus, string>> = {
  ENVIADO: "Marcar enviado",
  ACEPTADO: "Marcar aceptado",
  RECHAZADO: "Marcar rechazado",
  BORRADOR: "Volver a borrador",
};

export function QuoteActions({ id, number, status }: { id: string; number: string; status: QuoteStatus }) {
  const [statusState, statusAction, statusPending] = useActionState(changeQuoteStatus, { error: null });
  const [convertState, convertAction, convertPending] = useActionState(convertQuoteToInvoice, { error: null });
  const error = statusState.error ?? convertState.error;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1">
        {canConvertQuote(status) && (
          <form action={convertAction}>
            <input type="hidden" name="id" value={id} />
            <Button type="submit" size="sm" disabled={convertPending} aria-label={`Facturar ${number}`}>
              {convertPending ? "Facturando…" : "Facturar"}
            </Button>
          </form>
        )}
        {nextQuoteStatuses(status).map((to) => (
          <form key={to} action={statusAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value={to} />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={statusPending}
              aria-label={`${ACTION_LABELS[to] ?? QUOTE_STATUS_LABELS[to]}: ${number}`}
            >
              {ACTION_LABELS[to] ?? QUOTE_STATUS_LABELS[to]}
            </Button>
          </form>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
