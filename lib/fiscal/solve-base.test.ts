import assert from "node:assert/strict";
import { test } from "node:test";
import { expenseTotals } from "./expenses";
import { solveBaseForTotal } from "./solve-base";
import { invoiceTotals } from "./totals";

const invoiceTotal = (vatRate: number) => (base: number) =>
  invoiceTotals([{ quantity: 1, unitPriceCents: base, vatRate }], "NACIONAL").totalCents;

test("cobro de 1.210 € al 21 % → base 1.000 €", () => {
  assert.deepEqual(solveBaseForTotal(121_000, invoiceTotal(21)), { baseCents: 100_000, exact: true });
});

test("pago de 1.060 € con IVA 21 % e IRPF 15 % → base 1.000 € (caso B)", () => {
  const total = (base: number) => expenseTotals({ baseCents: base, vatRate: 21, irpfRate: 15 }).totalCents;
  assert.deepEqual(solveBaseForTotal(106_000, total), { baseCents: 100_000, exact: true });
});

test("importes sin base redonda: encuentra la base exacta si existe", () => {
  for (const target of [100, 999, 12_345, 5_000_00]) {
    const r = solveBaseForTotal(target, invoiceTotal(21));
    if (r.exact) assert.equal(invoiceTotal(21)(r.baseCents), target);
    else assert.ok(Math.abs(invoiceTotal(21)(r.baseCents) - target) <= 1);
  }
});

test("total imposible por redondeo: devuelve la base más cercana y exact = false", () => {
  // At 21 %: base 2 → total 2, base 3 → total 4, so no base gives exactly 3 cents.
  const r = solveBaseForTotal(3, invoiceTotal(21));
  assert.equal(r.exact, false);
  assert.equal(Math.abs(invoiceTotal(21)(r.baseCents) - 3), 1);
});

test("IVA 0 (intracomunitaria): la base es el total", () => {
  assert.deepEqual(solveBaseForTotal(200_000, invoiceTotal(0)), { baseCents: 200_000, exact: true });
});
