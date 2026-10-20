// es-ES skips the thousands separator for 4-digit amounts by default; force it ("1.210,00 €").
const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", useGrouping: "always" });

export function formatCents(cents: number): string {
  return eur.format(cents / 100);
}

// Like parseEurosToCents but accepts a leading minus sign: "-25,50" -> -2550.
export function parseSignedEurosToCents(input: string): number | null {
  const trimmed = input.trim();
  const negative = trimmed.startsWith("-");
  const cents = parseEurosToCents(negative ? trimmed.slice(1) : trimmed);
  return cents === null ? null : negative ? -cents : cents;
}

// Parses "1000", "1000,5" or "1000.50" into integer cents without float math. Returns null if invalid.
export function parseEurosToCents(input: string): number | null {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

// Cents as typed in a form field: 100050 -> "1000,50".
export function centsToInput(cents: number): string {
  return `${Math.trunc(cents / 100)},${String(Math.abs(cents) % 100).padStart(2, "0")}`;
}
