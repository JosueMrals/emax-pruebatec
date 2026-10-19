import assert from "node:assert/strict";
import { test } from "node:test";
import { expenseTotals } from "./expenses";

test("caso B: gasto base 1.000 €, IVA 21 %, IRPF 15 % → total 1.060 €", () => {
  assert.deepEqual(expenseTotals({ baseCents: 100_000, vatRate: 21, irpfRate: 15 }), {
    baseCents: 100_000,
    vatCents: 21_000,
    irpfCents: 15_000,
    totalCents: 106_000,
  });
});

test("gasto sin retención: total = base + IVA", () => {
  assert.equal(expenseTotals({ baseCents: 25_000, vatRate: 21, irpfRate: 0 }).totalCents, 30_250);
});

test("redondeo al céntimo en IVA e IRPF", () => {
  const t = expenseTotals({ baseCents: 333, vatRate: 21, irpfRate: 15 });
  assert.equal(t.vatCents, 70);
  assert.equal(t.irpfCents, 50);
  assert.equal(t.totalCents, 353);
});
