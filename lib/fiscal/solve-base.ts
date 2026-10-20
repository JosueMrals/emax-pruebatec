// Finds the taxable base whose computed total (with rounded VAT/IRPF) equals a target total,
// e.g. a bank movement of 100,00 € at 21 % VAT. Some totals have no exact base because of
// per-cent rounding; then the closest base is returned with exact = false.
export function solveBaseForTotal(
  targetCents: number,
  totalOf: (baseCents: number) => number,
): { baseCents: number; exact: boolean } {
  if (targetCents <= 0) return { baseCents: 0, exact: targetCents === 0 };
  const ratio = totalOf(1_000_000) / 1_000_000;
  const estimate = Math.max(0, Math.round(targetCents / ratio));

  let best = estimate;
  for (let delta = 0; delta <= 3; delta++) {
    for (const base of [estimate - delta, estimate + delta]) {
      if (base < 0) continue;
      if (totalOf(base) === targetCents) return { baseCents: base, exact: true };
      if (Math.abs(totalOf(base) - targetCents) < Math.abs(totalOf(best) - targetCents)) best = base;
    }
  }
  return { baseCents: best, exact: false };
}
