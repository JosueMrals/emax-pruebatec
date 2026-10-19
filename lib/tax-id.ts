// Strips spaces, dots and dashes so "b-12.345.678" and "B12345678" are the same NIF.
export function normalizeTaxId(taxId: string): string {
  return taxId.replace(/[\s.-]/g, "").toUpperCase();
}
