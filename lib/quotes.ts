export const QUOTE_STATUSES = ["BORRADOR", "ENVIADO", "ACEPTADO", "RECHAZADO", "FACTURADO"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  BORRADOR: "Borrador",
  ENVIADO: "Enviado",
  ACEPTADO: "Aceptado",
  RECHAZADO: "Rechazado",
  FACTURADO: "Facturado",
};

// FACTURADO is only reachable through conversion to an invoice, never as a manual change.
const TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  BORRADOR: ["ENVIADO", "ACEPTADO", "RECHAZADO"],
  ENVIADO: ["ACEPTADO", "RECHAZADO"],
  ACEPTADO: ["RECHAZADO"],
  RECHAZADO: ["BORRADOR"],
  FACTURADO: [],
};

export function nextQuoteStatuses(status: QuoteStatus): QuoteStatus[] {
  return TRANSITIONS[status];
}

export function canChangeQuoteStatus(from: QuoteStatus, to: QuoteStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function canConvertQuote(status: QuoteStatus): boolean {
  return status === "ACEPTADO";
}
