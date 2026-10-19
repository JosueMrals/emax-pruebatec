// es-ES skips the thousands separator for 4-digit amounts by default; force it ("1.210,00 €").
const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", useGrouping: "always" });

export function formatCents(cents: number): string {
  return eur.format(cents / 100);
}

// Parses "1000", "1000,5" or "1000.50" into integer cents without float math. Returns null if invalid.
export function parseEurosToCents(input: string): number | null {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}
