// Next correlative document number per year and series: "F-2026-0001", "P-2026-0002"...
export function nextDocumentNumber(prefix: string, year: number, lastNumber: string | null): string {
  const series = `${prefix}-${year}-`;
  const last = lastNumber?.startsWith(series) ? Number(lastNumber.slice(series.length)) : 0;
  return `${series}${String((Number.isInteger(last) ? last : 0) + 1).padStart(4, "0")}`;
}

export function documentSeries(prefix: string, year: number): string {
  return `${prefix}-${year}-`;
}
